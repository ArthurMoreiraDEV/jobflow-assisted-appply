import type { SavedAnswer } from '../form-filler';
import { getStorageAdapter, type StorageAdapter } from './adapter';
import { STORAGE_KEYS } from './keys';

export interface SavedAnswersRepository {
  list(): Promise<SavedAnswer[]>;
  save(answers: SavedAnswer[]): Promise<SavedAnswer[]>;
  upsert(answer: SavedAnswer): Promise<SavedAnswer[]>;
  remove(answerId: string): Promise<SavedAnswer[]>;
  clear(): Promise<void>;
}

export function createSavedAnswersRepository(
  adapter: StorageAdapter = getStorageAdapter(),
): SavedAnswersRepository {
  async function read(): Promise<SavedAnswer[]> {
    const raw = await adapter.get<SavedAnswer[]>(STORAGE_KEYS.savedAnswers);
    return Array.isArray(raw) ? raw : [];
  }

  async function write(answers: SavedAnswer[]): Promise<SavedAnswer[]> {
    await adapter.set(STORAGE_KEYS.savedAnswers, answers);
    return answers;
  }

  return {
    async list() {
      return read();
    },
    async save(answers) {
      return write(answers);
    },
    async upsert(answer) {
      const current = await read();
      const index = current.findIndex((entry) => entry.id === answer.id);
      const stamped: SavedAnswer = { ...answer, updatedAt: new Date().toISOString() };
      if (index >= 0) {
        current[index] = stamped;
      } else {
        current.push(stamped);
      }
      return write(current);
    },
    async remove(answerId) {
      const current = await read();
      return write(current.filter((entry) => entry.id !== answerId));
    },
    async clear() {
      await adapter.remove(STORAGE_KEYS.savedAnswers);
    },
  };
}
