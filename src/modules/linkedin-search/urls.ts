export const LINKEDIN_JOBS_SEARCH_URL = 'https://www.linkedin.com/jobs/search/';

export interface LinkedInSearchParams {
  keywords?: string;
  location?: string;
}

export function isLinkedInJobsUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('linkedin.com')) return false;
    return parsed.pathname.startsWith('/jobs/');
  } catch {
    return false;
  }
}

export function buildLinkedInJobsUrl(params: LinkedInSearchParams): string {
  const search = new URLSearchParams();
  if (params.keywords && params.keywords.trim()) {
    search.set('keywords', params.keywords.trim());
  }
  if (params.location && params.location.trim()) {
    search.set('location', params.location.trim());
  }
  const query = search.toString();
  return query ? `${LINKEDIN_JOBS_SEARCH_URL}?${query}` : LINKEDIN_JOBS_SEARCH_URL;
}
