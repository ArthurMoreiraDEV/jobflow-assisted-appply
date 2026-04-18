import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProfileScreen } from '../src/popup/screens/ProfileScreen';
import {
  createMemoryStorageAdapter,
  createProfileRepository,
  type ProfileRepository,
  type StorageAdapter,
} from '../src/modules/storage';
import { createCandidateProfile } from '../src/modules/profile';

let adapter: StorageAdapter;
let repository: ProfileRepository;

beforeEach(() => {
  adapter = createMemoryStorageAdapter();
  repository = createProfileRepository(adapter);
});

function renderScreen() {
  return render(
    <MemoryRouter>
      <ProfileScreen repository={repository} />
    </MemoryRouter>,
  );
}

async function waitForLoad() {
  await waitFor(() =>
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument(),
  );
}

function changeInput(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

describe('ProfileScreen (E4-S1)', () => {
  it('renders basic profile fields and saves them (T1)', async () => {
    renderScreen();
    await waitForLoad();

    changeInput('Nome completo', 'Ada Lovelace');
    changeInput('Título profissional', 'Engenheira');
    changeInput('E-mail', 'ada@example.com');
    changeInput('Telefone', '+55 11 99999-0000');

    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Perfil salvo'),
    );

    const saved = await repository.load();
    expect(saved?.fullName).toBe('Ada Lovelace');
    expect(saved?.headline).toBe('Engenheira');
    expect(saved?.contact.email).toBe('ada@example.com');
    expect(saved?.contact.phone).toBe('+55 11 99999-0000');
  });

  it('loads an existing profile from storage on mount', async () => {
    await repository.save(
      createCandidateProfile({
        id: 'u1',
        fullName: 'Grace Hopper',
        contact: { email: 'grace@example.com' },
        customAnswers: { 'Pretensão salarial': 'R$ 15k' },
      }),
    );

    renderScreen();

    await waitFor(() =>
      expect(screen.getByLabelText('Nome completo')).toHaveValue(
        'Grace Hopper',
      ),
    );
    expect(screen.getByLabelText('E-mail')).toHaveValue('grace@example.com');
    expect(
      screen.getByDisplayValue('Pretensão salarial'),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('R$ 15k')).toBeInTheDocument();
  });

  it('attaches a resume file to the profile (T2)', async () => {
    renderScreen();
    await waitForLoad();

    const file = new File(['pdf bytes'], 'cv.pdf', {
      type: 'application/pdf',
    });
    const input = screen.getByLabelText('Anexar currículo') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() =>
      expect(screen.getByText('cv.pdf')).toBeInTheDocument(),
    );

    changeInput('Nome completo', 'Ada');
    changeInput('E-mail', 'ada@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Perfil salvo'),
    );

    const saved = await repository.load();
    expect(saved?.resume?.fileName).toBe('cv.pdf');
    expect(saved?.resume?.mimeType).toBe('application/pdf');
    expect(saved?.resume?.dataUrl.startsWith('data:application/pdf')).toBe(
      true,
    );
  });

  it('removes an attached resume on demand (T2)', async () => {
    await repository.save(
      createCandidateProfile({
        fullName: 'Ada',
        contact: { email: 'ada@example.com' },
        resume: {
          fileName: 'old.pdf',
          mimeType: 'application/pdf',
          dataUrl: 'data:application/pdf;base64,AAAA',
          updatedAt: new Date(0).toISOString(),
        },
      }),
    );

    renderScreen();
    await waitFor(() =>
      expect(screen.getByText('old.pdf')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(screen.queryByText('old.pdf')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Perfil salvo'),
    );
    const saved = await repository.load();
    expect(saved?.resume).toBeUndefined();
  });

  it('adds, edits and removes custom answers (T3)', async () => {
    renderScreen();
    await waitForLoad();

    changeInput('Nome completo', 'Ada');
    changeInput('E-mail', 'ada@example.com');

    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar resposta' }),
    );
    changeInput('Chave da resposta 1', 'Pretensão salarial');
    changeInput('Valor da resposta 1', 'R$ 12k');

    fireEvent.click(
      screen.getByRole('button', { name: 'Adicionar resposta' }),
    );
    changeInput('Chave da resposta 2', 'Disponibilidade');
    changeInput('Valor da resposta 2', 'Imediata');

    fireEvent.click(
      screen.getByRole('button', { name: 'Remover resposta 1' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Salvar perfil' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Perfil salvo'),
    );

    const saved = await repository.load();
    expect(saved?.customAnswers).toEqual({ Disponibilidade: 'Imediata' });
  });
});
