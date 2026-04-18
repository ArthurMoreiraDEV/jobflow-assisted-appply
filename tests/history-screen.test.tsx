import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HistoryScreen } from '../src/popup/screens/HistoryScreen';
import {
  createHistoryRepository,
  createMemoryStorageAdapter,
  createQueueRepository,
  createResultsRepository,
  type HistoryRepository,
  type QueueRepository,
  type ResultsRepository,
  type StorageAdapter,
} from '../src/modules/storage';
import { createJobListing } from '../src/modules/job-list';
import {
  createApplicationAttempt,
  type ApplicationAttempt,
} from '../src/modules/executor';
import { createFormField } from '../src/modules/form-parser';

let adapter: StorageAdapter;
let historyRepo: HistoryRepository;
let queueRepo: QueueRepository;
let resultsRepo: ResultsRepository;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  historyRepo = createHistoryRepository(adapter);
  queueRepo = createQueueRepository(adapter);
  resultsRepo = createResultsRepository(adapter);
});

function renderScreen() {
  return render(
    <MemoryRouter>
      <HistoryScreen
        historyRepository={historyRepo}
        queueRepository={queueRepo}
        resultsRepository={resultsRepo}
      />
    </MemoryRouter>,
  );
}

function seedAttempt(overrides: Partial<ApplicationAttempt>): ApplicationAttempt {
  return createApplicationAttempt({
    id: overrides.id ?? 'a1',
    jobId: overrides.jobId ?? 'j1',
    startedAt: '2026-04-17T10:00:00.000Z',
    endedAt: '2026-04-17T10:05:00.000Z',
    result: 'success',
    logs: [],
    pendings: [],
    failures: [],
    filledFields: [],
    ...overrides,
  });
}

describe('HistoryScreen (E11-S1)', () => {
  it('renders an empty state when there is no history', async () => {
    renderScreen();
    await waitFor(() =>
      expect(
        screen.getByText(/Nenhuma candidatura registrada ainda/),
      ).toBeInTheDocument(),
    );
  });

  it('lists attempts across success, pending, failed and skipped results (T1)', async () => {
    await resultsRepo.save([
      createJobListing({ id: 'j1', title: 'Dev', company: 'Acme', url: 'u1' }),
      createJobListing({ id: 'j2', title: 'Designer', company: 'Beta', url: 'u2' }),
      createJobListing({ id: 'j3', title: 'PM', company: 'Gamma', url: 'u3' }),
      createJobListing({ id: 'j4', title: 'QA', company: 'Delta', url: 'u4' }),
    ]);
    await historyRepo.save([
      seedAttempt({ id: 'a1', jobId: 'j1', result: 'success' }),
      seedAttempt({ id: 'a2', jobId: 'j2', result: 'pending' }),
      seedAttempt({ id: 'a3', jobId: 'j3', result: 'failed' }),
      seedAttempt({ id: 'a4', jobId: 'j4', result: 'skipped' }),
    ]);

    renderScreen();

    await waitFor(() => expect(screen.getByText('Dev')).toBeInTheDocument());
    expect(screen.getByText('Designer')).toBeInTheDocument();
    expect(screen.getByText('PM')).toBeInTheDocument();
    expect(screen.getByText('QA')).toBeInTheDocument();
    expect(screen.getByLabelText('Resultado: Sucesso')).toBeInTheDocument();
    expect(screen.getByLabelText('Resultado: Pendente')).toBeInTheDocument();
    expect(screen.getByLabelText('Resultado: Falhou')).toBeInTheDocument();
    expect(screen.getByLabelText('Resultado: Ignorada')).toBeInTheDocument();
  });

  it('filters attempts by result tab (T1)', async () => {
    await resultsRepo.save([
      createJobListing({ id: 'j1', title: 'Dev', company: 'Acme', url: 'u1' }),
      createJobListing({ id: 'j2', title: 'Designer', company: 'Beta', url: 'u2' }),
    ]);
    await historyRepo.save([
      seedAttempt({ id: 'a1', jobId: 'j1', result: 'success' }),
      seedAttempt({ id: 'a2', jobId: 'j2', result: 'failed' }),
    ]);

    renderScreen();
    await waitFor(() => expect(screen.getByText('Dev')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Falhas' }));

    await waitFor(() =>
      expect(screen.queryByText('Dev')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Designer')).toBeInTheDocument();
  });

  it('shows pending fields with original label, type, platform and options (T2)', async () => {
    await resultsRepo.save([
      createJobListing({
        id: 'j1',
        title: 'Dev',
        company: 'Acme',
        url: 'u1',
        source: 'external',
      }),
    ]);
    const field = createFormField({
      id: 'f1',
      type: 'select',
      label: 'Nível de experiência',
      required: true,
      options: [
        { value: 'jr', label: 'Júnior' },
        { value: 'sr', label: 'Sênior' },
      ],
    });
    await historyRepo.save([
      seedAttempt({
        id: 'a1',
        jobId: 'j1',
        result: 'pending',
        pendings: [
          {
            field,
            reason: 'Campo obrigatório sem resposta confiável.',
            createdAt: '2026-04-17T10:04:00.000Z',
          },
        ],
      }),
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Nível de experiência')).toBeInTheDocument(),
    );
    expect(screen.getByText(/\(obrigatório\)/)).toBeInTheDocument();
    expect(screen.getByText('Seleção')).toBeInTheDocument();
    const platformDefs = screen.getAllByText('Externa');
    expect(platformDefs.length).toBeGreaterThan(0);
    expect(
      screen.getByText('Campo obrigatório sem resposta confiável.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Júnior')).toBeInTheDocument();
    expect(screen.getByText('Sênior')).toBeInTheDocument();
  });

  it('falls back to "Vaga desconhecida" when the job is no longer around', async () => {
    await historyRepo.save([
      seedAttempt({ id: 'a1', jobId: 'missing', result: 'success' }),
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Vaga desconhecida')).toBeInTheDocument(),
    );
  });

  it('shows failures captured during the attempt', async () => {
    await resultsRepo.save([
      createJobListing({ id: 'j1', title: 'Dev', company: 'Acme', url: 'u1' }),
    ]);
    await historyRepo.save([
      seedAttempt({
        id: 'a1',
        jobId: 'j1',
        result: 'failed',
        failures: [
          {
            at: '2026-04-17T10:04:30.000Z',
            step: 2,
            message: 'Botão Enviar indisponível.',
          },
        ],
      }),
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Botão Enviar indisponível.')).toBeInTheDocument(),
    );
    expect(screen.getByText(/step 2/)).toBeInTheDocument();
  });
});
