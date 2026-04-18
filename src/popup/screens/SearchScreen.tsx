import { useCallback, useMemo, useState } from 'react';
import {
  buildLinkedInJobsUrl,
  extractFromActiveTab,
  openLinkedInSearch,
  type ExtractFromActiveTabResult,
} from '../../modules/linkedin-search';
import {
  createResultsRepository,
  type ResultsRepository,
} from '../../modules/storage';

type Status = 'idle' | 'opening' | 'importing' | 'imported' | 'error';

interface SearchScreenProps {
  repository?: ResultsRepository;
  openSearch?: (url: string) => Promise<void>;
  extract?: () => Promise<ExtractFromActiveTabResult>;
}

export function SearchScreen({
  repository,
  openSearch,
  extract,
}: SearchScreenProps = {}) {
  const repo = useMemo(
    () => repository ?? createResultsRepository(),
    [repository],
  );
  const doOpen = openSearch ?? openLinkedInSearch;
  const doExtract = extract ?? extractFromActiveTab;

  const [keywords, setKeywords] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = useCallback(async () => {
    setStatus('opening');
    setError(null);
    setMessage(null);
    try {
      const url = buildLinkedInJobsUrl({ keywords, location });
      await doOpen(url);
      setStatus('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao abrir a busca.');
      setStatus('error');
    }
  }, [keywords, location, doOpen]);

  const handleImport = useCallback(async () => {
    setStatus('importing');
    setError(null);
    setMessage(null);
    try {
      const { listings } = await doExtract();
      const saved = await repo.merge(listings);
      setStatus('imported');
      setMessage(
        listings.length === 0
          ? 'Nenhuma vaga encontrada na aba atual.'
          : `Importadas ${listings.length} vaga(s). Total: ${saved.length}.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao importar vagas.',
      );
      setStatus('error');
    }
  }, [doExtract, repo]);

  return (
    <main className="screen" aria-labelledby="search-title">
      <h1 id="search-title" className="screen-title">Busca</h1>
      <p className="screen-hint">
        Abra o LinkedIn com palavras-chave e localização, depois importe as vagas
        encontradas para revisar em Resultados.
      </p>
      <form
        className="search-form"
        onSubmit={(event) => {
          event.preventDefault();
          void handleOpen();
        }}
      >
        <label>
          <span>Palavras-chave</span>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="ex.: desenvolvedor react"
          />
        </label>
        <label>
          <span>Localização</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="ex.: Brasil"
          />
        </label>
        <div className="search-actions">
          <button type="submit" disabled={status === 'opening'}>
            {status === 'opening' ? 'Abrindo...' : 'Abrir busca no LinkedIn'}
          </button>
          <button
            type="button"
            onClick={() => void handleImport()}
            disabled={status === 'importing'}
          >
            {status === 'importing' ? 'Importando...' : 'Importar vagas da aba atual'}
          </button>
        </div>
        {status === 'imported' && message && (
          <p role="status" className="save-status save-status-ok">
            {message}
          </p>
        )}
        {status === 'error' && error && (
          <p role="alert" className="save-status save-status-error">
            {error}
          </p>
        )}
      </form>
    </main>
  );
}
