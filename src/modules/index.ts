export { PROFILE_MODULE } from './profile';
export { LINKEDIN_SEARCH_MODULE } from './linkedin-search';
export { JOB_LIST_MODULE } from './job-list';
export { QUEUE_MANAGER_MODULE } from './queue-manager';
export { FORM_PARSER_MODULE } from './form-parser';
export { FORM_FILLER_MODULE } from './form-filler';
export { EXECUTOR_MODULE } from './executor';
export { NAVIGATION_HANDLER_MODULE } from './navigation-handler';
export { STORAGE_MODULE } from './storage';

export const MODULES = [
  'profile',
  'linkedin-search',
  'job-list',
  'queue-manager',
  'form-parser',
  'form-filler',
  'executor',
  'navigation-handler',
  'storage',
] as const;

export type ModuleName = (typeof MODULES)[number];
