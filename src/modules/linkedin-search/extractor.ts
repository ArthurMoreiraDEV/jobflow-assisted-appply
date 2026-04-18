import { createJobListing, type JobListing } from '../job-list';

const JOB_CARD_SELECTORS = [
  'li[data-occludable-job-id]',
  'li.jobs-search-results__list-item',
  'div.job-card-container',
  'div.base-card[data-entity-urn*="jobPosting"]',
];

const TITLE_SELECTORS = [
  'a.job-card-container__link',
  'a.job-card-list__title',
  '.job-card-list__title',
  '.base-search-card__title',
  'h3',
];

const COMPANY_SELECTORS = [
  '.job-card-container__company-name',
  '.job-card-container__primary-description',
  '.base-search-card__subtitle',
  '.artdeco-entity-lockup__subtitle',
];

const LOCATION_SELECTORS = [
  '.job-card-container__metadata-item',
  '.job-search-card__location',
  '.base-search-card__metadata .job-search-card__location',
  '.artdeco-entity-lockup__caption',
];

function textOf(node: Element | null | undefined): string {
  if (!node) return '';
  return (node.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function pickText(root: Element, selectors: string[]): string {
  for (const selector of selectors) {
    const match = root.querySelector(selector);
    const text = textOf(match);
    if (text) return text;
  }
  return '';
}

function pickAnchor(root: Element): HTMLAnchorElement | null {
  for (const selector of TITLE_SELECTORS) {
    const el = root.querySelector(selector);
    if (el instanceof HTMLAnchorElement) return el;
  }
  const fallback = root.querySelector('a[href*="/jobs/view/"]');
  return fallback instanceof HTMLAnchorElement ? fallback : null;
}

function extractJobId(card: Element, url: string | undefined): string | undefined {
  const datasetId = (card as HTMLElement).dataset?.occludableJobId;
  if (datasetId) return datasetId;
  const urnAttr = card.getAttribute('data-entity-urn');
  if (urnAttr) {
    const match = urnAttr.match(/(\d{5,})/);
    if (match) return match[1];
  }
  if (url) {
    const match = url.match(/\/jobs\/view\/(\d+)/);
    if (match) return match[1];
  }
  return undefined;
}

function absolutizeUrl(href: string | undefined | null): string {
  if (!href) return '';
  try {
    return new URL(href, 'https://www.linkedin.com').toString();
  } catch {
    return href;
  }
}

export function extractJobListingsFromDom(root: ParentNode): JobListing[] {
  const now = new Date().toISOString();
  const seen = new Set<string>();
  const listings: JobListing[] = [];

  for (const selector of JOB_CARD_SELECTORS) {
    const cards = root.querySelectorAll(selector);
    for (const card of Array.from(cards)) {
      const anchor = pickAnchor(card);
      const title = textOf(anchor) || pickText(card, TITLE_SELECTORS);
      if (!title) continue;

      const rawHref = anchor?.getAttribute('href') ?? '';
      const url = absolutizeUrl(rawHref);
      const id = extractJobId(card, url) ?? `linkedin-${listings.length}-${Date.now()}`;
      if (seen.has(id)) continue;
      seen.add(id);

      const company = pickText(card, COMPANY_SELECTORS);
      const location = pickText(card, LOCATION_SELECTORS);

      listings.push(
        createJobListing({
          id,
          title,
          company,
          location,
          url,
          source: 'linkedin',
          status: 'discovered',
          discoveredAt: now,
          updatedAt: now,
        }),
      );
    }
  }

  return listings;
}
