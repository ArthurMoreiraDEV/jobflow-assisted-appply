export const QUEUE_MANAGER_MODULE = 'queue-manager';

export {
  createQueueManager,
  InvalidJobStatusTransitionError,
} from './manager';
export type {
  QueueManager,
  QueueManagerState,
  QueueProcessHandler,
  QueueProcessOutcome,
  TerminalJobStatus,
} from './manager';

export {
  allowedJobStatusTransitions,
  isValidJobStatusTransition,
} from './transitions';
