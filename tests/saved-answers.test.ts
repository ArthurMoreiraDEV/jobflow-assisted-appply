import { describe, expect, it } from 'vitest';
import { createFormField } from '../src/modules/form-parser';
import { createSavedAnswer, resolveField } from '../src/modules/form-filler';
import { createCandidateProfile } from '../src/modules/profile';

const profile = createCandidateProfile({
  fullName: 'Ana Silva',
  contact: { email: 'ana@example.com' },
});

describe('SavedAnswer reuseMode (E11-S2-T2)', () => {
  const field = createFormField({
    id: 'motivation',
    type: 'textarea',
    label: 'Por que deseja essa vaga?',
    required: true,
  });

  it('auto mode resolves and fills automatically', () => {
    const savedAnswers = [
      createSavedAnswer({
        id: 'sa-1',
        label: 'Por que essa vaga',
        value: 'Porque o desafio combina com meu perfil.',
        keywords: ['por que deseja essa vaga'],
        reuseMode: 'auto',
      }),
    ];
    const resolution = resolveField(field, { profile, savedAnswers });
    expect(resolution.status).toBe('resolved');
    expect(resolution.source).toBe('saved-answer');
    expect(resolution.value).toContain('desafio');
  });

  it('suggest mode returns pending with suggested value in reason', () => {
    const savedAnswers = [
      createSavedAnswer({
        id: 'sa-2',
        label: 'Por que essa vaga',
        value: 'Minha experiência se encaixa.',
        keywords: ['por que deseja essa vaga'],
        reuseMode: 'suggest',
      }),
    ];
    const resolution = resolveField(field, { profile, savedAnswers });
    expect(resolution.status).toBe('pending');
    expect(resolution.source).toBe('saved-answer');
    expect(resolution.pendingReason).toContain('Sugestão');
    expect(resolution.pendingReason).toContain('Minha experiência se encaixa.');
    expect(resolution.savedAnswerId).toBe('sa-2');
  });

  it('confirm mode resolves with low confidence', () => {
    const savedAnswers = [
      createSavedAnswer({
        id: 'sa-3',
        label: 'Por que essa vaga',
        value: 'Gosto do desafio técnico.',
        keywords: ['por que deseja essa vaga'],
        reuseMode: 'confirm',
      }),
    ];
    const resolution = resolveField(field, { profile, savedAnswers });
    expect(resolution.status).toBe('resolved');
    expect(resolution.source).toBe('saved-answer');
    expect(resolution.confidence).toBe('low');
    expect(resolution.value).toContain('desafio');
  });

  it('suggest mode with select field includes matched option', () => {
    const selectField = createFormField({
      id: 'experience',
      type: 'select',
      label: 'Anos de experiência',
      required: true,
      options: [
        { value: '1-3', label: '1 a 3 anos' },
        { value: '3-5', label: '3 a 5 anos' },
        { value: '5+', label: 'Mais de 5 anos' },
      ],
    });
    const savedAnswers = [
      createSavedAnswer({
        id: 'sa-4',
        label: 'Anos de experiência',
        value: '3 a 5 anos',
        keywords: ['experiencia', 'anos'],
        reuseMode: 'suggest',
      }),
    ];
    const resolution = resolveField(selectField, { profile, savedAnswers });
    expect(resolution.status).toBe('pending');
    expect(resolution.source).toBe('saved-answer');
    expect(resolution.pendingReason).toContain('Sugestão');
    expect(resolution.value).toBe('3-5');
  });
});
