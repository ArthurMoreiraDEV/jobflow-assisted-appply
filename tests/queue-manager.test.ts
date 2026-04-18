import { beforeEach, describe, expect, it } from 'vitest';
import { createJobListing } from '../src/modules/job-list';
import {
  createMemoryStorageAdapter,
  createQueueRepository,
  type QueueRepository,
  type StorageAdapter,
} from '../src/modules/storage';
import {
  InvalidJobStatusTransitionError,
  allowedJobStatusTransitions,
  createQueueManager,
  isValidJobStatusTransition,
} from '../src/modules/queue-manager';

let adapter: StorageAdapter;
let repo: QueueRepository;

beforeEach(async () => {
  adapter = createMemoryStorageAdapter();
  repo = createQueueRepository(adapter);
  await repo.upsert(
    createJobListing({
      id: 'j1',
      title: 'A',
      company: 'X',
      url: 'u1',
      status: 'queued',
    }),
  );
  await repo.upsert(
    createJobListing({
      id: 'j2',
      title: 'B',
      company: 'Y',
      url: 'u2',
      status: 'queued',
    }),
  );
});

describe('status transitions (E6-S1-T3)', () => {
  it('accepts the MVP pipeline transitions', () => {
    expect(isValidJobStatusTransition('discovered', 'selected')).toBe(true);
    expect(isValidJobStatusTransition('selected', 'queued')).toBe(true);
    expect(isValidJobStatusTransition('queued', 'processing')).toBe(true);
    expect(isValidJobStatusTransition('processing', 'success')).toBe(true);
    expect(isValidJobStatusTransition('processing', 'pending')).toBe(true);
    expect(isValidJobStatusTransition('processing', 'failed')).toBe(true);
    expect(isValidJobStatusTransition('pending', 'processing')).toBe(true);
    expect(isValidJobStatusTransition('failed', 'queued')).toBe(true);
    expect(isValidJobStatusTransition('skipped', 'queued')).toBe(true);
  });

  it('rejects invalid jumps', () => {
    expect(isValidJobStatusTransition('discovered', 'processing')).toBe(false);
    expect(isValidJobStatusTransition('queued', 'success')).toBe(false);
    expect(isValidJobStatusTransition('success', 'processing')).toBe(false);
  });

  it('exposes the allowed transitions list', () => {
    expect(allowedJobStatusTransitions('processing')).toEqual([
      'success',
      'pending',
      'failed',
      'skipped',
    ]);
  });
});

describe('QueueManager (E6-S1-T2)', () => {
  it('processes queued jobs one at a time through the pipeline', async () => {
    const manager = createQueueManager(repo);
    const order: string[] = [];
    const statuses: string[] = [];

    const entry = await manager.processNext(async (queueEntry) => {
      order.push(queueEntry.job.id);
      statuses.push(queueEntry.job.status);
      return { status: 'success' };
    });

    expect(entry?.job.id).toBe('j1');
    expect(statuses).toEqual(['processing']);
    const list = await repo.list();
    expect(list.find((e) => e.job.id === 'j1')?.job.status).toBe('success');
    expect(list.find((e) => e.job.id === 'j2')?.job.status).toBe('queued');
    expect(order).toEqual(['j1']);
  });

  it('advances sequentially until the queue has no processable entries', async () => {
    const manager = createQueueManager(repo);
    const processed: string[] = [];

    await manager.start(async (queueEntry) => {
      processed.push(queueEntry.job.id);
      return { status: 'success' };
    });

    expect(processed).toEqual(['j1', 'j2']);
    const list = await repo.list();
    expect(list.map((e) => e.job.status)).toEqual(['success', 'success']);
    expect(manager.getState().isRunning).toBe(false);
  });

  it('marks failed jobs when the handler throws', async () => {
    const manager = createQueueManager(repo);
    await expect(
      manager.processNext(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    const list = await repo.list();
    expect(list.find((e) => e.job.id === 'j1')?.job.status).toBe('failed');
  });

  it('records pending and skips pending jobs in auto-processing', async () => {
    const manager = createQueueManager(repo);
    await manager.processNext(async () => ({ status: 'pending' }));
    let list = await repo.list();
    expect(list.find((e) => e.job.id === 'j1')?.job.status).toBe('pending');

    await manager.processNext(async () => ({ status: 'success' }));
    list = await repo.list();
    expect(list.find((e) => e.job.id === 'j1')?.job.status).toBe('pending');
    expect(list.find((e) => e.job.id === 'j2')?.job.status).toBe('success');
  });

  it('stops the run when stop() is called', async () => {
    await repo.upsert(
      createJobListing({ id: 'j3', title: 'C', company: 'Z', url: 'u3', status: 'queued' }),
    );
    const manager = createQueueManager(repo);
    let processed = 0;

    await manager.start(async () => {
      processed += 1;
      if (processed === 1) manager.stop();
      return { status: 'success' };
    });

    expect(processed).toBe(1);
    const list = await repo.list();
    expect(list.filter((e) => e.job.status === 'queued')).toHaveLength(2);
  });

  it('validates status transitions via setStatus', async () => {
    const manager = createQueueManager(repo);
    await expect(manager.setStatus('j1', 'success')).rejects.toBeInstanceOf(
      InvalidJobStatusTransitionError,
    );
    const updated = await manager.setStatus('j1', 'skipped');
    expect(updated.find((e) => e.job.id === 'j1')?.job.status).toBe('skipped');
  });

  it('returns null when the queue has nothing processable', async () => {
    await repo.clear();
    const manager = createQueueManager(repo);
    expect(await manager.processNext(async () => ({ status: 'success' }))).toBe(
      null,
    );
  });
});
