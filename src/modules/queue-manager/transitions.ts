import type { JobStatus } from '../job-list';

const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  discovered: ['selected', 'skipped'],
  selected: ['queued', 'discovered', 'skipped'],
  queued: ['processing', 'skipped', 'selected'],
  processing: ['success', 'pending', 'failed', 'skipped'],
  pending: ['processing', 'success', 'failed', 'skipped', 'queued'],
  success: [],
  failed: ['queued', 'skipped'],
  skipped: ['queued'],
};

export function isValidJobStatusTransition(
  from: JobStatus,
  to: JobStatus,
): boolean {
  if (from === to) return true;
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function allowedJobStatusTransitions(
  from: JobStatus,
): readonly JobStatus[] {
  return ALLOWED_TRANSITIONS[from];
}
