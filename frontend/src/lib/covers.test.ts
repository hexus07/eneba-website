import { coverCandidates } from './covers';

describe('coverCandidates', () => {
  it('adds the landscape header as fallback for Steam portrait capsules', () => {
    expect(coverCandidates('https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg')).toEqual([
      'https://cdn.akamai.steamstatic.com/steam/apps/1091500/library_600x900.jpg',
      'https://cdn.akamai.steamstatic.com/steam/apps/1091500/header.jpg',
    ]);
  });

  it('keeps other URLs as the only candidate', () => {
    expect(coverCandidates('https://example.test/cover.png')).toEqual(['https://example.test/cover.png']);
  });

  it('has no candidates without a URL', () => {
    expect(coverCandidates(null)).toEqual([]);
    expect(coverCandidates('')).toEqual([]);
  });
});
