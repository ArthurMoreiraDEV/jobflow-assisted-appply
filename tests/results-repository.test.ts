import { describe, expect, it } from 'vitest';
import {
  createMemoryStorageAdapter,
  createResultsRepository,
} from '../src/modules/storage';
import { createJobListing } from '../src/modules/job-list';

describe('ResultsRepository', () => {
  it('saves and lists job listings', async () => {
    const repo = createResultsRepository(createMemoryStorageAdapter());
    expect(await repo.list()).toEqual([]);
    await repo.save([createJobListing({ id: '1', title: 'Dev', company: 'Acme', url: 'x' })]);
    const listed = await repo.list();
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe('1');
  });

  it('merges new jobs preserving existing status', async () => {
    const repo = createResultsRepository(createMemoryStorageAdapter());
    await repo.save([
      createJobListing({
        id: '1',
        title: 'Dev',
        company: 'Acme',
        url: 'x',
        status: 'selected',
      }),
    ]);
    await repo.merge([
      createJobListing({
        id: '1',
        title: 'Dev Updated',
        company: 'Acme',
        url: 'x',
      }),
      createJobListing({
        id: '2',
        title: 'Designer',
        company: 'Beta',
        url: 'y',
      }),
    ]);
    const listed = await repo.list();
    expect(listed).toHaveLength(2);
    const first = listed.find((j) => j.id === '1');
    expect(first?.title).toBe('Dev Updated');
    expect(first?.status).toBe('selected');
  });

  it('removes jobs by id and clears all', async () => {
    const repo = createResultsRepository(createMemoryStorageAdapter());
    await repo.save([
      createJobListing({ id: '1', title: 'A', company: 'x', url: 'x' }),
      createJobListing({ id: '2', title: 'B', company: 'x', url: 'x' }),
    ]);
    await repo.remove('1');
    expect((await repo.list()).map((j) => j.id)).toEqual(['2']);
    await repo.clear();
    expect(await repo.list()).toEqual([]);
  });
});
