const STEAM_PORTRAIT = /\/steam\/apps\/\d+\/library_600x900\.jpg$/;

/**
 * Images to try for a product cover, in order. Seeded covers are Steam's portrait capsule
 * (library_600x900.jpg), which not every app has: then fall back to its landscape header.jpg.
 * After the last candidate fails, the card shows a text placeholder.
 */
export function coverCandidates(url: string | null | undefined): string[] {
  if (!url) return [];
  return STEAM_PORTRAIT.test(url) ? [url, url.replace(/library_600x900\.jpg$/, 'header.jpg')] : [url];
}
