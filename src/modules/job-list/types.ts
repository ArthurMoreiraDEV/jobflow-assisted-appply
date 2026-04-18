export const JOB_STATUSES = [
  'discovered',
  'selected',
  'queued',
  'processing',
  'success',
  'pending',
  'failed',
  'skipped',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobSource = 'linkedin' | 'external';

export interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  url: string;
  source: JobSource;
  status: JobStatus;
  externalApplyUrl?: string;
  description?: string;
  discoveredAt: string;
  updatedAt: string;
}

export function createJobListing(
  overrides: Partial<JobListing> & Pick<JobListing, 'id' | 'title' | 'company' | 'url'>,
): JobListing {
  const now = new Date(0).toISOString();
  return {
    location: '',
    source: 'linkedin',
    status: 'discovered',
    discoveredAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return status === 'success' || status === 'failed' || status === 'skipped';
}
