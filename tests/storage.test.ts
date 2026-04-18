import { beforeEach, describe, expect, it } from 'vitest';
import { createCandidateProfile } from '../src/modules/profile';
import { createJobListing } from '../src/modules/job-list';
import { createApplicationAttempt } from '../src/modules/executor';
import { createSavedAnswer } from '../src/modules/form-filler';
import {
  createHistoryRepository,
  createMemoryStorageAdapter,
  createProfileRepository,
  createQueueRepository,
  createSavedAnswersRepository,
  STORAGE_KEYS,
  type StorageAdapter,
} from '../src/modules/storage';

let adapter: StorageAdapter;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
});

describe('ProfileRepository (E3-S1-T1)', () => {
  it('returns undefined when nothing has been saved', async () => {
    const repo = createProfileRepository(adapter);
    expect(await repo.load()).toBeUndefined();
  });

  it('persists and restores a profile across sessions', async () => {
    const repo = createProfileRepository(adapter);
    const profile = createCandidateProfile({
      id: 'u1',
      fullName: 'Ada Lovelace',
      contact: { email: 'ada@example.com' },
      skills: ['typescript'],
    });
    const saved = await repo.save(profile);
    expect(saved.fullName).toBe('Ada Lovelace');

    const fresh = createProfileRepository(adapter);
    const restored = await fresh.load();
    expect(restored?.fullName).toBe('Ada Lovelace');
    expect(restored?.contact.email).toBe('ada@example.com');
    expect(restored?.skills).toEqual(['typescript']);
  });

  it('overwrites with the latest profile changes and stamps updatedAt', async () => {
    const repo = createProfileRepository(adapter);
    await repo.save(createCandidateProfile({ id: 'u1', fullName: 'Ada' }));
    const updated = await repo.save(
      createCandidateProfile({ id: 'u1', fullName: 'Ada Lovelace' }),
    );
    expect(updated.fullName).toBe('Ada Lovelace');
    expect(updated.updatedAt).not.toBe(new Date(0).toISOString());
    const restored = await repo.load();
    expect(restored?.fullName).toBe('Ada Lovelace');
  });
});

describe('QueueRepository (E3-S1-T2)', () => {
  it('upserts jobs preserving insertion order as positions', async () => {
    const repo = createQueueRepository(adapter);
    const j1 = createJobListing({ id: 'j1', title: 'A', company: 'X', url: 'u1' });
    const j2 = createJobListing({ id: 'j2', title: 'B', company: 'Y', url: 'u2' });
    await repo.upsert(j1);
    await repo.upsert(j2);
    const entries = await repo.list();
    expect(entries).toHaveLength(2);
    expect(entries[0].job.id).toBe('j1');
    expect(entries[0].position).toBe(0);
    expect(entries[1].position).toBe(1);
  });

  it('restores the queue after reloading the repository', async () => {
    const repo = createQueueRepository(adapter);
    await repo.upsert(createJobListing({ id: 'j1', title: 'A', company: 'X', url: 'u1' }));
    await repo.upsert(createJobListing({ id: 'j2', title: 'B', company: 'Y', url: 'u2' }));
    const fresh = createQueueRepository(adapter);
    const entries = await fresh.list();
    expect(entries.map((e) => e.job.id)).toEqual(['j1', 'j2']);
  });

  it('updates the status of an entry and keeps position stable', async () => {
    const repo = createQueueRepository(adapter);
    await repo.upsert(createJobListing({ id: 'j1', title: 'A', company: 'X', url: 'u1' }));
    await repo.upsert(createJobListing({ id: 'j2', title: 'B', company: 'Y', url: 'u2' }));
    const updated = await repo.updateStatus('j2', 'processing');
    expect(updated.find((e) => e.job.id === 'j2')?.job.status).toBe('processing');
    expect(updated.find((e) => e.job.id === 'j2')?.position).toBe(1);
  });

  it('removes a job and renumbers positions', async () => {
    const repo = createQueueRepository(adapter);
    await repo.upsert(createJobListing({ id: 'j1', title: 'A', company: 'X', url: 'u1' }));
    await repo.upsert(createJobListing({ id: 'j2', title: 'B', company: 'Y', url: 'u2' }));
    await repo.upsert(createJobListing({ id: 'j3', title: 'C', company: 'Z', url: 'u3' }));
    const after = await repo.remove('j2');
    expect(after.map((e) => e.job.id)).toEqual(['j1', 'j3']);
    expect(after.map((e) => e.position)).toEqual([0, 1]);
  });
});

