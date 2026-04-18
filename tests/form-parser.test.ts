import { describe, expect, it } from 'vitest';
import {
  detectCurrentStep,
  parseFormFields,
  parseFormFieldsByStep,
} from '../src/modules/form-parser';

function htmlDoc(markup: string): Document {
  const doc = document.implementation.createHTMLDocument('test');
  doc.body.innerHTML = markup;
  return doc;
}

describe('parseFormFields', () => {
  it('detects text inputs and textarea with their labels and requirements', () => {
    const doc = htmlDoc(`
      <form>
        <label for="full-name">Nome completo</label>
        <input id="full-name" name="fullName" type="text" required placeholder="Seu nome" />

        <label for="email">E-mail</label>
        <input id="email" name="email" type="email" aria-required="true" value="ana@example.com" />

        <label>
          Sobre você
          <textarea name="about" placeholder="Conte mais"></textarea>
        </label>
      </form>
    `);

    const fields = parseFormFields(doc);

    const nameField = fields.find((f) => f.name === 'fullName');
    expect(nameField).toBeDefined();
    expect(nameField?.type).toBe('text');
    expect(nameField?.label).toBe('Nome completo');
    expect(nameField?.required).toBe(true);
    expect(nameField?.placeholder).toBe('Seu nome');

    const emailField = fields.find((f) => f.name === 'email');
    expect(emailField?.type).toBe('text');
    expect(emailField?.required).toBe(true);
    expect(emailField?.value).toBe('ana@example.com');

    const aboutField = fields.find((f) => f.name === 'about');
    expect(aboutField?.type).toBe('textarea');
    expect(aboutField?.label).toBe('Sobre você');
  });

  it('detects select with options and radio groups', () => {
    const doc = htmlDoc(`
      <form>
        <label for="level">Nível</label>
        <select id="level" name="level" required>
          <option value="">Selecione</option>
          <option value="jr">Júnior</option>
          <option value="sr">Sênior</option>
        </select>

        <fieldset>
          <legend>Modalidade</legend>
          <label><input type="radio" name="mode" value="remote" /> Remoto</label>
          <label><input type="radio" name="mode" value="onsite" checked /> Presencial</label>
        </fieldset>
      </form>
    `);

    const fields = parseFormFields(doc);

    const select = fields.find((f) => f.name === 'level');
    expect(select?.type).toBe('select');
    expect(select?.required).toBe(true);
    expect(select?.options).toEqual([
      { value: 'jr', label: 'Júnior' },
      { value: 'sr', label: 'Sênior' },
    ]);

    const mode = fields.find((f) => f.name === 'mode');
    expect(mode?.type).toBe('radio');
    expect(mode?.label).toBe('Modalidade');
    expect(mode?.value).toBe('onsite');
    expect(mode?.options.map((o) => o.value)).toEqual(['remote', 'onsite']);
    expect(mode?.options.map((o) => o.label)).toEqual(['Remoto', 'Presencial']);
  });

  it('detects standalone checkbox and checkbox groups', () => {
    const doc = htmlDoc(`
      <form>
        <label><input type="checkbox" name="terms" required /> Aceito os termos</label>

        <fieldset>
          <legend>Benefícios desejados</legend>
          <label><input type="checkbox" name="perks" value="vr" checked /> Vale refeição</label>
          <label><input type="checkbox" name="perks" value="vt" /> Vale transporte</label>
          <label><input type="checkbox" name="perks" value="home" checked /> Home office</label>
        </fieldset>
      </form>
    `);

    const fields = parseFormFields(doc);

    const terms = fields.find((f) => f.name === 'terms');
    expect(terms?.type).toBe('checkbox');
    expect(terms?.required).toBe(true);
    expect(terms?.options).toEqual([]);

    const perks = fields.find((f) => f.name === 'perks');
    expect(perks?.type).toBe('checkbox');
    expect(perks?.label).toBe('Benefícios desejados');
    expect(perks?.options.map((o) => o.value).sort()).toEqual(['home', 'vr', 'vt']);
    expect(perks?.value).toBe('vr,home');
  });

  it('detects file upload fields with accept attribute', () => {
    const doc = htmlDoc(`
      <form>
        <label for="cv">Currículo</label>
        <input id="cv" name="resume" type="file" accept="application/pdf" required />
      </form>
    `);

    const fields = parseFormFields(doc);
    const cv = fields.find((f) => f.name === 'resume');
    expect(cv?.type).toBe('file');
    expect(cv?.label).toBe('Currículo');
    expect(cv?.required).toBe(true);
    expect(cv?.placeholder).toBe('application/pdf');
  });

  it('tags fields with explicit data-form-step', () => {
    const doc = htmlDoc(`
      <form>
        <section data-form-step="1">
          <label>Passo 1 <input name="a" type="text" /></label>
        </section>
        <section data-form-step="2">
          <label>Passo 2 <textarea name="b"></textarea></label>
        </section>
      </form>
    `);

    const fields = parseFormFields(doc);
    expect(fields.find((f) => f.name === 'a')?.step).toBe(1);
    expect(fields.find((f) => f.name === 'b')?.step).toBe(2);
  });

  it('filters fields by step using parseFormFieldsByStep', () => {
    const doc = htmlDoc(`
      <form>
        <section data-form-step="1">
          <input name="a" type="text" />
        </section>
        <section data-form-step="2">
          <input name="b" type="text" />
        </section>
      </form>
    `);

    const step1 = parseFormFieldsByStep(doc, 1);
    expect(step1.map((f) => f.name)).toEqual(['a']);

    const step2 = parseFormFieldsByStep(doc, 2);
    expect(step2.map((f) => f.name)).toEqual(['b']);
  });

  it('falls back to step containers when no data-* markers exist', () => {
    const doc = htmlDoc(`
      <form>
        <div class="form-step"><input name="x" type="text" /></div>
        <div class="form-step"><input name="y" type="text" /></div>
      </form>
    `);

    const fields = parseFormFields(doc);
    expect(fields.find((f) => f.name === 'x')?.step).toBe(1);
    expect(fields.find((f) => f.name === 'y')?.step).toBe(2);
  });

  it('uses provided default step when no markers exist at all', () => {
    const doc = htmlDoc(`
      <form>
        <input name="x" type="text" />
      </form>
    `);

    const fields = parseFormFields(doc, { step: 3 });
    expect(fields.find((f) => f.name === 'x')?.step).toBe(3);
  });

  it('returns an empty list when there are no inputs', () => {
    expect(parseFormFields(htmlDoc('<div>no form</div>'))).toEqual([]);
  });
});

describe('detectCurrentStep', () => {
  it('reads explicit data-current-step', () => {
    const doc = htmlDoc('<section data-current-step="2"></section>');
    expect(detectCurrentStep(doc)).toBe(2);
  });

  it('returns 1 when step containers exist but none is marked current', () => {
    const doc = htmlDoc(
      '<div class="form-step"></div><div class="form-step"></div>',
    );
    expect(detectCurrentStep(doc)).toBe(1);
  });

  it('returns undefined when no step signal exists', () => {
    expect(detectCurrentStep(htmlDoc('<form><input /></form>'))).toBeUndefined();
  });
});
