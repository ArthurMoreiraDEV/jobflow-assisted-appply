import type { CandidateProfile } from '../profile';
import type { SavedAnswer } from '../form-filler';
import { fillFields, type FillReport } from '../form-filler';
import { detectCurrentStep, parseFormFields } from '../form-parser';
import type { QueueEntry, HistoryRepository } from '../storage';
import type { TerminalJobStatus } from '../queue-manager';
import type { PageDriver } from './driver';
import type {
  ApplicationAttempt,
  ApplicationLogEntry,
  ApplicationPendingField,
  ApplicationResult,
} from './types';
import { createApplicationAttempt } from './types';

export interface ExecutorContext {
  profile?: CandidateProfile;
  savedAnswers?: SavedAnswer[];
  maxSteps?: number;
  now?: () => string;
  idGenerator?: () => string;
  history?: HistoryRepository;
}

export interface ExecutorRunResult {
  attempt: ApplicationAttempt;
  status: TerminalJobStatus;
}

export interface ApplicationExecutor {
  run(entry: QueueEntry, driver: PageDriver): Promise<ExecutorRunResult>;
}

const DEFAULT_MAX_STEPS = 12;

function resultToTerminalStatus(result: ApplicationResult): TerminalJobStatus {
  return result;
}

function defaultIdGenerator(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function pushLog(
  attempt: ApplicationAttempt,
  entry: ApplicationLogEntry,
): void {
  attempt.logs.push(entry);
}

function uniqueFilled(attempt: ApplicationAttempt, ids: string[]): void {
  const set = new Set(attempt.filledFields);
  for (const id of ids) set.add(id);
  attempt.filledFields = Array.from(set);
}

function mergePendings(
  attempt: ApplicationAttempt,
  pendings: ApplicationPendingField[],
): void {
  const seen = new Set(attempt.pendings.map((p) => p.field.id));
  for (const pending of pendings) {
    if (seen.has(pending.field.id)) continue;
    attempt.pendings.push(pending);
    seen.add(pending.field.id);
  }
}

export function createApplicationExecutor(
  context: ExecutorContext = {},
): ApplicationExecutor {
  const now = context.now ?? (() => new Date().toISOString());
  const idGenerator = context.idGenerator ?? defaultIdGenerator;
  const maxSteps = context.maxSteps ?? DEFAULT_MAX_STEPS;

  async function finalize(
    attempt: ApplicationAttempt,
    result: ApplicationResult,
  ): Promise<ExecutorRunResult> {
    attempt.result = result;
    attempt.endedAt = now();
    if (context.history) {
      await context.history.upsert(attempt);
    }
    return { attempt, status: resultToTerminalStatus(result) };
  }

  async function run(
    entry: QueueEntry,
    driver: PageDriver,
  ): Promise<ExecutorRunResult> {
    const attempt = createApplicationAttempt({
      id: idGenerator(),
      jobId: entry.job.id,
      startedAt: now(),
    });

    try {
      if (driver.open) {
        await driver.open(entry.job.url);
        pushLog(attempt, {
          at: now(),
          level: 'info',
          message: `Vaga aberta: ${entry.job.url}`,
        });
      }

      let iteration = 0;
      const visitedSteps = new Set<number>();

      while (iteration < maxSteps) {
        iteration += 1;
        const root = driver.getRoot();
        const fields = parseFormFields(root);
        const detectedStep =
          fields.find((field) => field.step !== undefined)?.step ??
          detectCurrentStep(root);
        const step = detectedStep ?? iteration;
        attempt.currentStep = step;

        pushLog(attempt, {
          at: now(),
          level: 'info',
          step,
          message: `Processando step ${step}`,
        });
        const report: FillReport = fillFields(root, fields, {
          profile: context.profile,
          savedAnswers: context.savedAnswers,
          now,
        });

        uniqueFilled(
          attempt,
          report.filled.map((field) => field.id),
        );

        for (const outcome of report.outcomes) {
          if (outcome.fillStatus === 'failed') {
            attempt.failures.push({
              at: now(),
              step,
              message: outcome.error ?? 'Falha ao preencher campo.',
            });
          }
        }

        mergePendings(attempt, report.pendings);

        if (report.pendings.length > 0) {
          pushLog(attempt, {
            at: now(),
            level: 'warn',
            step,
            message: `${report.pendings.length} campo(s) pendente(s) neste step.`,
          });
          return await finalize(attempt, 'pending');
        }

        const outcome = await driver.advance();
        if (outcome.kind === 'submitted') {
          pushLog(attempt, {
            at: now(),
            level: 'info',
            step,
            message: 'Candidatura enviada.',
          });
          return await finalize(attempt, 'success');
        }

        if (outcome.kind === 'blocked') {
          const message = outcome.message ?? 'Step bloqueado pelo formulário.';
          attempt.failures.push({ at: now(), step, message });
          pushLog(attempt, {
            at: now(),
            level: 'error',
            step,
            message,
          });
          return await finalize(attempt, 'failed');
        }

        if (visitedSteps.has(step) && detectedStep !== undefined) {
          const message = `Step ${step} não avançou após tentativa.`;
          attempt.failures.push({ at: now(), step, message });
          pushLog(attempt, { at: now(), level: 'error', step, message });
          return await finalize(attempt, 'failed');
        }
        visitedSteps.add(step);
      }

      const message = 'Número máximo de steps excedido.';
      attempt.failures.push({ at: now(), message });
      pushLog(attempt, { at: now(), level: 'error', message });
      return await finalize(attempt, 'failed');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      attempt.failures.push({
        at: now(),
        message,
        stack: error instanceof Error ? error.stack : undefined,
      });
      pushLog(attempt, { at: now(), level: 'error', message });
      return await finalize(attempt, 'failed');
    } finally {
      if (driver.close) {
        try {
          await driver.close();
        } catch {
          // swallow — closing is best-effort
        }
      }
    }
  }

  return { run };
}

export function buildExecutorQueueHandler(
  executor: ApplicationExecutor,
  driverFactory: (entry: QueueEntry) => PageDriver | Promise<PageDriver>,
) {
  return async (entry: QueueEntry) => {
    const driver = await driverFactory(entry);
    const { status } = await executor.run(entry, driver);
    return { status };
  };
}
