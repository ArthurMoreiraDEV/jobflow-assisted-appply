import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyApplicationLocation,
  createNavigationHandler,
  DEFAULT_LINKEDIN_RETURN_URL,
  hasLeftLinkedIn,
  hasReturnedToLinkedIn,
  isExternalApplicationUrl,
  isLinkedInApplicationUrl,
  type LocationChange,
  type NavigationDrivers,
} from '../src/modules/navigation-handler';
import {
  buildExecutorQueueHandler,
  createApplicationExecutor,
  createDocumentDriver,
  type PageDriver,
} from '../src/modules/executor';
import { createCandidateProfile } from '../src/modules/profile';
import { createJobListing } from '../src/modules/job-list';
import type { QueueEntry } from '../src/modules/storage';

function htmlDoc(markup: string): Document {
  const doc = document.implementation.createHTMLDocument('nav');
  doc.body.innerHTML = markup;
  return doc;
}

function makeEntry(overrides: Partial<QueueEntry['job']> = {}): QueueEntry {
  return {
    position: 0,
    job: createJobListing({
      id: 'job-ext',
      title: 'Dev',
      company: 'Co',
      url: 'https://www.linkedin.com/jobs/view/42',
      status: 'queued',
      ...overrides,
    }),
  };
}

describe('location helpers (E10-S1 T1)', () => {
  it('classifies URLs as linkedin, external, or unknown', () => {
    expect(classifyApplicationLocation('https://www.linkedin.com/jobs/view/1')).toBe(
      'linkedin',
    );
    expect(classifyApplicationLocation('https://br.linkedin.com/jobs/view/1')).toBe(
      'linkedin',
    );
    expect(classifyApplicationLocation('https://apply.workable.com/x/123')).toBe(
      'external',
    );
    expect(classifyApplicationLocation('')).toBe('unknown');
    expect(classifyApplicationLocation(null)).toBe('unknown');
    expect(classifyApplicationLocation('nonsense')).toBe('unknown');
  });

  it('exposes convenience predicates', () => {
    expect(isLinkedInApplicationUrl('https://www.linkedin.com/jobs/view/1')).toBe(true);
    expect(isExternalApplicationUrl('https://apply.workable.com/x')).toBe(true);
    expect(isExternalApplicationUrl('https://www.linkedin.com/jobs/view/1')).toBe(false);
  });

  it('detects left-linkedin and returned-to-linkedin transitions', () => {
    expect(
      hasLeftLinkedIn(
        'https://www.linkedin.com/jobs/view/1',
        'https://apply.workable.com/x',
      ),
    ).toBe(true);
    expect(
      hasLeftLinkedIn(
        'https://www.linkedin.com/jobs/view/1',
        'https://www.linkedin.com/jobs/view/2',
      ),
    ).toBe(false);
    expect(
      hasReturnedToLinkedIn(
        'https://apply.workable.com/x',
        'https://www.linkedin.com/jobs/',
      ),
    ).toBe(true);
    expect(
      hasReturnedToLinkedIn(
        'https://www.linkedin.com/jobs/1',
        'https://www.linkedin.com/jobs/2',
      ),
    ).toBe(false);
  });
});

