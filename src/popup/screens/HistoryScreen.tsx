import { useEffect, useMemo, useState } from 'react';
import {
  createHistoryRepository,
  createQueueRepository,
  createResultsRepository,
  createSavedAnswersRepository,
  type HistoryRepository,
  type QueueRepository,
  type ResultsRepository,
  type SavedAnswersRepository,
} from '../../modules/storage';
import type { ApplicationAttempt, ApplicationResult, ApplicationPendingField } from '../../modules/executor';
import type { JobListing } from '../../modules/job-list';
import { createSavedAnswer, REUSE_MODES, type ReuseMode } from '../../modules/form-filler';

interface HistoryScreenProps {
  historyRepository?: HistoryRepository;
  queueRepository?: QueueRepository;
  resultsRepository?: ResultsRepository;
  savedAnswersRepository?: SavedAnswersRepository;
}

type ResultFilter = 'all' | ApplicationResult;

const RESULT_FILTERS: Array<{ value: ResultFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'success', label: 'Sucesso' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'failed', label: 'Falhas' },
  { value: 'skipped', label: 'Ignoradas' },
];

const RESULT_LABELS: Record<ApplicationResult, string> = {
  success: 'Sucesso',
  pending: 'Pendente',
  failed: 'Falhou',
  skipped: 'Ignorada',
};

const FIELD_TYPE_LABELS: Record<string, string> = {
  text: 'Texto',
  textarea: 'Texto longo',
  select: 'Seleção',
  radio: 'Escolha única',
  checkbox: 'Múltipla escolha',
  file: 'Upload',
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('pt-BR');
}

function platformLabel(source: JobListing['source'] | undefined): string {
  if (source === 'external') return 'Externa';
  if (source === 'linkedin') return 'LinkedIn';
  return 'Desconhecida';
}

const REUSE_MODE_LABELS: Record<ReuseMode, string> = {
  suggest: 'Sugerir',
  auto: 'Auto',
  confirm: 'Confirmar',
};

interface SaveAnswerForm {
  pendingKey: string;
  value: string;
  reuseMode: ReuseMode;
}

function pendingKey(attemptId: string, index: number): string {
  return `${attemptId}-${index}`;
}

