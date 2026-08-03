import { normalizeEntries } from './normalize-entries';

describe('normalizeEntries', () => {
  it('trims whitespace, collapses repeated spaces, removes empties, and deduplicates case-insensitively', () => {
    const result = normalizeEntries([
      '  Alpha  ',
      'alpha',
      'Beta',
      '',
      null,
      '  Gamma  ',
      'beta',
      '  Delta    Echo  ',
    ]);

    expect(result).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta Echo']);
  });

  it('ignores non-string values', () => {
    const result = normalizeEntries([
      undefined,
      42 as unknown as string,
      '   ',
      'ok',
    ]);

    expect(result).toEqual(['ok']);
  });
});
