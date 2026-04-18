import { createCandidateProfile, type CandidateProfile } from '../profile';
import { getStorageAdapter, type StorageAdapter } from './adapter';
import { STORAGE_KEYS } from './keys';

export interface ProfileRepository {
  load(): Promise<CandidateProfile | undefined>;
  save(profile: CandidateProfile): Promise<CandidateProfile>;
  clear(): Promise<void>;
}

export function createProfileRepository(
  adapter: StorageAdapter = getStorageAdapter(),
): ProfileRepository {
  return {
    async load() {
      const raw = await adapter.get<CandidateProfile>(STORAGE_KEYS.profile);
      return raw ? createCandidateProfile(raw) : undefined;
    },
    async save(profile) {
      const stamped: CandidateProfile = {
        ...profile,
        updatedAt: new Date().toISOString(),
      };
      await adapter.set(STORAGE_KEYS.profile, stamped);
      return stamped;
    },
    async clear() {
      await adapter.remove(STORAGE_KEYS.profile);
    },
  };
}
