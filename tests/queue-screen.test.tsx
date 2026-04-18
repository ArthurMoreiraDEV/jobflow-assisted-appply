import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueueScreen } from '../src/popup/screens/QueueScreen';
import {
  createMemoryStorageAdapter,
  createQueueRepository,
  type QueueRepository,
  type StorageAdapter,
} from '../src/modules/storage';
import { createJobListing } from '../src/modules/job-list';

let adapter: StorageAdapter;
let repo: QueueRepository;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repo = createQueueRepository(adapter);
});

function renderScreen(extra?: { handler?: Parameters<typeof QueueScreen>[0] }) {
  return render(
    <MemoryRouter>
      <QueueScreen
        repository={repo}
        processHandler={extra?.handler?.processHandler}
      />
    </MemoryRouter>,
  );
}

describe('QueueScreen (E6-S1)', () => {
  it('shows empty state when nothing is queued', async () => {
    renderScreen();
    expect(
      screen.getByText(/Nenhuma vaga na fila/),
    ).toBeInTheDocument();
  });

  it('lists queued jobs with title, company and status (T1)', async () => {
    await repo.upsert(
      createJobListing({
        id: 'j1',
        title: 'Dev Sênior',
        company: 'Acme',
        location: 'Remote',
        url: 'u',
        status: 'queued',
      }),
    );
    renderScreen();
    await waitFor(() =>
      expect(screen.getByText('Dev Sênior')).toBeInTheDocument(),
    );
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Remote')).toBeInTheDocument();
    expect(screen.getByLabelText('Status: queued')).toBeInTheDocument();
  });

  it('starts sequential processing and updates statuses (T2, T3)', async () => {
    await repo.upsert(
      createJobListing({
        id: 'j1',
        title: 'Dev',
        company: 'Acme',
        url: 'u1',
        status: 'queued',
      }),
    );
    await repo.upsert(
      createJobListing({
        id: 'j2',
        title: 'Designer',
        company: 'Beta',
        url: 'u2',
        status: 'queued',
      }),
    );

    render(
      <MemoryRouter>
        <QueueScreen
          repository={repo}
          processHandler={async () => ({ status: 'success' })}
        />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText('Dev')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Iniciar fila' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(
      /Processamento concluído/,
    ));

    const entries = await repo.list();
    expect(entries.map((e) => e.job.status)).toEqual(['success', 'success']);
  });

  it('removes a queued job (T1)', async () => {
    await repo.upsert(
      createJobListing({
        id: 'j1',
        title: 'Dev',
        company: 'Acme',
        url: 'u',
        status: 'queued',
      }),
    );
    renderScreen();
    await waitFor(() => expect(screen.getByText('Dev')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Remover vaga Dev'));

    await waitFor(() =>
      expect(screen.queryByText('Dev')).not.toBeInTheDocument(),
    );
    expect(await repo.list()).toHaveLength(0);
  });

  it('allows marking pending jobs as success (T3)', async () => {
    await repo.upsert(
      createJobListing({
        id: 'j1',
        title: 'Dev',
        company: 'Acme',
        url: 'u',
        status: 'pending',
      }),
    );
    renderScreen();
    await waitFor(() => expect(screen.getByText('Dev')).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole('button', { name: 'Marcar como sucesso' }),
    );

    await waitFor(async () => {
      const list = await repo.list();
      expect(list[0].job.status).toBe('success');
    });
  });
});
