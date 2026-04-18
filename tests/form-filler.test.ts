import { describe, expect, it } from 'vitest';
import { createCandidateProfile } from '../src/modules/profile';
import { parseFormFields } from '../src/modules/form-parser';
import { createSavedAnswer, fillFields } from '../src/modules/form-filler';

function htmlDoc(markup: string): Document {
  const doc = document.implementation.createHTMLDocument('test');
  doc.body.innerHTML = markup;
  return doc;
}

describe('fillFields (E8-S1-T5)', () => {
  it('fills text inputs, textareas and selects for a happy-path LinkedIn form', () => {
    const doc = htmlDoc(`
      <form>
        <label for="full-name">Nome completo</label>
        <input id="full-name" name="fullName" type="text" required />

        <label for="email">E-mail</label>
        <input id="email" name="email" type="email" required />

        <label for="phone">Telefone</label>
        <input id="phone" name="phone" type="tel" />

        <label for="location">Cidade</label>
        <select id="location" name="location">
          <option value="">Selecione</option>
          <option value="sp">São Paulo, SP</option>
          <option value="rj">Rio de Janeiro, RJ</option>
        </select>

        <label for="summary">Sobre você</label>
        <textarea id="summary" name="summary"></textarea>
      </form>
    `);

    const profile = createCandidateProfile({
      fullName: 'Ana Silva',
      summary: 'Engenheira de software com foco em plataformas.',
      contact: {
        email: 'ana@example.com',
        phone: '+55 11 91234-5678',
        location: 'São Paulo, SP',
      },
    });

    const fields = parseFormFields(doc);
    const report = fillFields(doc, fields, { profile });

    expect(report.pendings).toHaveLength(0);
    const values = report.outcomes.map((o) => ({
      label: o.field.label,
      status: o.fillStatus,
      value: o.resolution.value,
    }));
    expect(values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Nome completo', status: 'filled', value: 'Ana Silva' }),
        expect.objectContaining({ label: 'E-mail', status: 'filled', value: 'ana@example.com' }),
        expect.objectContaining({ label: 'Telefone', status: 'filled' }),
        expect.objectContaining({ label: 'Cidade', status: 'filled', value: 'sp' }),
        expect.objectContaining({ label: 'Sobre você', status: 'filled' }),
      ]),
    );

    expect((doc.getElementById('full-name') as HTMLInputElement).value).toBe('Ana Silva');
    expect((doc.getElementById('email') as HTMLInputElement).value).toBe('ana@example.com');
    expect((doc.getElementById('location') as HTMLSelectElement).value).toBe('sp');
    expect((doc.getElementById('summary') as HTMLTextAreaElement).value).toBe(
      'Engenheira de software com foco em plataformas.',
    );
  });

  it('dispatches input and change events so React-controlled fields pick up the value', () => {
    const doc = htmlDoc(`
      <form>
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required />
      </form>
    `);
    const input = doc.getElementById('email') as HTMLInputElement;
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));

    const profile = createCandidateProfile({
      fullName: 'Ana',
      contact: { email: 'ana@example.com' },
    });

    const fields = parseFormFields(doc);
    fillFields(doc, fields, { profile });

    expect(events).toEqual(['input', 'change']);
  });

  it('creates a pending entry for required fields with no match', () => {
    const doc = htmlDoc(`
      <form>
        <label for="internal">Matrícula interna</label>
        <input id="internal" name="internalId" type="text" required />
      </form>
    `);

    const profile = createCandidateProfile({
      fullName: 'Ana Silva',
      contact: { email: 'ana@example.com' },
    });

    const fields = parseFormFields(doc);
    const report = fillFields(doc, fields, { profile });

    expect(report.pendings).toHaveLength(1);
    expect(report.pendings[0].field.label).toBe('Matrícula interna');
    expect(report.pendings[0].field.fillStatus).toBe('pending');
    expect(report.filled).toHaveLength(0);
  });

  it('uses saved answers before marking required fields as pending', () => {
    const doc = htmlDoc(`
      <form>
        <label for="motivation">Por que deseja essa vaga?</label>
        <textarea id="motivation" name="motivation" required></textarea>
      </form>
    `);

    const profile = createCandidateProfile({
      fullName: 'Ana Silva',
      contact: { email: 'ana@example.com' },
    });

    const savedAnswers = [
      createSavedAnswer({
        id: 'sa-motivation',
        label: 'Por que essa vaga',
        value: 'Porque o desafio combina com meu perfil.',
        keywords: ['por que deseja essa vaga', 'motivo'],
        reuseMode: 'auto',
      }),
    ];

    const fields = parseFormFields(doc);
    const report = fillFields(doc, fields, { profile, savedAnswers });

    expect(report.pendings).toHaveLength(0);
    expect((doc.getElementById('motivation') as HTMLTextAreaElement).value).toContain('desafio');
  });

  it('checks the correct radio option when the group label matches a profile key', () => {
    const doc = htmlDoc(`
      <form>
        <fieldset>
          <legend>Cidade atual</legend>
          <label><input type="radio" name="city" value="sp" /> São Paulo, SP</label>
          <label><input type="radio" name="city" value="rj" /> Rio de Janeiro, RJ</label>
        </fieldset>
      </form>
    `);

    const profile = createCandidateProfile({
      fullName: 'Ana',
      contact: { email: 'ana@example.com', location: 'São Paulo, SP' },
    });

    const fields = parseFormFields(doc);
    const report = fillFields(doc, fields, { profile });

    const spInput = doc.querySelector('input[value="sp"]') as HTMLInputElement;
    const rjInput = doc.querySelector('input[value="rj"]') as HTMLInputElement;
    expect(spInput.checked).toBe(true);
    expect(rjInput.checked).toBe(false);
    expect(report.filled.find((f) => f.type === 'radio')?.value).toBe('sp');
  });

  it('ignores optional unresolved fields without creating pendings', () => {
    const doc = htmlDoc(`
      <form>
        <label for="extra">Campo opcional sem match</label>
        <input id="extra" name="extraWeirdField" type="text" />
      </form>
    `);

    const profile = createCandidateProfile({
      fullName: 'Ana Silva',
      contact: { email: 'ana@example.com' },
    });

    const fields = parseFormFields(doc);
    const report = fillFields(doc, fields, { profile });

    expect(report.pendings).toHaveLength(0);
    expect(report.filled).toHaveLength(0);
    expect(report.outcomes[0].fillStatus).toBe('skipped');
  });
});
