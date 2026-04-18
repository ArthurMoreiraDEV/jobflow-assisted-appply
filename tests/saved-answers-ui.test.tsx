import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HistoryScreen } from '../src/popup/screens/HistoryScreen';
import { ProfileScreen } from '../src/popup/screens/ProfileScreen';
import { createMemoryStorageAdapter } from '../src/modules/storage/adapter';
import { createHistoryRepository } from '../src/modules/storage/history-repository';
import { createQueueRepository } from '../src/modules/storage/queue-repository';
import { createResultsRepository } from '../src/modules/storage/results-repository';
import { createSavedAnswersRepository } from '../src/modules/storage/saved-answers-repository';
import { createProfileRepository } from '../src/modules/storage/profile-repository';
import { createApplicationAttempt } from '../src/modules/executor';
import { createFormField } from '../src/modules/form-parser';
import { createSavedAnswer } from '../src/modules/form-filler';

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('HistoryScreen save answer from pending (E11-S2-T1)', () => {
  it('shows save button on pending fields and saves an answer', async () => {
    const adapter = createMemoryStorageAdapter();
    const historyRepo = createHistoryRepository(adapter);
    const queueRepo = createQueueRepository(adapter);
    const resultsRepo = createResultsRepository(adapter);
    const savedAnswersRepo = createSavedAnswersRepository(adapter);

    const attempt = createApplicationAttempt({
      id: 'att-1',
      jobId: 'job-1',
      result: 'pending',
      startedAt: new Date().toISOString(),
      pendings: [
        {
          field: createFormField({
            id: 'q1',
            type: 'text',
            label: 'Por que deseja essa vaga?',
            required: true,
          }),
          reason: 'Campo obrigatório sem correspondência automática.',
          createdAt: new Date().toISOString(),
        },
      ],
    });
    await historyRepo.upsert(attempt);

    wrap(
      <HistoryScreen
        historyRepository={historyRepo}
        queueRepository={queueRepo}
        resultsRepository={resultsRepo}
        savedAnswersRepository={savedAnswersRepo}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Por que deseja essa vaga?')).toBeTruthy();
    });

    const saveBtn = screen.getByText('Salvar resposta');
    fireEvent.click(saveBtn);

    const valueInput = screen.getByLabelText('Valor da resposta');
    fireEvent.change(valueInput, { target: { value: 'Gosto do desafio.' } });

    const modeSelect = screen.getByLabelText('Modo de reutilização');
    fireEvent.change(modeSelect, { target: { value: 'auto' } });

    const submitBtn = screen.getByText('Salvar');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Resposta salva')).toBeTruthy();
    });

    const saved = await savedAnswersRepo.list();
    expect(saved).toHaveLength(1);
    expect(saved[0].value).toBe('Gosto do desafio.');
    expect(saved[0].reuseMode).toBe('auto');
    expect(saved[0].label).toBe('Por que deseja essa vaga?');
  });
});

describe('ProfileScreen saved answers management (E11-S2-T3)', () => {
  it('lists saved answers and allows editing and removing', async () => {
    const adapter = createMemoryStorageAdapter();
    const profileRepo = createProfileRepository(adapter);
    const savedAnswersRepo = createSavedAnswersRepository(adapter);

    await savedAnswersRepo.upsert(
      createSavedAnswer({
        id: 'sa-1',
        label: 'Motivação',
        value: 'Gosto de desafios.',
        reuseMode: 'auto',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );
    await savedAnswersRepo.upsert(
      createSavedAnswer({
        id: 'sa-2',
        label: 'Experiência',
        value: '5 anos.',
        reuseMode: 'suggest',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    );

    wrap(
      <ProfileScreen
        repository={profileRepo}
        savedAnswersRepository={savedAnswersRepo}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Motivação')).toBeTruthy();
      expect(screen.getByText('Experiência')).toBeTruthy();
    });

    expect(screen.getByText('Gosto de desafios.')).toBeTruthy();
    expect(screen.getByText('5 anos.')).toBeTruthy();

    // Edit first answer
    const editBtns = screen.getAllByText('Editar');
    fireEvent.click(editBtns[0]);

    const editInput = screen.getByLabelText('Editar valor');
    fireEvent.change(editInput, { target: { value: 'Adoro desafios técnicos.' } });

    const saveBtn = screen.getByText('Salvar');
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Adoro desafios técnicos.')).toBeTruthy();
    });

    const updatedList = await savedAnswersRepo.list();
    expect(updatedList.find((a) => a.id === 'sa-1')?.value).toBe('Adoro desafios técnicos.');

    // Remove second answer
    const removeBtns = screen.getAllByText('Remover');
    const removeExperiencia = removeBtns.find((btn) =>
      btn.getAttribute('aria-label')?.includes('Experiência'),
    );
    expect(removeExperiencia).toBeTruthy();
    fireEvent.click(removeExperiencia!);

    await waitFor(async () => {
      const remaining = await savedAnswersRepo.list();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].id).toBe('sa-1');
    });
  });
});
