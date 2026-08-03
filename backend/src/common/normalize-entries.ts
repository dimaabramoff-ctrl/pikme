export function normalizeEntries(
  values: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of values) {
    if (typeof raw !== 'string') {
      continue;
    }

    const cleaned = raw.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}
