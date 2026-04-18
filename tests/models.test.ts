import { describe, expect, it } from 'vitest';
import {
  createCandidateProfile,
  type CandidateProfile,
} from '../src/modules/profile';
import {
  createJobListing,
  isTerminalJobStatus,
  JOB_STATUSES,
  type JobStatus,
} from '../src/modules/job-list';
import {
  createFormField,
  FIELD_CONFIDENCES,
  FIELD_FILL_STATUSES,
  FORM_FIELD_TYPES,
} from '../src/modules/form-parser';
import { createApplicationAttempt } from '../src/modules/executor';
import { createSavedAnswer, REUSE_MODES } from '../src/modules/form-filler';

describe('CandidateProfile model (E2-S1-T1)', () => {
  it('creates a profile with defaults ready for persistence', () => {
    const profile = createCandidateProfile();
    expect(profile.id).toBe('default');
    expect(profile.contact.email).toBe('');
    expect(profile.experiences).toEqual([]);
    expect(profile.education).toEqual([]);
    expect(profile.skills).toEqual([]);
    expect(profile.customAnswers).toEqual({});
    expect(() => JSON.stringify(profile)).not.toThrow();
  });

  it('accepts partial overrides and keeps the shape serialisable', () => {
    const profile: CandidateProfile = createCandidateProfile({
      id: 'u1',
      fullName: 'Ada Lovelace',
      contact: { email: 'ada@example.com', phone: '+55 11 99999-9999' },
      skills: ['typescript', 'react'],
    });
    expect(profile.fullName).toBe('Ada Lovelace');
    expect(profile.contact.phone).toBe('+55 11 99999-9999');
    const roundTripped = JSON.parse(JSON.stringify(profile)) as CandidateProfile;
    expect(roundTripped).toEqual(profile);
  });
});

describe('JobListing model (E2-S1-T2)', () => {
  it('exposes the full pipeline status set required by E6', () => {
    const expected: JobStatus[] = [
      'discovered',
      'selected',
      'queued',
      'processing',
      'success',
      'pending',
      'failed',
      'skipped',
    ];
    expect(Array.from(JOB_STATUSES)).toEqual(expected);
  });

  it('creates a listing with safe defaults', () => {
    const job = createJobListing({
      id: 'j1',
      title: 'Senior Engineer',
      company: 'Acme',
      url: 'https://linkedin.com/jobs/j1',
    });
    expect(job.source).toBe('linkedin');
    expect(job.status).toBe('discovered');
    expect(job.location).toBe('');
  });

  it('identifies terminal statuses', () => {
    expect(isTerminalJobStatus('success')).toBe(true);
    expect(isTerminalJobStatus('failed')).toBe(true);
    expect(isTerminalJobStatus('skipped')).toBe(true);
    expect(isTerminalJobStatus('queued')).toBe(false);
    expect(isTerminalJobStatus('pending')).toBe(false);
  });
});

describe('FormField model (E2-S1-T3)', () => {
  it('covers all MVP field types', () => {
    expect(Array.from(FORM_FIELD_TYPES)).toEqual([
      'text',
      'textarea',
      'select',
      'radio',
      'checkbox',
      'file',
    ]);
  });

  it('supports confidence and fill status enumerations', () => {
    expect(Array.from(FIELD_CONFIDENCES)).toEqual(['high', 'medium', 'low']);
    expect(Array.from(FIELD_FILL_STATUSES)).toEqual([
      'pending',
      'filled',
      'skipped',
      'failed',
    ]);
  });

  it('creates select-like fields with options', () => {
    const field = createFormField({
      id: 'f1',
      type: 'select',
      label: 'Nível de experiência',
      required: true,
      options: [
        { value: 'jr', label: 'Júnior' },
        { value: 'sr', label: 'Sênior' },
      ],
      confidence: 'medium',
    });
    expect(field.required).toBe(true);
    expect(field.options).toHaveLength(2);
    expect(field.confidence).toBe('medium');
    expect(field.fillStatus).toBe('pending');
  });
});

describe('ApplicationAttempt model (E2-S1-T4)', () => {
  it('tracks logs, pendings and failures with defaults', () => {
    const attempt = createApplicationAttempt({ id: 'a1', jobId: 'j1' });
    expect(attempt.result).toBe('pending');
    expect(attempt.logs).toEqual([]);
    expect(attempt.pendings).toEqual([]);
    expect(attempt.failures).toEqual([]);
    expect(attempt.filledFields).toEqual([]);
  });

  it('accepts enriched logs, pendings, and a final result', () => {
    const attempt = createApplicationAttempt({
      id: 'a2',
      jobId: 'j2',
      startedAt: '2026-04-16T12:00:00.000Z',
      endedAt: '2026-04-16T12:05:00.000Z',
      result: 'failed',
      logs: [
        { at: '2026-04-16T12:00:01.000Z', level: 'info', message: 'opened job', step: 0 },
      ],
      failures: [
        { at: '2026-04-16T12:04:30.000Z', message: 'captcha detected', step: 2 },
      ],
      pendings: [
        {
          field: createFormField({ id: 'f1', type: 'text', label: 'Salário desejado', required: true }),
          reason: 'no profile answer',
          createdAt: '2026-04-16T12:02:00.000Z',
        },
      ],
    });
    expect(attempt.result).toBe('failed');
    expect(attempt.pendings[0].field.label).toBe('Salário desejado');
    expect(attempt.failures[0].message).toBe('captcha detected');
  });
});

describe('SavedAnswer model (E2-S1-T5)', () => {
  it('supports the three reuse modes required by the PRD', () => {
    expect(Array.from(REUSE_MODES)).toEqual(['suggest', 'auto', 'confirm']);
  });

  it('creates answers with defaults, including suggest mode', () => {
    const answer = createSavedAnswer({
      id: 's1',
      label: 'Pretensão salarial',
      value: 'R$ 12.000',
    });
    expect(answer.reuseMode).toBe('suggest');
    expect(answer.useCount).toBe(0);
    expect(answer.keywords).toEqual([]);
    expect(answer.fieldTypes).toEqual([]);
  });

  it('respects overrides for reuseMode and scoping metadata', () => {
    const answer = createSavedAnswer({
      id: 's2',
      label: 'Anos de experiência',
      value: '5',
      reuseMode: 'auto',
      fieldTypes: ['text', 'select'],
      keywords: ['experiência', 'years of experience'],
    });
    expect(answer.reuseMode).toBe('auto');
    expect(answer.fieldTypes).toEqual(['text', 'select']);
  });
});
