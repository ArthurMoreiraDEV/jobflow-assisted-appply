import type { FormField } from '../form-parser/types';

export const APPLICATION_RESULTS = [
  'pending',
  'success',
  'failed',
  'skipped',
] as const;

export type ApplicationResult = (typeof APPLICATION_RESULTS)[number];

export const LOG_LEVELS = ['info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export interface ApplicationLogEntry {
  at: string;
  level: LogLevel;
  message: string;
  step?: number;
}

export interface ApplicationPendingField {
  field: FormField;
  reason: string;
  createdAt: string;
}

export interface ApplicationFailure {
  at: string;
  message: string;
  step?: number;
  stack?: string;
}

export interface ApplicationAttempt {
  id: string;
  jobId: string;
  startedAt: string;
  endedAt?: string;
  result: ApplicationResult;
  logs: ApplicationLogEntry[];
  pendings: ApplicationPendingField[];
  failures: ApplicationFailure[];
  filledFields: string[];
  currentStep?: number;
}

export function createApplicationAttempt(
  overrides: Partial<ApplicationAttempt> & Pick<ApplicationAttempt, 'id' | 'jobId'>,
): ApplicationAttempt {
  return {
    startedAt: new Date(0).toISOString(),
    result: 'pending',
    logs: [],
    pendings: [],
    failures: [],
    filledFields: [],
    ...overrides,
  };
}
