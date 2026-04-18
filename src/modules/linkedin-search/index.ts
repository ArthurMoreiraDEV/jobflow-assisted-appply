export const LINKEDIN_SEARCH_MODULE = 'linkedin-search';

export {
  LINKEDIN_JOBS_SEARCH_URL,
  buildLinkedInJobsUrl,
  isLinkedInJobsUrl,
} from './urls';
export type { LinkedInSearchParams } from './urls';

export { extractJobListingsFromDom } from './extractor';

export { extractFromActiveTab, openLinkedInSearch } from './client';
export type { ExtractFromActiveTabResult } from './client';

export { LINKEDIN_SEARCH_MESSAGE } from './messages';
export type {
  LinkedInSearchRequest,
  LinkedInSearchPingRequest,
  LinkedInSearchPingResponse,
  LinkedInSearchExtractRequest,
  LinkedInSearchExtractResponse,
} from './messages';
