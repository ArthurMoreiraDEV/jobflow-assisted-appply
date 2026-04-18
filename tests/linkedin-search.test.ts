import { describe, expect, it } from 'vitest';
import {
  buildLinkedInJobsUrl,
  extractJobListingsFromDom,
  isLinkedInJobsUrl,
} from '../src/modules/linkedin-search';

describe('LinkedIn URL helpers', () => {
  it('detects LinkedIn jobs URLs', () => {
    expect(isLinkedInJobsUrl('https://www.linkedin.com/jobs/search/?keywords=dev')).toBe(
      true,
    );
    expect(isLinkedInJobsUrl('https://www.linkedin.com/jobs/view/12345')).toBe(true);
    expect(isLinkedInJobsUrl('https://www.linkedin.com/feed/')).toBe(false);
    expect(isLinkedInJobsUrl('https://example.com/jobs/search')).toBe(false);
    expect(isLinkedInJobsUrl(undefined)).toBe(false);
    expect(isLinkedInJobsUrl('')).toBe(false);
  });

  it('builds search URL with keywords and location', () => {
    const url = buildLinkedInJobsUrl({ keywords: 'react dev', location: 'Brasil' });
    expect(url).toContain('https://www.linkedin.com/jobs/search/?');
    expect(url).toContain('keywords=react+dev');
    expect(url).toContain('location=Brasil');
  });

  it('omits empty query params', () => {
    expect(buildLinkedInJobsUrl({})).toBe('https://www.linkedin.com/jobs/search/');
    expect(buildLinkedInJobsUrl({ keywords: '   ' })).toBe(
      'https://www.linkedin.com/jobs/search/',
    );
  });
});

describe('extractJobListingsFromDom', () => {
  function buildDom(): Document {
    const doc = document.implementation.createHTMLDocument('test');
    doc.body.innerHTML = `
      <ul>
        <li data-occludable-job-id="111" class="jobs-search-results__list-item">
          <a class="job-card-container__link" href="/jobs/view/111/?x=1">Engenheiro de Software</a>
          <div class="job-card-container__company-name">Acme Corp</div>
          <div class="job-card-container__metadata-item">Remote · São Paulo, Brasil</div>
        </li>
        <li data-occludable-job-id="222" class="jobs-search-results__list-item">
          <a class="job-card-container__link" href="https://www.linkedin.com/jobs/view/222/">Designer</a>
          <div class="job-card-container__company-name">Beta LTDA</div>
          <div class="job-card-container__metadata-item">Rio de Janeiro</div>
        </li>
        <li data-occludable-job-id="111" class="jobs-search-results__list-item">
          <a class="job-card-container__link" href="/jobs/view/111/">Duplicate</a>
          <div class="job-card-container__company-name">Acme Corp</div>
        </li>
      </ul>
    `;
    return doc;
  }

  it('extracts title, company, location, URL from LinkedIn job cards', () => {
    const listings = extractJobListingsFromDom(buildDom());
    expect(listings).toHaveLength(2);

    const [first, second] = listings;
    expect(first.id).toBe('111');
    expect(first.title).toBe('Engenheiro de Software');
    expect(first.company).toBe('Acme Corp');
    expect(first.location).toContain('São Paulo');
    expect(first.url).toBe('https://www.linkedin.com/jobs/view/111/?x=1');
    expect(first.source).toBe('linkedin');
    expect(first.status).toBe('discovered');

    expect(second.id).toBe('222');
    expect(second.title).toBe('Designer');
    expect(second.company).toBe('Beta LTDA');
  });

  it('returns an empty list when no cards match', () => {
    const doc = document.implementation.createHTMLDocument('test');
    doc.body.innerHTML = '<div>No jobs here</div>';
    expect(extractJobListingsFromDom(doc)).toEqual([]);
  });
});
