import type { JobListing } from '../job-list';

export const LINKEDIN_SEARCH_MESSAGE = {
  ping: 'linkedin-search:ping',
  extract: 'linkedin-search:extract',
} as const;

export interface LinkedInSearchPingRequest {
  type: typeof LINKEDIN_SEARCH_MESSAGE.ping;
}

export interface LinkedInSearchPingResponse {
  ok: boolean;
  url: string;
  onLinkedInJobs: boolean;
}

export interface LinkedInSearchExtractRequest {
  type: typeof LINKEDIN_SEARCH_MESSAGE.extract;
}

export interface LinkedInSearchExtractResponse {
  ok: boolean;
  url: string;
  listings: JobListing[];
  error?: string;
}

export type LinkedInSearchRequest =
  | LinkedInSearchPingRequest
  | LinkedInSearchExtractRequest;