describe('HistoryRepository (E3-S1-T3)', () => {
  it('stores concluded, pending, failed and skipped attempts together', async () => {
    const repo = createHistoryRepository(adapter);
    await repo.upsert(
      createApplicationAttempt({ id: 'a1', jobId: 'j1', result: 'success' }),
    );
    await repo.upsert(
      createApplicationAttempt({ id: 'a2', jobId: 'j2', result: 'pending' }),
    );
    await repo.upsert(
      createApplicationAttempt({ id: 'a3', jobId: 'j3', result: 'failed' }),
    );
    await repo.upsert(
      createApplicationAttempt({ id: 'a4', jobId: 'j4', result: 'skipped' }),
    );

    expect((await repo.list()).map((a) => a.result)).toEqual([
      'success',
      'pending',
      'failed',
      'skipped',
    ]);
    expect(await repo.listByResult('failed')).toHaveLength(1);
    expect(await repo.listByResult('pending')).toHaveLength(1);
  });

  it('updates an attempt in place when upserting with the same id', async () => {
    const repo = createHistoryRepository(adapter);
    await repo.upsert(createApplicationAttempt({ id: 'a1', jobId: 'j1' }));
    const finalised = createApplicationAttempt({
      id: 'a1',
      jobId: 'j1',
      result: 'success',
      endedAt: '2026-04-16T00:00:00.000Z',
    });
    await repo.upsert(finalised);
    const list = await repo.list();
    expect(list).toHaveLength(1);
    expect(list[0].result).toBe('success');
    expect(list[0].endedAt).toBe('2026-04-16T00:00:00.000Z');
  });
});

describe('SavedAnswersRepository (E3-S1-T4)', () => {
  it('persists saved answers across sessions', async () => {
    const repo = createSavedAnswersRepository(adapter);
    await repo.upsert(
      createSavedAnswer({ id: 's1', label: 'Salário', value: 'R$ 12k' }),
    );
    const fresh = createSavedAnswersRepository(adapter);
    const list = await fresh.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('s1');
    expect(list[0].value).toBe('R$ 12k');
  });

  it('updates an existing answer and refreshes updatedAt', async () => {
    const repo = createSavedAnswersRepository(adapter);
    await repo.upsert(
      createSavedAnswer({ id: 's1', label: 'Salário', value: 'R$ 10k' }),
    );
    const updated = await repo.upsert(
      createSavedAnswer({ id: 's1', label: 'Salário', value: 'R$ 12k' }),
    );
    expect(updated).toHaveLength(1);
    expect(updated[0].value).toBe('R$ 12k');
    expect(updated[0].updatedAt).not.toBe(new Date(0).toISOString());
  });

  it('removes answers by id', async () => {
    const repo = createSavedAnswersRepository(adapter);
    await repo.upsert(createSavedAnswer({ id: 's1', label: 'A', value: 'a' }));
    await repo.upsert(createSavedAnswer({ id: 's2', label: 'B', value: 'b' }));
    const after = await repo.remove('s1');
    expect(after.map((a) => a.id)).toEqual(['s2']);
  });
});

describe('Storage keys', () => {
  it('exposes the MVP storage buckets', () => {
    expect(Object.values(STORAGE_KEYS).sort()).toEqual(
      ['history', 'profile', 'queue', 'results', 'savedAnswers'].sort(),
    );
  });
});
