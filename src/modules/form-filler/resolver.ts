import type { CandidateProfile } from '../profile';
import type { FieldConfidence, FormField, FormFieldOption } from '../form-parser/types';
import {
  getNormalisedProfileAliases,
  getNormalisedResumeAliases,
  PROFILE_ALIAS_KEYS,
  type ProfileAliasKey,
} from './aliases';
import { normaliseText } from './normalizer';
import { getProfileValue } from './profile-source';
import type { SavedAnswer } from './types';

export type ResolutionSource = 'profile' | 'saved-answer' | 'rule' | 'resume' | 'none';
export type ResolutionStatus = 'resolved' | 'pending' | 'skipped';

export interface FieldResolution {
  status: ResolutionStatus;
  source: ResolutionSource;
  value?: string;
  confidence?: FieldConfidence;
  profileKey?: ProfileAliasKey;
  savedAnswerId?: string;
  matchScore?: number;
  pendingReason?: string;
  option?: FormFieldOption;
  useResume?: boolean;
}

export interface ResolveContext {
  profile?: CandidateProfile;
  savedAnswers?: SavedAnswer[];
}

const PROFILE_MATCH_THRESHOLD = 0.6;
const SAVED_ANSWER_THRESHOLD = 0.5;
const HIGH_CONFIDENCE = 0.85;
const MEDIUM_CONFIDENCE = 0.6;

function confidenceFromScore(score: number): FieldConfidence {
  if (score >= HIGH_CONFIDENCE) return 'high';
  if (score >= MEDIUM_CONFIDENCE) return 'medium';
  return 'low';
}

function fieldHaystacks(field: FormField): string[] {
  return [
    normaliseText(field.label),
    normaliseText(field.name),
    normaliseText(field.id),
    normaliseText(field.placeholder),
  ].filter((haystack) => haystack.length > 0);
}

export function scoreTextSimilarity(haystack: string, alias: string): number {
  if (!haystack || !alias) return 0;
  if (haystack === alias) return 1;
  if (haystack.includes(alias) || alias.includes(haystack)) {
    const short = Math.min(haystack.length, alias.length);
    const long = Math.max(haystack.length, alias.length);
    return 0.4 + 0.5 * (short / long);
  }
  const aliasTokens = new Set(alias.split(/\s+/).filter(Boolean));
  const haystackTokens = new Set(haystack.split(/\s+/).filter(Boolean));
  if (aliasTokens.size === 0) return 0;
  let intersection = 0;
  for (const token of aliasTokens) {
    if (haystackTokens.has(token)) intersection += 1;
  }
  if (intersection === 0) return 0;
  return 0.35 * (intersection / aliasTokens.size);
}

export interface ProfileKeyMatch {
  key: ProfileAliasKey;
  score: number;
}

export function scoreFieldAgainstProfileKeys(field: FormField): ProfileKeyMatch[] {
  const haystacks = fieldHaystacks(field);
  if (haystacks.length === 0) return [];

  const matches: ProfileKeyMatch[] = [];
  for (const { key, aliases } of getNormalisedProfileAliases()) {
    let best = 0;
    for (const alias of aliases) {
      for (const haystack of haystacks) {
        const score = scoreTextSimilarity(haystack, alias);
        if (score > best) best = score;
      }
    }
    matches.push({ key, score: best });
  }
  return matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return PROFILE_ALIAS_KEYS.indexOf(a.key) - PROFILE_ALIAS_KEYS.indexOf(b.key);
  });
}

function isResumeField(field: FormField): boolean {
  if (field.type !== 'file') return false;
  const haystacks = fieldHaystacks(field);
  const accept = normaliseText(field.placeholder ?? '');
  if (accept.includes('pdf') || accept.includes('doc')) return true;
  for (const alias of getNormalisedResumeAliases()) {
    for (const haystack of haystacks) {
      if (scoreTextSimilarity(haystack, alias) >= PROFILE_MATCH_THRESHOLD) return true;
    }
  }
  return false;
}

function matchOption(field: FormField, value: string): FormFieldOption | undefined {
  if (field.options.length === 0) return undefined;
  const target = normaliseText(value);
  if (!target) return undefined;
  let best: { option: FormFieldOption; score: number } | undefined;
  for (const option of field.options) {
    const optionLabel = normaliseText(option.label);
    const optionValue = normaliseText(option.value);
    const score = Math.max(
      scoreTextSimilarity(optionLabel, target),
      scoreTextSimilarity(optionValue, target),
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { option, score };
    }
  }
  return best && best.score >= MEDIUM_CONFIDENCE ? best.option : undefined;
}

function resolveFromProfile(
  field: FormField,
  profile: CandidateProfile,
): FieldResolution | undefined {
  if (field.type === 'file') {
    if (isResumeField(field) && profile.resume?.dataUrl) {
      return {
        status: 'resolved',
        source: 'resume',
        value: profile.resume.dataUrl,
        confidence: 'high',
        useResume: true,
      };
    }
    return undefined;
  }

  const matches = scoreFieldAgainstProfileKeys(field);
  const [best] = matches;
  if (!best || best.score < PROFILE_MATCH_THRESHOLD) return undefined;

  const raw = getProfileValue(profile, best.key);
  if (!raw) return undefined;

  if (field.options.length > 0) {
    const option = matchOption(field, raw);
    if (!option) return undefined;
    return {
      status: 'resolved',
      source: 'profile',
      value: option.value,
      option,
      confidence: confidenceFromScore(best.score),
      profileKey: best.key,
      matchScore: best.score,
    };
  }

  return {
    status: 'resolved',
    source: 'profile',
    value: raw,
    confidence: confidenceFromScore(best.score),
    profileKey: best.key,
    matchScore: best.score,
  };
}

