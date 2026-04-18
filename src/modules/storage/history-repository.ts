import type { ApplicationAttempt, ApplicationResult } from '../executor';
import { getStorageAdapter, type StorageAdapter } from './adapter';
import { STORAGE_KEYS } from './keys';

export interface HistoryRepository {
  list(): Promise<ApplicationAttempt[]>;
  listByResult(result: ApplicationResult): Promise<ApplicationAttempt[]>;
  save(attempts: ApplicationAttempt[]): Promise<ApplicationAttempt[]>;
  upsert(attempt: ApplicationAttempt): Promise<ApplicationAttempt[]>;
  remove(attemptId: string): Promise<ApplicationAttempt[]>;
  clear(): Promise<void>;
}

export function createHistoryRepository(
  adapter: StorageAdapter = getStorageAdapter(),
): HistoryRepository {
  async function read(): Promise<ApplicationAttempt[]> {
    const raw = await adapter.get<ApplicationAttempt[]>(STORAGE_KEYS.history);
    return Array.isArray(raw) ? raw : [];
  }

  async function write(attempts: ApplicationAttempt[]): Promise<ApplicationAttempt[]> {
    await adapter.set(STORAGE_KEYS.history, attempts);
    return attempts;
  }

  return {
    async list() {
      return read();
    },
    async listByResult(result) {
      return (await read()).filter((attempt) => attempt.result === result);
    },
    async save(attempts) {
      return write(attempts);
    },
    async upsert(attempt) {
      const current = await read();
      const index = current.findIndex((entry) => entry.id === attempt.id);
      if (index >= 0) {
        current[index] = attempt;
      } else {
        current.push(attempt);
      }
      return write(current);
    },
    async remove(attemptId) {
      const current = await read();
      return write(current.filter((entry) => entry.id !== attemptId));
    },
    async clear() {
      await adapter.remove(STORAGE_KEYS.history);
    },
  };
}