export function HistoryScreen({
  historyRepository,
  queueRepository,
  resultsRepository,
  savedAnswersRepository,
}: HistoryScreenProps = {}) {
  const historyRepo = useMemo(
    () => historyRepository ?? createHistoryRepository(),
    [historyRepository],
  );
  const queueRepo = useMemo(
    () => queueRepository ?? createQueueRepository(),
    [queueRepository],
  );
  const resultsRepo = useMemo(
    () => resultsRepository ?? createResultsRepository(),
    [resultsRepository],
  );
  const savedAnswersRepo = useMemo(
    () => savedAnswersRepository ?? createSavedAnswersRepository(),
    [savedAnswersRepository],
  );

  const [attempts, setAttempts] = useState<ApplicationAttempt[]>([]);
  const [jobsById, setJobsById] = useState<Record<string, JobListing>>({});
  const [filter, setFilter] = useState<ResultFilter>('all');
  const [savingForm, setSavingForm] = useState<SaveAnswerForm | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const history = await historyRepo.list();
      if (cancelled || history.length === 0) return;
      const [queue, results] = await Promise.all([
        queueRepo.list(),
        resultsRepo.list(),
      ]);
      if (cancelled) return;
      const byId: Record<string, JobListing> = {};
      for (const job of results) byId[job.id] = job;
      for (const entry of queue) byId[entry.job.id] = entry.job;
      setJobsById(byId);
      setAttempts(history);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [historyRepo, queueRepo, resultsRepo]);

  const sortedAttempts = useMemo(() => {
    const copy = attempts.slice();
    copy.sort((a, b) => {
      const aDate = a.endedAt ?? a.startedAt;
      const bDate = b.endedAt ?? b.startedAt;
      return bDate.localeCompare(aDate);
    });
    return copy;
  }, [attempts]);

  const filtered = useMemo(() => {
    if (filter === 'all') return sortedAttempts;
    return sortedAttempts.filter((attempt) => attempt.result === filter);
  }, [sortedAttempts, filter]);

  const counts = useMemo(() => {
    const base: Record<ApplicationResult, number> = {
      success: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
    };
    for (const attempt of attempts) {
      base[attempt.result] += 1;
    }
    return base;
  }, [attempts]);

  function handleStartSave(attemptId: string, index: number) {
    const key = pendingKey(attemptId, index);
    setSavingForm({
      pendingKey: key,
      value: '',
      reuseMode: 'auto',
    });
    setSaveStatus(null);
  }

  async function handleSaveAnswer(pending: ApplicationPendingField) {
    if (!savingForm || !savingForm.value.trim()) return;
    const field = pending.field;
    const answer = createSavedAnswer({
      id: crypto.randomUUID(),
      label: field.label || field.name || field.id,
      value: savingForm.value.trim(),
      reuseMode: savingForm.reuseMode,
      fieldTypes: [field.type],
      keywords: [field.label, field.name, field.id, field.placeholder]
        .filter((k): k is string => !!k && k.length > 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    try {
      await savedAnswersRepo.upsert(answer);
      setSavedKeys((prev) => new Set(prev).add(savingForm.pendingKey));
      setSavingForm(null);
      setSaveStatus('Resposta salva com sucesso!');
    } catch {
      setSaveStatus('Erro ao salvar resposta.');
    }
  }

  if (attempts.length === 0) {
    return (
      <main className="screen" aria-labelledby="history-title">
        <h1 id="history-title" className="screen-title">Histórico</h1>
        <p className="screen-hint">
          Nenhuma candidatura registrada ainda. Assim que a fila processar uma
          vaga, o resultado aparecerá aqui.
        </p>
      </main>
    );
  }

  return (
    <main className="screen" aria-labelledby="history-title">
      <h1 id="history-title" className="screen-title">Histórico</h1>
      <p className="screen-hint">
        {attempts.length} candidatura(s) registrada(s): {counts.success} sucesso,{' '}
        {counts.pending} pendente(s), {counts.failed} falha(s),{' '}
        {counts.skipped} ignorada(s).
      </p>
      <div className="history-filters" role="tablist" aria-label="Filtrar por resultado">
        {RESULT_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={filter === option.value}
            className={filter === option.value ? 'active' : ''}
            onClick={() => setFilter(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {saveStatus && (
        <p role="status" className="save-answer-status">{saveStatus}</p>
      )}

      {filtered.length === 0 ? (
        <p className="screen-hint">Nenhuma candidatura neste filtro.</p>
      ) : (
        <ol className="history-list" aria-label="Candidaturas registradas">
          {filtered.map((attempt) => {
            const job = jobsById[attempt.jobId];
            const platform = platformLabel(job?.source);
            return (
              <li
                key={attempt.id}
                className="history-row"
                data-result={attempt.result}
              >
                <header className="history-row-header">
                  <div className="history-meta">
                    <strong className="history-title">
                      {job?.title ?? 'Vaga desconhecida'}
                    </strong>
                    {job?.company && (
                      <span className="history-company">{job.company}</span>
                    )}
                    {job?.location && (
                      <span className="history-location">{job.location}</span>
                    )}
                  </div>
                  <span
                    className="history-result"
                    data-result={attempt.result}
                    aria-label={`Resultado: ${RESULT_LABELS[attempt.result]}`}
                  >
                    {RESULT_LABELS[attempt.result]}
                  </span>
                </header>
                <dl className="history-details">
                  <div>
                    <dt>Plataforma</dt>
                    <dd>{platform}</dd>
                  </div>
                  <div>
                    <dt>Iniciado</dt>
                    <dd>{formatDate(attempt.startedAt)}</dd>
                  </div>
                  <div>
                    <dt>Encerrado</dt>
                    <dd>{formatDate(attempt.endedAt)}</dd>
                  </div>
                  {attempt.currentStep !== undefined && (
                    <div>
                      <dt>Último step</dt>
                      <dd>{attempt.currentStep}</dd>
                    </div>
                  )}
                </dl>

                {attempt.pendings.length > 0 && (
                  <section
                    className="history-pendings"
                    aria-labelledby={`pendings-${attempt.id}`}
                  >
                    <h3 id={`pendings-${attempt.id}`}>
                      Pendências ({attempt.pendings.length})
                    </h3>
                    <ul>
                      {attempt.pendings.map((pending, index) => {
                        const field = pending.field;
                        const typeLabel = FIELD_TYPE_LABELS[field.type] ?? field.type;
                        const pKey = pendingKey(attempt.id, index);
                        const isSaved = savedKeys.has(pKey);
                        const isEditing = savingForm?.pendingKey === pKey;
                        return (
                          <li
                            key={`${field.id}-${index}`}
                            className="history-pending"
                            data-field-type={field.type}
                          >
                            <p className="history-pending-label">
                              {field.label || field.name || field.id}
                              {field.required && (
                                <span className="history-pending-required">
                                  {' '}
                                  (obrigatório)
                                </span>
                              )}
                            </p>
                            <dl className="history-pending-meta">
                              <div>
                                <dt>Tipo</dt>
                                <dd>{typeLabel}</dd>
                              </div>
                              <div>
                                <dt>Plataforma</dt>
                                <dd>{platform}</dd>
                              </div>
                              {pending.reason && (
                                <div>
                                  <dt>Motivo</dt>
                                  <dd>{pending.reason}</dd>
                                </div>
                              )}
                            </dl>
                            {field.options.length > 0 && (
                              <div className="history-pending-options">
                                <span>Opções:</span>
                                <ul>
                                  {field.options.map((option) => (
                                    <li key={option.value}>{option.label}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {!isSaved && !isEditing && field.type !== 'file' && (
                              <button
                                type="button"
                                className="save-answer-btn"
                                onClick={() => handleStartSave(attempt.id, index)}
                              >
                                Salvar resposta
                              </button>
                            )}
                            {isSaved && (
                              <span className="save-answer-done" role="status">Resposta salva</span>
                            )}
                            {isEditing && (
                              <div className="save-answer-form">
                                <input
                                  type="text"
                                  placeholder="Valor da resposta"
                                  value={savingForm.value}
                                  aria-label="Valor da resposta"
                                  onChange={(e) =>
                                    setSavingForm({ ...savingForm, value: e.target.value })
                                  }
                                />
                                <select
                                  value={savingForm.reuseMode}
                                  aria-label="Modo de reutilização"
                                  onChange={(e) =>
                                    setSavingForm({
                                      ...savingForm,
                                      reuseMode: e.target.value as ReuseMode,
                                    })
                                  }
                                >
                                  {REUSE_MODES.map((mode) => (
                                    <option key={mode} value={mode}>
                                      {REUSE_MODE_LABELS[mode]}
                                    </option>
                                  ))}
                                </select>
                                <div className="save-answer-actions">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveAnswer(pending)}
                                    disabled={!savingForm.value.trim()}
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSavingForm(null)}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {attempt.failures.length > 0 && (
                  <section
                    className="history-failures"
                    aria-labelledby={`failures-${attempt.id}`}
                  >
                    <h3 id={`failures-${attempt.id}`}>
                      Falhas ({attempt.failures.length})
                    </h3>
                    <ul>
                      {attempt.failures.map((failure, index) => (
                        <li key={index} className="history-failure">
                          {failure.step !== undefined && (
                            <span className="history-failure-step">
                              step {failure.step}:{' '}
                            </span>
                          )}
                          {failure.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}
