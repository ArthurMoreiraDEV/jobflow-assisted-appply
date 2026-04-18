import type { AdvanceOutcome, PageDriver } from '../executor/driver';
import {
  classifyApplicationLocation,
  type ApplicationLocation,
} from './location';

export interface NavigationDrivers {
  linkedin: PageDriver;
  external: PageDriver;
}

export interface LocationChange {
  from: ApplicationLocation;
  to: ApplicationLocation;
  url: string;
}

export interface NavigationHandlerOptions {
  getCurrentUrl: () => string;
  drivers: NavigationDrivers;
  linkedInReturnUrl?: string;
  returnToLinkedIn?: (url: string) => Promise<void> | void;
  onLocationChange?: (change: LocationChange) => void;
}

export interface NavigationHandler {
  getLocation(): ApplicationLocation;
  createDriver(): PageDriver;
  returnToLinkedIn(): Promise<void>;
}

export const DEFAULT_LINKEDIN_RETURN_URL = 'https://www.linkedin.com/jobs/';

export function createNavigationHandler(
  options: NavigationHandlerOptions,
): NavigationHandler {
  const { getCurrentUrl, drivers, onLocationChange } = options;
  const returnUrl = options.linkedInReturnUrl ?? DEFAULT_LINKEDIN_RETURN_URL;

  let lastLocation: ApplicationLocation = classifyApplicationLocation(getCurrentUrl());

  function syncLocation(): ApplicationLocation {
    const url = getCurrentUrl();
    const next = classifyApplicationLocation(url);
    if (next !== lastLocation) {
      const change: LocationChange = { from: lastLocation, to: next, url };
      lastLocation = next;
      onLocationChange?.(change);
    }
    return next;
  }

  function selectDriver(location: ApplicationLocation): PageDriver {
    return location === 'external' ? drivers.external : drivers.linkedin;
  }

  async function performReturn(): Promise<void> {
    if (options.returnToLinkedIn) {
      await options.returnToLinkedIn(returnUrl);
    }
    syncLocation();
  }

  const composite: PageDriver = {
    async open(url: string) {
      const target = classifyApplicationLocation(url);
      const driver = selectDriver(target);
      if (driver.open) {
        await driver.open(url);
      }
      syncLocation();
    },
    getRoot() {
      const current = syncLocation();
      return selectDriver(current).getRoot();
    },
    async advance(): Promise<AdvanceOutcome> {
      const before = syncLocation();
      const outcome = await selectDriver(before).advance();
      syncLocation();
      return outcome;
    },
    async close() {
      const tasks: Array<Promise<unknown>> = [];
      if (drivers.linkedin.close) tasks.push(Promise.resolve(drivers.linkedin.close()));
      if (drivers.external.close) tasks.push(Promise.resolve(drivers.external.close()));
      await Promise.allSettled(tasks);
      await performReturn();
    },
  };

  return {
    getLocation: () => syncLocation(),
    createDriver: () => composite,
    returnToLinkedIn: performReturn,
  };
}
