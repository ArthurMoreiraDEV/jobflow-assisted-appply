export const NAVIGATION_HANDLER_MODULE = 'navigation-handler';

export type { ApplicationLocation } from './location';
export {
  classifyApplicationLocation,
  hasLeftLinkedIn,
  hasReturnedToLinkedIn,
  isExternalApplicationUrl,
  isLinkedInApplicationUrl,
} from './location';

export type {
  LocationChange,
  NavigationDrivers,
  NavigationHandler,
  NavigationHandlerOptions,
} from './handler';
export { DEFAULT_LINKEDIN_RETURN_URL, createNavigationHandler } from './handler';
