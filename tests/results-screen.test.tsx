import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ResultsScreen } from '../src/popup/screens/ResultsScreen';
import {
  createMemoryStorageAdapter,
  createQueueRepository,
  createResultsRepository,
  type QueueRepository,
  type ResultsRepository,
  type StorageAdapter,
} from '../src/modules/storage';
import { createJobListing } from '../src/modules/job-list';

let adapter: StorageAdapter;
let resultsRepo: ResultsRepository;
let queueRepo: QueueRepository;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  resultsRepo = createResultsRepository(adapter);
  queueRepo = createQueueRepository(adapter);
});

function renderScreen() {
  return render(
    <MemoryRouter>
      <ResultsScreen repository={resultsRepo} queueRepository={queueRepo} />
    </MemoryRouter>,
  );
}

describe('ResultsScreen (E5-S1)', () => {
  it('shows empty state when no results are persisted (T3)', async () => {
    renderScreen();
    expect(
      screen.getByText(/Nenhuma vaga importada ainda/),
    ).toBeInTheDocument();
  });

  it('renders persisted jobs with title, company, location and link (T3)', async () => {
    await resultsRepo.save([
      createJobListing({
        id: '1',
        title: 'Dev Sênior',
        company: 'Acme',
        location: 'Remote',
        url: 'https://www.linkedin.com/jobs/view/1',
      }),
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Dev Sênior')).toBeInTheDocument(),
    );
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Abrir no LinkedIn' }),
    ).toHaveAttribute('href', 'https://www.linkedin.com/jobs/view/1');
  });

  it('selects jobs and adds them to the queue (T4)', async () => {
    await resultsRepo.save([
      createJobListing({
        id: '1',
        title: 'Dev Sênior',
        company: 'Acme',
        url: 'https://x/1',
      }),
      createJobListing({
        id: '2',
        title: 'Designer',
        company: 'Beta',
        url: 'https://x/2',
      }),
    ]);

    renderScreen();

    await waitFor(() =>
      expect(screen.getByText('Dev Sênior')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByLabelText('Selecionar vaga Dev Sênior'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar à fila (1)' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        /Adicionadas 1 vaga/,
      ),
    );

    const queue = await queueRepo.list();
    expect(queue).toHaveLength(1);
    expect(queue[0].job.id).toBe('1');
    expect(queue[0].job.status).toBe('queued');

    const remaining = await resultsRepo.list();
    expect(remaining.find((j) => j.id === '1')?.status).toBe('selected');
    expect(remaining.find((j) => j.id === '2')?.status).toBe('discovered');
  });
});
