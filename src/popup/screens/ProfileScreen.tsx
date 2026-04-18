import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createCandidateProfile,
  type CandidateProfile,
  type ResumeFile,
} from '../../modules/profile';
import {
  createProfileRepository,
  createSavedAnswersRepository,
  type ProfileRepository,
  type SavedAnswersRepository,
} from '../../modules/storage';
import { type SavedAnswer, type ReuseMode, REUSE_MODES } from '../../modules/form-filler';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ProfileScreenProps {
  repository?: ProfileRepository;
  savedAnswersRepository?: SavedAnswersRepository;
}

const REUSE_MODE_LABELS: Record<ReuseMode, string> = {
  suggest: 'Sugerir',
  auto: 'Auto',
  confirm: 'Confirmar',
};

interface AnswerRow {
  key: string;
  originalKey: string;
  value: string;
}

function toAnswerRows(answers: Record<string, string>): AnswerRow[] {
  return Object.entries(answers).map(([key, value]) => ({
    key,
    originalKey: key,
    value,
  }));
}

function answerRowsToRecord(rows: AnswerRow[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    record[key] = row.value;
  }
  return record;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsDataURL(file);
  });
}

export function ProfileScreen({ repository, savedAnswersRepository }: ProfileScreenProps = {}) {
  const repo = useMemo(
    () => repository ?? createProfileRepository(),
    [repository],
  );
  const savedAnswersRepo = useMemo(
    () => savedAnswersRepository ?? createSavedAnswersRepository(),
    [savedAnswersRepository],
  );
  const [profile, setProfile] = useState<CandidateProfile>(() =>
    createCandidateProfile(),
  );
  const [answers, setAnswers] = useState<AnswerRow[]>([]);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resumeInputRef = useRef<HTMLInputElement | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<SavedAnswer[]>([]);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editReuseMode, setEditReuseMode] = useState<ReuseMode>('auto');

  useEffect(() => {
    let cancelled = false;
    void repo.load().then((loaded) => {
      if (cancelled || !loaded) return;
      setProfile(loaded);
      setAnswers(toAnswerRows(loaded.customAnswers));
    });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  useEffect(() => {
    let cancelled = false;
    void savedAnswersRepo.list().then((loaded) => {
      if (cancelled || loaded.length === 0) return;
      setSavedAnswers(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [savedAnswersRepo]);

  const updateContact = useCallback(
    <K extends keyof CandidateProfile['contact']>(
      key: K,
      value: CandidateProfile['contact'][K],
    ) => {
      setProfile((prev) => ({
        ...prev,
        contact: { ...prev.contact, [key]: value },
      }));
    },
    [],
  );

  const handleResumeChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataUrl(file);
        const resume: ResumeFile = {
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          dataUrl,
          updatedAt: new Date().toISOString(),
        };
        setProfile((prev) => ({ ...prev, resume }));
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Falha ao ler o currículo',
        );
        setStatus('error');
      } finally {
        if (resumeInputRef.current) resumeInputRef.current.value = '';
      }
    },
    [],
  );

  const handleResumeRemove = useCallback(() => {
    setProfile((prev) => ({ ...prev, resume: undefined }));
  }, []);

  const handleAnswerChange = useCallback(
    (index: number, field: 'key' | 'value', value: string) => {
      setAnswers((prev) =>
        prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
      );
    },
    [],
  );

  const handleAnswerRemove = useCallback((index: number) => {
    setAnswers((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAnswerAdd = useCallback(() => {
    setAnswers((prev) => [...prev, { key: '', originalKey: '', value: '' }]);
  }, []);

  const handleEditSavedAnswer = useCallback((answer: SavedAnswer) => {
    setEditingAnswerId(answer.id);
    setEditValue(answer.value);
    setEditReuseMode(answer.reuseMode);
  }, []);

  const handleSaveEditedAnswer = useCallback(async () => {
    if (!editingAnswerId || !editValue.trim()) return;
    const existing = savedAnswers.find((a) => a.id === editingAnswerId);
    if (!existing) return;
    const updated: SavedAnswer = {
      ...existing,
      value: editValue.trim(),
      reuseMode: editReuseMode,
    };
    const list = await savedAnswersRepo.upsert(updated);
    setSavedAnswers(list);
    setEditingAnswerId(null);
  }, [editingAnswerId, editValue, editReuseMode, savedAnswers, savedAnswersRepo]);

  const handleRemoveSavedAnswer = useCallback(async (answerId: string) => {
    const list = await savedAnswersRepo.remove(answerId);
    setSavedAnswers(list);
    if (editingAnswerId === answerId) setEditingAnswerId(null);
  }, [savedAnswersRepo, editingAnswerId]);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setStatus('saving');
      setErrorMessage(null);
      try {
        const toSave: CandidateProfile = {
          ...profile,
          customAnswers: answerRowsToRecord(answers),
        };
        const saved = await repo.save(toSave);
        setProfile(saved);
        setAnswers(toAnswerRows(saved.customAnswers));
        setStatus('saved');
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : 'Falha ao salvar o perfil',
        );
        setStatus('error');
      }
    },
    [profile, answers, repo],
  );

  return (
    <main className="screen" aria-labelledby="profile-title">
      <h1 id="profile-title" className="screen-title">Perfil</h1>
      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="profile-section">
          <legend>Dados pessoais</legend>
          <label>
            <span>Nome completo</span>
            <input
              type="text"
              value={profile.fullName}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, fullName: e.target.value }))
              }
              required
            />
          </label>
          <label>
            <span>Título profissional</span>
            <input
              type="text"
              value={profile.headline ?? ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, headline: e.target.value }))
              }
            />
          </label>
          <label>
            <span>Resumo</span>
            <textarea
              rows={3}
              value={profile.summary ?? ''}
              onChange={(e) =>
                setProfile((prev) => ({ ...prev, summary: e.target.value }))
              }
            />
          </label>
        </fieldset>

        <fieldset className="profile-section">
          <legend>Contato</legend>
          <label>
            <span>E-mail</span>
            <input
              type="email"
              value={profile.contact.email}
              onChange={(e) => updateContact('email', e.target.value)}
              required
            />
          </label>
          <label>
            <span>Telefone</span>
            <input
              type="tel"
              value={profile.contact.phone ?? ''}
              onChange={(e) => updateContact('phone', e.target.value)}
            />
          </label>
          <label>
            <span>Localização</span>
            <input
              type="text"
              value={profile.contact.location ?? ''}
              onChange={(e) => updateContact('location', e.target.value)}
            />
          </label>
          <label>
            <span>LinkedIn</span>
            <input
              type="url"
              value={profile.contact.linkedinUrl ?? ''}
              onChange={(e) => updateContact('linkedinUrl', e.target.value)}
            />
          </label>
          <label>
            <span>Portfólio</span>
            <input
              type="url"
              value={profile.contact.portfolioUrl ?? ''}
              onChange={(e) => updateContact('portfolioUrl', e.target.value)}
            />
          </label>
        </fieldset>

        <fieldset className="profile-section">
          <legend>Currículo</legend>
          {profile.resume ? (
            <div className="resume-summary">
              <span className="resume-name">{profile.resume.fileName}</span>
              <button type="button" onClick={handleResumeRemove}>
                Remover
              </button>
            </div>
          ) : (
            <p className="screen-hint">Nenhum currículo anexado.</p>
          )}
          <label>
            <span>Anexar currículo</span>
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf,.doc,.docx,application/pdf"
              onChange={handleResumeChange}
            />
          </label>
        </fieldset>

        <fieldset className="profile-section">
          <legend>Respostas personalizadas</legend>
          <p className="screen-hint">
            Guarde respostas manuais reaproveitáveis ao preencher formulários.
          </p>
          {answers.length === 0 ? (
            <p className="screen-hint">Nenhuma resposta cadastrada.</p>
          ) : (
            <ul className="answers-list">
              {answers.map((row, index) => (
                <li key={index} className="answers-row">
                  <input
                    type="text"
                    aria-label={`Chave da resposta ${index + 1}`}
                    placeholder="Pergunta ou chave"
                    value={row.key}
                    onChange={(e) =>
                      handleAnswerChange(index, 'key', e.target.value)
                    }
                  />
                  <input
                    type="text"
                    aria-label={`Valor da resposta ${index + 1}`}
                    placeholder="Resposta"
                    value={row.value}
                    onChange={(e) =>
                      handleAnswerChange(index, 'value', e.target.value)
                    }
                  />
                  <button
                    type="button"
                    aria-label={`Remover resposta ${index + 1}`}
                    onClick={() => handleAnswerRemove(index)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={handleAnswerAdd}>
            Adicionar resposta
          </button>
        </fieldset>

        <fieldset className="profile-section">
          <legend>Respostas salvas</legend>
          <p className="screen-hint">
            Respostas reutilizáveis criadas a partir de pendências.
          </p>
          {savedAnswers.length === 0 ? (
            <p className="screen-hint">Nenhuma resposta salva ainda.</p>
          ) : (
            <ul className="saved-answers-list" aria-label="Respostas salvas">
              {savedAnswers.map((answer) => {
                const isEditing = editingAnswerId === answer.id;
                return (
                  <li key={answer.id} className="saved-answer-row">
                    <div className="saved-answer-header">
                      <strong>{answer.label}</strong>
                      <span className="saved-answer-mode">
                        {REUSE_MODE_LABELS[answer.reuseMode]}
                      </span>
                    </div>
                    {isEditing ? (
                      <div className="saved-answer-edit">
                        <input
                          type="text"
                          value={editValue}
                          aria-label="Editar valor"
                          onChange={(e) => setEditValue(e.target.value)}
                        />
                        <select
                          value={editReuseMode}
                          aria-label="Modo de reutilização"
                          onChange={(e) =>
                            setEditReuseMode(e.target.value as ReuseMode)
                          }
                        >
                          {REUSE_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                              {REUSE_MODE_LABELS[mode]}
                            </option>
                          ))}
                        </select>
                        <div className="saved-answer-edit-actions">
                          <button
                            type="button"
                            onClick={handleSaveEditedAnswer}
                            disabled={!editValue.trim()}
                          >
                            Salvar
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingAnswerId(null)}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="saved-answer-display">
                        <span className="saved-answer-value">{answer.value}</span>
                        <div className="saved-answer-actions">
                          <button
                            type="button"
                            aria-label={`Editar resposta ${answer.label}`}
                            onClick={() => handleEditSavedAnswer(answer)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            aria-label={`Remover resposta ${answer.label}`}
                            onClick={() => handleRemoveSavedAnswer(answer.id)}
                          >
                            Remover
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>

        <div className="profile-actions">
          <button type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Salvando...' : 'Salvar perfil'}
          </button>
          {status === 'saved' && (
            <span role="status" className="save-status save-status-ok">
              Perfil salvo
            </span>
          )}
          {status === 'error' && errorMessage && (
            <span role="alert" className="save-status save-status-error">
              {errorMessage}
            </span>
          )}
        </div>
      </form>
    </main>
  );
}
