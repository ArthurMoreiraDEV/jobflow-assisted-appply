import { describe, expect, it } from 'vitest';
import { MODULES } from '../src/modules';

describe('module structure', () => {
  it('exposes all nine MVP modules required by E1-S1-T2', () => {
    expect(MODULES).toEqual([
      'profile',
      'linkedin-search',
      'job-list',
      'queue-manager',
      'form-parser',
      'form-filler',
      'executor',
      'navigation-handler',
      'storage',
    ]);
  });
});
