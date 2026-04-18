export const STORAGE_MODULE = 'storage';

export {
  createChromeStorageAdapter,
  createMemoryStorageAdapter,
  getStorageAdapter,
  setStorageAdapter,
} from './adapter';
export type { StorageAdapter } from './adapter';

export { STORAGE_KEYS } from './keys';
export type { StorageKey } from './keys';

export { createProfileRepository } from './profile-repository';
export type { ProfileRepository } from './profile-repository';

export { createResultsRepository } from './results-repository';
export type { ResultsRepository } from './results-repository';

export { createQueueRepository } from './queue-repository';
export type { QueueEntry, QueueRepository } from './queue-repository';

export { createHistoryRepository } from './history-repository';
export type { HistoryRepository } from './history-repository';

export { createSavedAnswersRepository } from './saved-answers-repository';
export type { SavedAnswersRepository } from './saved-answers-repository';