function resolveFromCustomAnswers(
  field: FormField,
  profile: CandidateProfile,
): FieldResolution | undefined {
  const entries = Object.entries(profile.customAnswers ?? {});
  if (entries.length === 0) return undefined;
  const haystacks = fieldHaystacks(field);
  if (haystacks.length === 0) return undefined;

  let best: { value: string; score: number } | undefined;
  for (const [key, value] of entries) {
    if (!value) continue;
    const normalisedKey = normaliseText(key);
    if (!normalisedKey) continue;
    for (const haystack of haystacks) {
      const score = scoreTextSimilarity(haystack, normalisedKey);
      if (score > 0 && (!best || score > best.score)) {
        best = { value, score };
      }
    }
  }

  if (!best || best.score < SAVED_ANSWER_THRESHOLD) return undefined;

  if (field.options.length > 0) {
    const option = matchOption(field, best.value);
    if (!option) return undefined;
    return {
      status: 'resolved',
      source: 'profile',
      value: option.value,
      option,
      confidence: confidenceFromScore(best.score),
      matchScore: best.score,
    };
  }

  return {
    status: 'resolved',
    source: 'profile',
    value: best.value,
    confidence: confidenceFromScore(best.score),
    matchScore: best.score,
  };
}

function resolveFromSavedAnswers(
  field: FormField,
  answers: SavedAnswer[],
): FieldResolution | undefined {
  if (answers.length === 0) return undefined;
  const haystacks = fieldHaystacks(field);
  if (haystacks.length === 0) return undefined;

  let best: { answer: SavedAnswer; score: number } | undefined;
  for (const answer of answers) {
    if (answer.fieldTypes.length > 0 && !answer.fieldTypes.includes(field.type)) continue;
    const candidates = [normaliseText(answer.label), ...answer.keywords.map(normaliseText)].filter(
      (text) => text.length > 0,
    );
    if (candidates.length === 0) continue;
    let bestForAnswer = 0;
    for (const candidate of candidates) {
      for (const haystack of haystacks) {
        const score = scoreTextSimilarity(haystack, candidate);
        if (score > bestForAnswer) bestForAnswer = score;
      }
    }
    if (bestForAnswer > 0 && (!best || bestForAnswer > best.score)) {
      best = { answer, score: bestForAnswer };
    }
  }

  if (!best || best.score < SAVED_ANSWER_THRESHOLD) return undefined;

  const { answer } = best;

  let resolvedValue = answer.value;
  let resolvedOption: FormFieldOption | undefined;

  if (field.options.length > 0) {
    const option = matchOption(field, answer.value);
    if (!option) return undefined;
    resolvedValue = option.value;
    resolvedOption = option;
  }

  if (answer.reuseMode === 'suggest') {
    return {
      status: 'pending',
      source: 'saved-answer',
      value: resolvedValue,
      confidence: confidenceFromScore(best.score),
      savedAnswerId: answer.id,
      matchScore: best.score,
      option: resolvedOption,
      pendingReason: `Sugestão de resposta salva: "${answer.value}"`,
    };
  }

  return {
    status: 'resolved',
    source: 'saved-answer',
    value: resolvedValue,
    option: resolvedOption,
    confidence: answer.reuseMode === 'confirm' ? 'low' : confidenceFromScore(best.score),
    savedAnswerId: answer.id,
    matchScore: best.score,
  };
}

function resolveByRules(field: FormField): FieldResolution | undefined {
  if (field.type !== 'radio' && field.type !== 'select') return undefined;
  if (field.options.length === 0) return undefined;
  const haystacks = fieldHaystacks(field);
  const askedAboutYes = haystacks.some((text) =>
    /\b(consentimento|autoriza|concorda|aceita|agree|consent|authorize|accept)\b/.test(text),
  );
  if (!askedAboutYes) return undefined;
  const yesOption = field.options.find((option) => /\b(sim|yes|y|true|1)\b/.test(normaliseText(option.label)));
  if (!yesOption) return undefined;
  return {
    status: 'resolved',
    source: 'rule',
    value: yesOption.value,
    option: yesOption,
    confidence: 'low',
    matchScore: 0.5,
  };
}

export function resolveField(field: FormField, context: ResolveContext = {}): FieldResolution {
  if (context.profile) {
    const fromProfile = resolveFromProfile(field, context.profile);
    if (fromProfile) return fromProfile;
  }

  if (context.profile) {
    const fromCustom = resolveFromCustomAnswers(field, context.profile);
    if (fromCustom) return fromCustom;
  }

  if (context.savedAnswers && context.savedAnswers.length > 0) {
    const fromSaved = resolveFromSavedAnswers(field, context.savedAnswers);
    if (fromSaved) return fromSaved;
  }

  const fromRules = resolveByRules(field);
  if (fromRules) return fromRules;

  if (field.required) {
    return {
      status: 'pending',
      source: 'none',
      pendingReason: 'Campo obrigatório sem correspondência automática.',
    };
  }

  return {
    status: 'skipped',
    source: 'none',
    pendingReason: 'Campo opcional sem correspondência automática.',
  };
}

export function resolveFields(
  fields: FormField[],
  context: ResolveContext = {},
): Map<string, FieldResolution> {
  const map = new Map<string, FieldResolution>();
  for (const field of fields) {
    map.set(field.id, resolveField(field, context));
  }
  return map;
}
