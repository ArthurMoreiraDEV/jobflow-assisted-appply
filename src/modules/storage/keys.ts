export const STORAGE_KEYS = {
  profile: 'profile',
  results: 'results',
  queue: 'queue',
  history: 'history',
  savedAnswers: 'savedAnswers',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
