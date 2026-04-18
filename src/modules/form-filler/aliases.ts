import { normaliseText } from './normalizer';

export const PROFILE_ALIAS_KEYS = [
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'location',
  'linkedinUrl',
  'portfolioUrl',
  'headline',
  'summary',
] as const;

export type ProfileAliasKey = (typeof PROFILE_ALIAS_KEYS)[number];

export const PROFILE_ALIASES: Record<ProfileAliasKey, readonly string[]> = {
  fullName: [
    'nome completo',
    'nome e sobrenome',
    'seu nome',
    'nome',
    'full name',
    'name',
    'candidate name',
    'applicant name',
    'your name',
  ],
  firstName: ['primeiro nome', 'first name', 'given name', 'nome'],
  lastName: ['sobrenome', 'ultimo nome', 'last name', 'surname', 'family name'],
  email: [
    'e mail',
    'email',
    'endereco de email',
    'correio eletronico',
    'email address',
    'contact email',
  ],
  phone: [
    'telefone',
    'celular',
    'whatsapp',
    'numero de contato',
    'telefone de contato',
    'phone',
    'mobile',
    'cell phone',
    'phone number',
    'contact number',
  ],
  location: [
    'localizacao',
    'cidade',
    'local',
    'localidade',
    'endereco',
    'cidade estado',
    'city',
    'location',
    'current location',
    'address',
    'city state',
  ],
  linkedinUrl: [
    'linkedin',
    'perfil linkedin',
    'url linkedin',
    'link linkedin',
    'linkedin url',
    'linkedin profile',
    'linkedin link',
  ],
  portfolioUrl: [
    'portfolio',
    'site pessoal',
    'website',
    'site',
    'pagina pessoal',
    'portfolio url',
    'personal website',
    'personal site',
  ],
  headline: [
    'headline',
    'titulo',
    'cargo atual',
    'posicao atual',
    'current title',
    'current role',
    'job title',
    'current position',
  ],
  summary: [
    'sobre',
    'sobre voce',
    'resumo',
    'bio',
    'biografia',
    'apresentacao',
    'summary',
    'about',
    'about you',
    'about me',
    'tell us about yourself',
  ],
};

export const RESUME_ALIASES: readonly string[] = [
  'curriculo',
  'curriculum vitae',
  'cv',
  'anexar curriculo',
  'upload curriculo',
  'upload cv',
  'resume',
  'upload resume',
  'attach resume',
];

export interface NormalisedAliasMap {
  key: ProfileAliasKey;
  aliases: string[];
}

let cachedNormalisedAliases: NormalisedAliasMap[] | undefined;

export function getNormalisedProfileAliases(): NormalisedAliasMap[] {
  if (!cachedNormalisedAliases) {
    cachedNormalisedAliases = PROFILE_ALIAS_KEYS.map((key) => ({
      key,
      aliases: PROFILE_ALIASES[key].map((alias) => normaliseText(alias)),
    }));
  }
  return cachedNormalisedAliases;
}

let cachedResumeAliases: string[] | undefined;

export function getNormalisedResumeAliases(): string[] {
  if (!cachedResumeAliases) {
    cachedResumeAliases = RESUME_ALIASES.map((alias) => normaliseText(alias));
  }
  return cachedResumeAliases;
}