describe('createNavigationHandler (E10-S1)', () => {
  let currentUrl: string;
  let linkedinDriver: PageDriver;
  let externalDriver: PageDriver;
  let drivers: NavigationDrivers;
  const linkedinDoc = htmlDoc('<main data-source="linkedin"></main>');
  const externalDoc = htmlDoc('<main data-source="external"></main>');

  beforeEach(() => {
    currentUrl = 'https://www.linkedin.com/jobs/view/1';
    linkedinDriver = {
      open: vi.fn(async () => undefined),
      getRoot: vi.fn(() => linkedinDoc),
      advance: vi.fn(async () => ({ kind: 'advanced' }) as const),
      close: vi.fn(async () => undefined),
    };
    externalDriver = {
      open: vi.fn(async () => undefined),
      getRoot: vi.fn(() => externalDoc),
      advance: vi.fn(async () => ({ kind: 'submitted' }) as const),
      close: vi.fn(async () => undefined),
    };
    drivers = { linkedin: linkedinDriver, external: externalDriver };
  });

  it('T1 - reports the current application location via getLocation', () => {
    const handler = createNavigationHandler({
      getCurrentUrl: () => currentUrl,
      drivers,
    });
    expect(handler.getLocation()).toBe('linkedin');
    currentUrl = 'https://apply.workable.com/x/123';
    expect(handler.getLocation()).toBe('external');
  });

  it('T1 - emits onLocationChange when the app leaves LinkedIn', () => {
    const changes: LocationChange[] = [];
    const handler = createNavigationHandler({
      getCurrentUrl: () => currentUrl,
      drivers,
      onLocationChange: (change) => changes.push(change),
    });
    const driver = handler.createDriver();

    // initial advance on LinkedIn
    void driver.advance();
    // simulate redirect to external form mid-flow
    currentUrl = 'https://apply.workable.com/x/123';
    handler.getLocation();

    expect(changes).toEqual([
      {
        from: 'linkedin',
        to: 'external',
        url: 'https://apply.workable.com/x/123',
      },
    ]);
  });

  it('T2 - delegates getRoot and advance to the driver matching current location', async () => {
    const handler = createNavigationHandler({
      getCurrentUrl: () => currentUrl,
      drivers,
    });
    const driver = handler.createDriver();

    expect(driver.getRoot()).toBe(linkedinDoc);
    await driver.advance();
    expect(linkedinDriver.advance).toHaveBeenCalledTimes(1);
    expect(externalDriver.advance).not.toHaveBeenCalled();

    currentUrl = 'https://apply.workable.com/x/1';
    expect(driver.getRoot()).toBe(externalDoc);
    const outcome = await driver.advance();
    expect(outcome.kind).toBe('submitted');
    expect(externalDriver.advance).toHaveBeenCalledTimes(1);
  });

  it('T2 - open routes to the driver matching the target url', async () => {
    const handler = createNavigationHandler({
      getCurrentUrl: () => currentUrl,
      drivers,
    });
    const driver = handler.createDriver();

    await driver.open?.('https://apply.workable.com/x/1');
    expect(externalDriver.open).toHaveBeenCalledWith('https://apply.workable.com/x/1');
    expect(linkedinDriver.open).not.toHaveBeenCalled();

    await driver.open?.('https://www.linkedin.com/jobs/view/2');
    expect(linkedinDriver.open).toHaveBeenCalledWith(
      'https://www.linkedin.com/jobs/view/2',
    );
  });

  it('T3 - close triggers returnToLinkedIn with the configured return url', async () => {
    const returnToLinkedIn = vi.fn(async (url: string) => {
      currentUrl = url;
    });
    const handler = createNavigationHandler({
      getCurrentUrl: () => currentUrl,
      drivers,
      returnToLinkedIn,
      linkedInReturnUrl: 'https://www.linkedin.com/jobs/collections/recommended/',
    });
    const driver = handler.createDriver();
    currentUrl = 'https://apply.workable.com/x/1';

    await driver.close?.();

    expect(linkedinDriver.close).toHaveBeenCalledTimes(1);
    expect(externalDriver.close).toHaveBeenCalledTimes(1);
    expect(returnToLinkedIn).toHaveBeenCalledWith(
      'https://www.linkedin.com/jobs/collections/recommended/',
    );
    expect(handler.getLocation()).toBe('linkedin');
  });

  it('T3 - returnToLinkedIn() uses the default url when no override is passed', async () => {
    const returnToLinkedIn = vi.fn(async (url: string) => {
      currentUrl = url;
    });
    const handler = createNavigationHandler({
      getCurrentUrl: () => currentUrl,
      drivers,
      returnToLinkedIn,
    });

    await handler.returnToLinkedIn();

    expect(returnToLinkedIn).toHaveBeenCalledWith(DEFAULT_LINKEDIN_RETURN_URL);
  });
});

describe('navigation handler ↔ executor integration (E10-S1)', () => {
  it('continues filling after a LinkedIn → external redirect and returns to LinkedIn on finish', async () => {
    const linkedinDoc = htmlDoc(`
      <section data-form-step="1">
        <label for="name">Nome completo</label>
        <input id="name" name="fullName" type="text" required />
        <button type="button" data-easy-apply-next>Avançar</button>
      </section>
    `);
    const externalDoc = htmlDoc(`
      <section data-form-step="1">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" required />
        <button type="button" data-easy-apply-submit>Enviar</button>
      </section>
    `);

    let currentUrl = 'https://www.linkedin.com/jobs/view/42';
    const linkedinDriver = createDocumentDriver({ root: linkedinDoc });
    const wrappedLinkedIn: PageDriver = {
      ...linkedinDriver,
      advance: async () => {
        const outcome = await linkedinDriver.advance();
        if (outcome.kind === 'advanced') {
          currentUrl = 'https://apply.workable.com/x/42';
        }
        return outcome;
      },
    };
    const externalDriver = createDocumentDriver({ root: externalDoc });

    const changes: LocationChange[] = [];
    const returnToLinkedIn = vi.fn(async (url: string) => {
      currentUrl = url;
    });

    const handler = createNavigationHandler({
      getCurrentUrl: () => currentUrl,
      drivers: { linkedin: wrappedLinkedIn, external: externalDriver },
      onLocationChange: (change) => changes.push(change),
      returnToLinkedIn,
    });

    const profile = createCandidateProfile({
      fullName: 'Ana Silva',
      contact: { email: 'ana@example.com' },
    });
    const executor = createApplicationExecutor({
      profile,
      idGenerator: () => 'att-nav',
    });
    const queueHandler = buildExecutorQueueHandler(executor, () =>
      handler.createDriver(),
    );

    const outcome = await queueHandler(makeEntry());

    expect(outcome.status).toBe('success');
    expect((linkedinDoc.getElementById('name') as HTMLInputElement).value).toBe(
      'Ana Silva',
    );
    expect((externalDoc.getElementById('email') as HTMLInputElement).value).toBe(
      'ana@example.com',
    );
    expect(changes.map((c) => `${c.from}->${c.to}`)).toContain('linkedin->external');
    expect(returnToLinkedIn).toHaveBeenCalled();
  });
});
