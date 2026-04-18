import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createQueueRepository,
  type QueueEntry,
  type QueueRepository,
} from '../../modules/storage';
import {
  createQueueManager,
  type QueueManager,
  type QueueProcessHandler,
  type TerminalJobStatus,
} from '../../modules/queue-manager';
import type { JobStatus } from '../../modules/job-list';

interface QueueScreenProps {
  repository?: QueueRepository;
  processHandler?: QueueProcessHandler;
}

type RunState = 'idle' | 'running' | 'stopping';

const DEFAULT_HANDLER: QueueProcessHandler = async () => ({ status: 'pending' });

function statusLabel(status: JobStatus): string {
  return status;
}

export function QueueScreen({
  repository,
  processHandler,
}: QueueScreenProps = {}) {
  const repo = useMemo(
    () => repository ?? createQueueRepository(),
    [repository],
  );
  const managerRef = useRef<QueueManager | null>(null);
  if (managerRef.current === null) {
    managerRef.current = createQueueManager(repo);
  }
  const manager = managerRef.current;
  const handler = processHandler ?? DEFAULT_HANDLER;

  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [runState, setRunState] = useState<RunState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await manager.list();
    setEntries(list);
  }, [manager]);

  useEffect(() => {
    let cancelled = false;
    void manager.list().then((loaded) => {
      if (cancelled) return;
      setEntries(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [manager]);

  const handleStart = useCallback(async () => {
    if (runState !== 'idle') return;
    setRunState('running');
    setError(null);
    setMessage(null);
    const wrapped: QueueProcessHandler = async (entry) => {
      setCurrentJobId(entry.job.id);
      await refresh();
      try {
        const outcome = await handler(entry);
        return outcome;
      } finally {
        setCurrentJobId(null);
        await refresh();
      }
    };
    try {
      await manager.start(wrapped);
      setMessage('Processamento concluído.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao processar fila.');
    } finally {
      setRunState('idle');
      setCurrentJobId(null);
      await refresh();
    }
  }, [handler, manager, refresh, runState]);

  const handleStop = useCallback(() => {
    if (runState !== 'running') return;
    manager.stop();
    setRunState('stopping');
  }, [manager, runState]);

  const handleMark = useCallback(
    async (jobId: string, status: TerminalJobStatus) => {
      setError(null);
      try {
        await manager.setStatus(jobId, status);
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transição inválida.');
      }
    },
    [manager, refresh],
  );

  const handleRequeue = useCallback(
    async (jobId: string, from: JobStatus) => {
      setError(null);
      try {
        if (from === 'failed' || from === 'skipped') {
          await manager.setStatus(jobId, 'queued');
        }
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Transição inválida.');
      }
    },
    [manager, refresh],
  );

  const handleRemove = useCallback(
    async (jobId: string) => {
      await manager.remove(jobId);
      await refresh();
    },
    [manager, refresh],
  );

  const hasProcessable = entries.some(
    (entry) => entry.job.status === 'queued' || entry.job.status === 'pending',
  );

  return (
    <main className="screen" aria-labelledby="queue-title">
      <h1 id="queue-title" className="screen-title">Fila</h1>
      {entries.length === 0 ? (
        <p className="screen-hint">
          Nenhuma vaga na fila. Use a aba Resultados para adicionar vagas.
        </p>
      ) : (
        <>
          <p className="screen-hint">
            {entries.length} vaga(s) na fila. O processamento é sequencial.
          </p>
          <div className="queue-actions">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={runState !== 'idle' || !hasProcessable}
            >
              {runState === 'running'
                ? 'Processando...'
                : runState === 'stopping'
                ? 'Parando...'
                : 'Iniciar fila'}
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={runState !== 'running'}
              className="queue-stop"
            >
              Parar
            </button>
          </div>
          <ol className="queue-list" aria-label="Vagas na fila">
            {entries.map((entry) => {
              const isCurrent = entry.job.id === currentJobId;
              return (
                <li
                  key={entry.job.id}
                  className="queue-row"
                  data-status={entry.job.status}
                  data-current={isCurrent || undefined}
                >
                  <div className="queue-info">
                    <span className="queue-position" aria-hidden="true">
                      {entry.position + 1}
                    </span>
                    <div className="queue-meta">
                      <strong className="queue-title">{entry.job.title}</strong>
                      <span className="queue-company">{entry.job.company}</span>
                      {entry.job.location && (
                        <span className="queue-location">
                          {entry.job.location}
                        </span>
                      )}
                      <span
                        className="queue-status"
                        data-status={entry.job.status}
                        aria-label={`Status: ${statusLabel(entry.job.status)}`}
                      >
                        {statusLabel(entry.job.status)}
                      </span>
                    </div>
                  </div>
                  <div className="queue-row-actions">
                    {entry.job.status === 'pending' && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleMark(entry.job.id, 'success')
                        }
                      >
                        Marcar como sucesso
                      </button>
                    )}
                    {(entry.job.status === 'failed' ||
                      entry.job.status === 'skipped') && (
                      <button
                        type="button"
                        onClick={() =>
                          void handleRequeue(entry.job.id, entry.job.status)
                        }
                      >
                        Reenfileirar
                      </button>
                    )}
                    {entry.job.status !== 'processing' && (
                      <button
                        type="button"
                        className="queue-remove"
                        onClick={() => void handleRemove(entry.job.id)}
                        aria-label={`Remover vaga ${entry.job.title}`}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
          {message && (
            <p role="status" className="save-status save-status-ok">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="save-status save-status-error">
              {error}
            </p>
          )}
        </>
      )}
    </main>
  );
}
