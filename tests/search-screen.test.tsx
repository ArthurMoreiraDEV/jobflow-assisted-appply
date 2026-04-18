import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SearchScreen } from '../src/popup/screens/SearchScreen';
import {
  createMemoryStorageAdapter,
  createResultsRepository,
  type ResultsRepository,
} from '../src/modules/storage';
import { createJobListing } from '../src/modules/job-list';

let repository: ResultsRepository;

beforeEach(() => {
  repository = createResultsRepository(createMemoryStorageAdapter());
});

function renderScreen(overrides: {
  openSearch?: (url: string) => Promise<void>;
  extract?: () => Promise<{
    listings: ReturnType<typeof createJobListing>[];
    tabUrl: string;
    onLinkedInJobs: boolean;
  }>;
}) {
  return render(
    <MemoryRouter>
      <SearchScreen
        repository={repository}
        openSearch={overrides.openSearch}
        extract={overrides.extract}
      />
    </MemoryRouter>,
  );
}

describe('SearchScreen (E5-S1)', () => {
  it('opens a LinkedIn search URL built from the form inputs (T1)', async () => {
    const openSearch = vi.fn().mockResolvedValue(undefined);
    renderScreen({ openSearch });

    fireEvent.change(screen.getByLabelText('Palavras-chave'), {
      target: { value: 'react dev' },
    });
    fireEvent.change(screen.getByLabelText('Localização'), {
      target: { value: 'Brasil' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Abrir busca no LinkedIn' }),
    );

    await waitFor(() => expect(openSearch).toHaveBeenCalledTimes(1));
    const url = openSearch.mock.calls[0][0];
    expect(url).toContain('keywords=react+dev');
    expect(url).toContain('location=Brasil');
  });

  it('imports jobs from the active tab and persists them (T2)', async () => {
    const listings = [
      createJobListing({
        id: 'job-1',
        title: 'Dev',
        company: 'Acme',
        url: 'https://www.linkedin.com/jobs/view/job-1',
      }),
    ];
    const extract = vi.fn().mockResolvedValue({
      listings,
      tabUrl: 'https://www.linkedin.com/jobs/search/',
      onLinkedInJobs: true,
    });

    renderScreen({ extract });

    fireEvent.click(
      screen.getByRole('button', { name: 'Importar vagas da aba atual' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(/Importadas 1/),
    );

    const persisted = await repository.list();
    expect(persisted).toHaveLength(1);
    expect(persisted[0].id).toBe('job-1');
  });

  it('shows an error when extraction fails', async () => {
    const extract = vi.fn().mockRejectedValue(new Error('aba errada'));
    renderScreen({ extract });

    fireEvent.click(
      screen.getByRole('button', { name: 'Importar vagas da aba atual' }),
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('aba errada'),
    );
  });
});
