export function normaliseText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(value: string | null | undefined): string[] {
  const normalised = normaliseText(value);
  if (!normalised) return [];
  return normalised.split(/\s+/).filter(Boolean);
}

export function uniqueTokens(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    for (const token of tokenize(value)) {
      seen.add(token);
    }
  }
  return Array.from(seen);
}
