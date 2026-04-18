import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobListing } from '../../modules/job-list';
import {
  createQueueRepository,
  createResultsRepository,
  type QueueRepository,
  type ResultsRepository,
} from '../../modules/storage';

type Status = 'idle' | 'adding' | 'added' | 'error';

interface ResultsScreenProps {
  repository?: ResultsRepository;
  queueRepository?: QueueRepository;
}

export function ResultsScreen({
  repository,
  queueRepository,
}: ResultsScreenProps = {}) {
  const repo = useMemo(
    () => repository ?? createResultsRepository(),
    [repository],
  );
  const queueRepo = useMemo(
    () => queueRepository ?? createQueueRepository(),
    [queueRepository],
  );

  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void repo.list().then((loaded) => {
      if (cancelled || loaded.length === 0) return;
      setJobs(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddToQueue = useCallback(async () => {
    if (selected.size === 0) return;
    setStatus('adding');
    setError(null);
    setMessage(null);
    try {
      const picks = jobs.filter((job) => selected.has(job.id));
      let added = 0;
      for (const job of picks) {
        await queueRepo.upsert({ ...job, status: 'queued' });
        added += 1;
      }
      const remaining = jobs.map((job) =>
        selected.has(job.id) ? { ...job, status: 'selected' as const } : job,
      );
      await repo.save(remaining);
      setJobs(remaining);
      setSelected(new Set());
      setStatus('added');
      setMessage(`Adicionadas ${added} vaga(s) à fila.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao adicionar à fila.',
      );
      setStatus('error');
    }
  }, [jobs, selected, queueRepo, repo]);

  const handleClear = useCallback(async () => {
    await repo.clear();
    setJobs([]);
    setSelected(new Set());
    setStatus('idle');
    setMessage(null);
    setError(null);
  }, [repo]);

  return (
    <main className="screen" aria-labelledby="results-title">
      <h1 id="results-title" className="screen-title">Resultados</h1>
      {jobs.length === 0 ? (
        <p className="screen-hint">
          Nenhuma vaga importada ainda. Use a aba Busca para importar vagas do
          LinkedIn.
        </p>
      ) : (
        <>
          <p className="screen-hint">
            {jobs.length} vaga(s) disponíveis. Selecione as que deseja adicionar
            à fila.
          </p>
          <ul className="results-list" aria-label="Vagas encontradas">
            {jobs.map((job) => (
              <li key={job.id} className="results-row">
                <label className="results-pick">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar vaga ${job.title}`}
                    checked={selected.has(job.id)}
                    onChange={() => toggle(job.id)}
                  />
                  <div className="results-info">
                    <strong className="results-title">{job.title}</strong>
                    <span className="results-company">{job.company}</span>
                    {job.location && (
                      <span className="results-location">{job.location}</span>
                    )}
                    {job.url && (
                      <a
                        className="results-link"
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Abrir no LinkedIn
                      </a>
                    )}
                    <span className="results-status" data-status={job.status}>
                      {job.status}
                    </span>
                  </div>
                </label>
              </li>
            ))}
          </ul>
          <div className="results-actions">
            <button
              type="button"
              onClick={() => void handleAddToQueue()}
              disabled={selected.size === 0 || status === 'adding'}
            >
              {status === 'adding'
                ? 'Adicionando...'
                : `Adicionar à fila (${selected.size})`}
            </button>
            <button
              type="button"
              onClick={() => void handleClear()}
              className="results-clear"
            >
              Limpar resultados
            </button>
          </div>
          {status === 'added' && message && (
            <p role="status" className="save-status save-status-ok">
              {message}
            </p>
          )}
          {status === 'error' && error && (
            <p role="alert" className="save-status save-status-error">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
}
