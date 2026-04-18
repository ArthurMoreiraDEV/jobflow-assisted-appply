export const FORM_FILLER_MODULE = 'form-filler';

export type { ReuseMode, SavedAnswer } from './types';
export { REUSE_MODES, createSavedAnswer } from './types';

export {
  PROFILE_ALIASES,
  PROFILE_ALIAS_KEYS,
  RESUME_ALIASES,
  getNormalisedProfileAliases,
  getNormalisedResumeAliases,
} from './aliases';
export type { ProfileAliasKey, NormalisedAliasMap } from './aliases';

export { normaliseText, tokenize, uniqueTokens } from './normalizer';

export { getProfileValue } from './profile-source';

export {
  resolveField,
  resolveFields,
  scoreFieldAgainstProfileKeys,
  scoreTextSimilarity,
} from './resolver';
export type {
  FieldResolution,
  ResolutionSource,
  ResolutionStatus,
  ResolveContext,
  ProfileKeyMatch,
} from './resolver';

export { fillField, fillFields } from './filler';
export type { FillFieldsOptions, FillOutcome, FillReport } from './filler';
