export type ApplicationLocation = 'linkedin' | 'external' | 'unknown';

export function classifyApplicationLocation(
  url: string | undefined | null,
): ApplicationLocation {
  if (!url) return 'unknown';
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'linkedin.com' || parsed.hostname.endsWith('.linkedin.com')) {
      return 'linkedin';
    }
    return 'external';
  } catch {
    return 'unknown';
  }
}

export function isExternalApplicationUrl(url: string | undefined | null): boolean {
  return classifyApplicationLocation(url) === 'external';
}

export function isLinkedInApplicationUrl(url: string | undefined | null): boolean {
  return classifyApplicationLocation(url) === 'linkedin';
}

export function hasLeftLinkedIn(
  previousUrl: string | undefined | null,
  currentUrl: string | undefined | null,
): boolean {
  return (
    classifyApplicationLocation(previousUrl) === 'linkedin' &&
    classifyApplicationLocation(currentUrl) === 'external'
  );
}

export function hasReturnedToLinkedIn(
  previousUrl: string | undefined | null,
  currentUrl: string | undefined | null,
): boolean {
  return (
    classifyApplicationLocation(previousUrl) === 'external' &&
    classifyApplicationLocation(currentUrl) === 'linkedin'
  );
}
