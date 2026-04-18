import type { JobListing, JobStatus } from '../job-list';
import { getStorageAdapter, type StorageAdapter } from './adapter';
import { STORAGE_KEYS } from './keys';

export interface QueueEntry {
  job: JobListing;
  position: number;
}

export interface QueueRepository {
  list(): Promise<QueueEntry[]>;
  save(entries: QueueEntry[]): Promise<QueueEntry[]>;
  upsert(job: JobListing): Promise<QueueEntry[]>;
  remove(jobId: string): Promise<QueueEntry[]>;
  updateStatus(jobId: string, status: JobStatus): Promise<QueueEntry[]>;
  clear(): Promise<void>;
}

function normalize(entries: QueueEntry[]): QueueEntry[] {
  return entries
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((entry, index) => ({ ...entry, position: index }));
}

export function createQueueRepository(
  adapter: StorageAdapter = getStorageAdapter(),
): QueueRepository {
  async function read(): Promise<QueueEntry[]> {
    const raw = await adapter.get<QueueEntry[]>(STORAGE_KEYS.queue);
    return Array.isArray(raw) ? raw : [];
  }

  async function write(entries: QueueEntry[]): Promise<QueueEntry[]> {
    const normalized = normalize(entries);
    await adapter.set(STORAGE_KEYS.queue, normalized);
    return normalized;
  }

  return {
    async list() {
      return normalize(await read());
    },
    async save(entries) {
      return write(entries);
    },
    async upsert(job) {
      const current = await read();
      const existingIndex = current.findIndex((entry) => entry.job.id === job.id);
      if (existingIndex >= 0) {
        current[existingIndex] = {
          ...current[existingIndex],
          job: { ...job, updatedAt: new Date().toISOString() },
        };
      } else {
        current.push({
          job: { ...job, updatedAt: new Date().toISOString() },
          position: current.length,
        });
      }
      return write(current);
    },
    async remove(jobId) {
      const current = await read();
      const next = current.filter((entry) => entry.job.id !== jobId);
      return write(next);
    },
    async updateStatus(jobId, status) {
      const current = await read();
      const next = current.map((entry) =>
        entry.job.id === jobId
          ? {
              ...entry,
              job: { ...entry.job, status, updatedAt: new Date().toISOString() },
            }
          : entry,
      );
      return write(next);
    },
    async clear() {
      await adapter.remove(STORAGE_KEYS.queue);
    },
  };
}
