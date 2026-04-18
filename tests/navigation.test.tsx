import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from '../src/popup/App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe('popup navigation', () => {
  it('renders the five main tabs', () => {
    renderAt('/perfil');
    for (const label of ['Perfil', 'Busca', 'Resultados', 'Fila', 'Histórico']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });

  it.each([
    ['/perfil', 'Perfil'],
    ['/busca', 'Busca'],
    ['/resultados', 'Resultados'],
    ['/fila', 'Fila'],
    ['/historico', 'Histórico'],
  ])('shows the %s screen heading at %s', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
  });
});
