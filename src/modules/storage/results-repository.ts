import type { JobListing } from '../job-list';
import { getStorageAdapter, type StorageAdapter } from './adapter';
import { STORAGE_KEYS } from './keys';

export interface ResultsRepository {
  list(): Promise<JobListing[]>;
  save(jobs: JobListing[]): Promise<JobListing[]>;
  merge(jobs: JobListing[]): Promise<JobListing[]>;
  remove(jobId: string): Promise<JobListing[]>;
  clear(): Promise<void>;
}

export function createResultsRepository(
  adapter: StorageAdapter = getStorageAdapter(),
): ResultsRepository {
  async function read(): Promise<JobListing[]> {
    const raw = await adapter.get<JobListing[]>(STORAGE_KEYS.results);
    return Array.isArray(raw) ? raw : [];
  }

  async function write(jobs: JobListing[]): Promise<JobListing[]> {
    await adapter.set(STORAGE_KEYS.results, jobs);
    return jobs;
  }

  return {
    async list() {
      return read();
    },
    async save(jobs) {
      return write(jobs);
    },
    async merge(jobs) {
      const current = await read();
      const byId = new Map(current.map((j) => [j.id, j]));
      for (const job of jobs) {
        const existing = byId.get(job.id);
        byId.set(job.id, existing ? { ...existing, ...job, status: existing.status } : job);
      }
      return write(Array.from(byId.values()));
    },
    async remove(jobId) {
      const current = await read();
      return write(current.filter((j) => j.id !== jobId));
    },
    async clear() {
      await adapter.remove(STORAGE_KEYS.results);
    },
  };
}
