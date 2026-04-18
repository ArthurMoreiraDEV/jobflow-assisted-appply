import type { CandidateProfile } from '../profile';
import type { ProfileAliasKey } from './aliases';

export function getProfileValue(
  profile: CandidateProfile,
  key: ProfileAliasKey,
): string | undefined {
  switch (key) {
    case 'fullName':
      return profile.fullName || undefined;
    case 'firstName': {
      const [first] = (profile.fullName || '').trim().split(/\s+/);
      return first || undefined;
    }
    case 'lastName': {
      const parts = (profile.fullName || '').trim().split(/\s+/);
      if (parts.length <= 1) return undefined;
      return parts.slice(1).join(' ') || undefined;
    }
    case 'email':
      return profile.contact.email || undefined;
    case 'phone':
      return profile.contact.phone || undefined;
    case 'location':
      return profile.contact.location || undefined;
    case 'linkedinUrl':
      return profile.contact.linkedinUrl || undefined;
    case 'portfolioUrl':
      return profile.contact.portfolioUrl || undefined;
    case 'headline':
      return profile.headline || undefined;
    case 'summary':
      return profile.summary || undefined;
    default:
      return undefined;
  }
}
