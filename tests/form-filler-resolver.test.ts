import { describe, expect, it } from 'vitest';
import { createCandidateProfile } from '../src/modules/profile';
import { createFormField } from '../src/modules/form-parser';
import {
  createSavedAnswer,
  normaliseText,
  resolveField,
  scoreFieldAgainstProfileKeys,
  tokenize,
} from '../src/modules/form-filler';

describe('normaliseText (E8-S1-T1)', () => {
  it('removes accents and lowercases', () => {
    expect(normaliseText('Localização')).toBe('localizacao');
  });

  it('splits camelCase and snake_case identifiers', () => {
    expect(normaliseText('firstName')).toBe('first name');
    expect(normaliseText('full_name')).toBe('full name');
    expect(normaliseText('linkedin-url')).toBe('linkedin url');
  });

  it('strips punctuation', () => {
    expect(normaliseText('E-mail *')).toBe('e mail');
  });

  it('tokenises phrases', () => {
    expect(tokenize('Nome Completo')).toEqual(['nome', 'completo']);
  });
});

describe('scoreFieldAgainstProfileKeys (E8-S1-T3)', () => {
  it('ranks fullName for "Nome completo"', () => {
    const field = createFormField({ id: 'f', type: 'text', label: 'Nome completo' });
    const [best] = scoreFieldAgainstProfileKeys(field);
    expect(best.key).toBe('fullName');
    expect(best.score).toBeGreaterThan(0.8);
  });

  it('ranks email for an email input labelled "E-mail"', () => {
    const field = createFormField({
      id: 'e',
      type: 'text',
      label: 'E-mail',
      name: 'email',
    });
    const [best] = scoreFieldAgainstProfileKeys(field);
    expect(best.key).toBe('email');
  });

  it('ranks phone via the name attribute when the label is missing', () => {
    const field = createFormField({ id: 'p', type: 'text', label: '', name: 'phoneNumber' });
    const [best] = scoreFieldAgainstProfileKeys(field);
    expect(best.key).toBe('phone');
  });
});

describe('resolveField order (E8-S1-T4)', () => {
  const profile = createCandidateProfile({
    fullName: 'Ana Silva',
    contact: {
      email: 'ana@example.com',
      phone: '+55 11 99999-9999',
      location: 'São Paulo, SP',
    },
    customAnswers: {
      'Pretensão salarial': 'R$ 10.000',
    },
  });

  it('resolves a text field from the profile with high confidence', () => {
    const field = createFormField({ id: 'n', type: 'text', label: 'Nome completo' });
    const resolution = resolveField(field, { profile });
    expect(resolution.status).toBe('resolved');
    expect(resolution.source).toBe('profile');
    expect(resolution.value).toBe('Ana Silva');
    expect(resolution.profileKey).toBe('fullName');
    expect(resolution.confidence).toBe('high');
  });

  it('falls back to custom answers when profile keys do not match', () => {
    const field = createFormField({
      id: 's',
      type: 'text',
      label: 'Pretensão salarial',
      required: true,
    });
    const resolution = resolveField(field, { profile });
    expect(resolution.status).toBe('resolved');
    expect(resolution.value).toBe('R$ 10.000');
  });

  it('falls back to saved answers before generating a pending', () => {
    const field = createFormField({
      id: 'q',
      type: 'textarea',
      label: 'Por que deseja essa vaga?',
      required: true,
    });
    const savedAnswers = [
      createSavedAnswer({
        id: 'sa-1',
        label: 'Por que essa vaga',
        value: 'Porque o desafio combina com meu perfil.',
        keywords: ['por que deseja essa vaga', 'motivo', 'why'],
        reuseMode: 'auto',
      }),
    ];
    const resolution = resolveField(field, { profile, savedAnswers });
    expect(resolution.status).toBe('resolved');
    expect(resolution.source).toBe('saved-answer');
    expect(resolution.value).toContain('desafio');
    expect(resolution.savedAnswerId).toBe('sa-1');
  });

  it('returns pending for required unresolved fields', () => {
    const field = createFormField({
      id: 'x',
      type: 'text',
      label: 'Identidade corporativa interna',
      required: true,
    });
    const resolution = resolveField(field, { profile });
    expect(resolution.status).toBe('pending');
    expect(resolution.pendingReason).toBeDefined();
  });

  it('returns skipped for optional unresolved fields', () => {
    const field = createFormField({
      id: 'x2',
      type: 'text',
      label: 'Identidade corporativa interna',
      required: false,
    });
    const resolution = resolveField(field, { profile });
    expect(resolution.status).toBe('skipped');
  });

  it('picks a matching option for radio groups resolved from the profile', () => {
    const field = createFormField({
      id: 'loc-radio',
      type: 'radio',
      label: 'Cidade',
      options: [
        { value: 'sp', label: 'São Paulo, SP' },
        { value: 'rj', label: 'Rio de Janeiro, RJ' },
      ],
      required: true,
    });
    const resolution = resolveField(field, { profile });
    expect(resolution.status).toBe('resolved');
    expect(resolution.value).toBe('sp');
    expect(resolution.option?.label).toContain('São Paulo');
  });

  it('resolves file uploads to the resume dataUrl', () => {
    const withResume = createCandidateProfile({
      fullName: 'Ana Silva',
      contact: { email: 'ana@example.com' },
      resume: {
        fileName: 'cv.pdf',
        mimeType: 'application/pdf',
        dataUrl: 'data:application/pdf;base64,AAA=',
        updatedAt: new Date(0).toISOString(),
      },
    });
    const field = createFormField({
      id: 'cv',
      type: 'file',
      label: 'Anexar currículo',
      placeholder: 'application/pdf',
    });
    const resolution = resolveField(field, { profile: withResume });
    expect(resolution.status).toBe('resolved');
    expect(resolution.source).toBe('resume');
    expect(resolution.useResume).toBe(true);
  });
});
