import type { JobStatus } from '../job-list';
import type { QueueEntry, QueueRepository } from '../storage';
import { isValidJobStatusTransition } from './transitions';

export type TerminalJobStatus = 'success' | 'pending' | 'failed' | 'skipped';

export interface QueueProcessOutcome {
  status: TerminalJobStatus;
}

export type QueueProcessHandler = (
  entry: QueueEntry,
) => Promise<QueueProcessOutcome> | QueueProcessOutcome;

export interface QueueManagerState {
  isRunning: boolean;
  currentJobId: string | null;
}

export interface QueueManager {
  getState(): QueueManagerState;
  list(): Promise<QueueEntry[]>;
  setStatus(jobId: string, status: JobStatus): Promise<QueueEntry[]>;
  remove(jobId: string): Promise<QueueEntry[]>;
  processNext(handler: QueueProcessHandler): Promise<QueueEntry | null>;
  start(handler: QueueProcessHandler): Promise<void>;
  stop(): void;
}

function isProcessable(status: JobStatus): boolean {
  return status === 'queued';
}

export class InvalidJobStatusTransitionError extends Error {
  readonly from: JobStatus;
  readonly to: JobStatus;
  constructor(from: JobStatus, to: JobStatus) {
    super(`Invalid job status transition: ${from} -> ${to}`);
    this.name = 'InvalidJobStatusTransitionError';
    this.from = from;
    this.to = to;
  }
}

export function createQueueManager(repository: QueueRepository): QueueManager {
  const state: QueueManagerState = {
    isRunning: false,
    currentJobId: null,
  };
  let stopRequested = false;

  async function safeUpdateStatus(
    jobId: string,
    nextStatus: JobStatus,
  ): Promise<QueueEntry[]> {
    const entries = await repository.list();
    const entry = entries.find((candidate) => candidate.job.id === jobId);
    if (!entry) return entries;
    if (!isValidJobStatusTransition(entry.job.status, nextStatus)) {
      throw new InvalidJobStatusTransitionError(entry.job.status, nextStatus);
    }
    return repository.updateStatus(jobId, nextStatus);
  }

  async function processNext(
    handler: QueueProcessHandler,
  ): Promise<QueueEntry | null> {
    const entries = await repository.list();
    const next = entries.find((entry) => isProcessable(entry.job.status));
    if (!next) return null;

    await safeUpdateStatus(next.job.id, 'processing');
    state.currentJobId = next.job.id;
    const processingEntry: QueueEntry = {
      ...next,
      job: { ...next.job, status: 'processing' },
    };

    let outcome: QueueProcessOutcome;
    try {
      outcome = await handler(processingEntry);
    } catch (err) {
      await safeUpdateStatus(next.job.id, 'failed');
      state.currentJobId = null;
      throw err;
    }

    await safeUpdateStatus(next.job.id, outcome.status);
    state.currentJobId = null;
    return { ...processingEntry, job: { ...processingEntry.job, status: outcome.status } };
  }

  async function start(handler: QueueProcessHandler): Promise<void> {
    if (state.isRunning) return;
    state.isRunning = true;
    stopRequested = false;
    try {
      while (!stopRequested) {
        const processed = await processNext(handler);
        if (!processed) break;
      }
    } finally {
      state.isRunning = false;
      state.currentJobId = null;
    }
  }

  function stop(): void {
    stopRequested = true;
  }

  return {
    getState() {
      return { ...state };
    },
    list() {
      return repository.list();
    },
    async setStatus(jobId, status) {
      return safeUpdateStatus(jobId, status);
    },
    async remove(jobId) {
      return repository.remove(jobId);
    },
    processNext,
    start,
    stop,
  };
}
