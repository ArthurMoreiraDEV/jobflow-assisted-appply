import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCandidateProfile } from '../src/modules/profile';
import { createJobListing } from '../src/modules/job-list';
import {
  createHistoryRepository,
  createMemoryStorageAdapter,
  type HistoryRepository,
  type QueueEntry,
  type StorageAdapter,
} from '../src/modules/storage';
import {
  buildExecutorQueueHandler,
  createApplicationExecutor,
  createDocumentDriver,
  type PageDriver,
} from '../src/modules/executor';

function htmlDoc(markup: string): Document {
  const doc = document.implementation.createHTMLDocument('executor');
  doc.body.innerHTML = markup;
  return doc;
}

function makeEntry(overrides: Partial<QueueEntry['job']> = {}): QueueEntry {
  return {
    position: 0,
    job: createJobListing({
      id: 'job-1',
      title: 'Dev',
      company: 'Co',
      url: 'https://linkedin.com/jobs/view/1',
      status: 'queued',
      ...overrides,
    }),
  };
}

let adapter: StorageAdapter;
let history: HistoryRepository;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  history = createHistoryRepository(adapter);
});

describe('ApplicationExecutor (E9-S1)', () => {
  it('T1 - opens the job url via the driver before running the loop', async () => {
    const doc = htmlDoc(`
      <form>
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required />
        <button type="button" data-easy-apply-submit>Enviar</button>
      </form>
    `);
    const open = vi.fn(async (_url: string) => undefined);
    const driver: PageDriver = {
      open,
      getRoot: () => doc,
      advance: async () => ({ kind: 'submitted' }),
    };

    const profile = createCandidateProfile({
      fullName: 'Ana',
      contact: { email: 'ana@example.com' },
    });
    const executor = createApplicationExecutor({
      profile,
      now: () => '2026-04-17T00:00:00.000Z',
      idGenerator: () => 'att-1',
    });
    const entry = makeEntry();

    const result = await executor.run(entry, driver);

    expect(open).toHaveBeenCalledWith('https://linkedin.com/jobs/view/1');
    expect(result.status).toBe('success');
    expect(result.attempt.result).toBe('success');
    expect(result.attempt.jobId).toBe('job-1');
    expect(result.attempt.logs.some((log) => log.message.includes('Vaga aberta'))).toBe(true);
  });

  it('T2 - runs the step loop, filling each step before advancing, and only succeeds on submit', async () => {
    const docStep1 = htmlDoc(`
      <section data-form-step="1">
        <label for="name">Nome completo</label>
        <input id="name" name="fullName" type="text" required />
      </section>
    `);
    const docStep2 = htmlDoc(`
      <section data-form-step="2">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required />
      </section>
    `);
    const docs = [docStep1, docStep2];
    let current = 0;

    const driver: PageDriver = {
      getRoot: () => docs[current],
      advance: async () => {
        if (current === 0) {
          current = 1;
          return { kind: 'advanced' };
        }
        return { kind: 'submitted' };
      },
    };

    const profile = createCandidateProfile({
      fullName: 'Ana Silva',
      contact: { email: 'ana@example.com' },
    });
    const executor = createApplicationExecutor({
      profile,
      idGenerator: () => 'att-multi',
    });

    const result = await executor.run(makeEntry(), driver);

    expect(result.status).toBe('success');
    expect((docStep1.getElementById('name') as HTMLInputElement).value).toBe(
      'Ana Silva',
    );
    expect((docStep2.getElementById('email') as HTMLInputElement).value).toBe(
      'ana@example.com',
    );
    const steps = result.attempt.logs
      .filter((log) => log.message.startsWith('Processando step'))
      .map((log) => log.step);
    expect(steps).toEqual([1, 2]);
  });

  it('T3 - fills file upload fields from the candidate resume', async () => {
    const pdfBytes = 'JVBERi0xLjQKJeLjz9MKCg==';
    const doc = htmlDoc(`
      <form>
        <label for="resume">Currículo (PDF)</label>
        <input id="resume" name="resume" type="file" accept="application/pdf" required />
        <button type="button" data-easy-apply-submit>Enviar</button>
      </form>
    `);

    const profile = createCandidateProfile({
      fullName: 'Ana',
      contact: { email: 'ana@example.com' },
      resume: {
        fileName: 'ana.pdf',
        mimeType: 'application/pdf',
        dataUrl: `data:application/pdf;base64,${pdfBytes}`,
        updatedAt: new Date(0).toISOString(),
      },
    });

    const driver = createDocumentDriver({ root: doc });
    const executor = createApplicationExecutor({
      profile,
      idGenerator: () => 'att-file',
    });
    const result = await executor.run(makeEntry(), driver);

    expect(result.status).toBe('success');
    const input = doc.getElementById('resume') as HTMLInputElement;
    expect(input.files?.length).toBe(1);
    expect(input.files?.[0].name).toBe('ana.pdf');
    expect(result.attempt.filledFields).toContain('resume');
  });

  it('T4 - records pending fields and returns pending status without submitting', async () => {
    const doc = htmlDoc(`
      <form>
        <label for="q1">Tem disponibilidade para mudança?</label>
        <input id="q1" name="mysteryCustomField" type="text" required />
        <button type="button" data-easy-apply-submit>Enviar</button>
      </form>
    `);

    const advance = vi.fn();
    const driver: PageDriver = {
      getRoot: () => doc,
      advance,
    };

    const profile = createCandidateProfile({
      fullName: 'Ana',
      contact: { email: 'ana@example.com' },
    });
    const executor = createApplicationExecutor({
      profile,
      history,
      idGenerator: () => 'att-pending',
      now: () => '2026-04-17T01:00:00.000Z',
    });

    const result = await executor.run(makeEntry(), driver);

    expect(result.status).toBe('pending');
    expect(result.attempt.result).toBe('pending');
    expect(result.attempt.pendings).toHaveLength(1);
    expect(result.attempt.pendings[0].field.label).toBe(
      'Tem disponibilidade para mudança?',
    );
    expect(advance).not.toHaveBeenCalled();

    const stored = await history.list();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('att-pending');
    expect(stored[0].pendings).toHaveLength(1);
  });

  it('T4 - records driver validation errors as failures', async () => {
    const doc = htmlDoc(`
      <form>
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required />
        <div role="alert">E-mail inválido</div>
      </form>
    `);

    const profile = createCandidateProfile({
      fullName: 'Ana',
      contact: { email: 'ana@example.com' },
    });
    const driver = createDocumentDriver({ root: doc });
    const executor = createApplicationExecutor({
      profile,
      history,
      idGenerator: () => 'att-fail',
    });

    const result = await executor.run(makeEntry(), driver);

    expect(result.status).toBe('failed');
    expect(result.attempt.failures).toHaveLength(1);
    expect(result.attempt.failures[0].message).toContain('E-mail inválido');
    const stored = await history.list();
    expect(stored[0].result).toBe('failed');
  });

  it('T4 - catches driver exceptions and stores them as failures', async () => {
    const doc = htmlDoc(`
      <form>
        <button type="button" data-easy-apply-submit>Enviar</button>
      </form>
    `);
    const driver: PageDriver = {
      getRoot: () => doc,
      advance: async () => {
        throw new Error('navegação travou');
      },
    };
    const executor = createApplicationExecutor({
      history,
      idGenerator: () => 'att-throw',
    });

    const result = await executor.run(makeEntry(), driver);

    expect(result.status).toBe('failed');
    expect(result.attempt.failures.some((f) => f.message === 'navegação travou')).toBe(
      true,
    );
  });

  it('exposes a QueueProcessHandler via buildExecutorQueueHandler', async () => {
    const doc = htmlDoc(`
      <form>
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required />
        <button type="button" data-easy-apply-submit>Enviar</button>
      </form>
    `);
    const profile = createCandidateProfile({
      fullName: 'Ana',
      contact: { email: 'ana@example.com' },
    });
    const executor = createApplicationExecutor({ profile, idGenerator: () => 'att-q' });
    const handler = buildExecutorQueueHandler(executor, () =>
      createDocumentDriver({ root: doc }),
    );

    const outcome = await handler(makeEntry());
    expect(outcome.status).toBe('success');
  });
});

describe('createDocumentDriver', () => {
  it('prefers submit over next and returns submitted', async () => {
    const doc = htmlDoc(`
      <form>
        <button type="button" data-easy-apply-next>Avançar</button>
        <button type="button" data-easy-apply-submit>Enviar</button>
      </form>
    `);
    const driver = createDocumentDriver({ root: doc });
    const outcome = await driver.advance();
    expect(outcome.kind).toBe('submitted');
  });

  it('returns blocked when a validation alert is present', async () => {
    const doc = htmlDoc(`
      <form>
        <div role="alert">Obrigatório</div>
        <button type="button" data-easy-apply-next>Avançar</button>
      </form>
    `);
    const driver = createDocumentDriver({ root: doc });
    const outcome = await driver.advance();
    expect(outcome.kind).toBe('blocked');
    expect(outcome.message).toContain('Obrigatório');
  });
});
