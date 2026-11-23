// @vitest-environment node
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { Scanner } from '@tailwindcss/oxide';

/**
 * Unknown classes in `className` silently generate no CSS (only @apply fails the build). Since the
 * theme REPLACES Tailwind's palette and spacing, a typo or an off-token class (`bg-canvas`,
 * `p-7`, `bg-red-500`) would just render unstyled. This compiles every candidate Tailwind finds in
 * src/ with the real config and fails on utility-looking ones that produce nothing.
 */
const BASE = import.meta.dirname;
const UTILITY =
  /^(?:[a-z0-9-]+:)*-?(?:bg|text|border|outline|ring|fill|stroke|p[xytrbl]?|m[xytrbl]?|gap(?:-[xy])?|space-[xy]|w|h|size|min-w|max-w|min-h|max-h|top|left|right|bottom|inset(?:-[xy])?|rounded(?:-[a-z]+)?|shadow|font|leading|tracking|backdrop-blur|aspect|z|translate-[xy]|line-clamp|duration|opacity)-/;
// Prose that happens to look like a utility: "text-height skeletons" (comment), "top-ups" (placeholder),
// "font-display: swap" (CSS property named in a comment in main.tsx).
const PROSE = new Set(['text-height', 'top-ups', 'font-display']);

async function invalidUtilities(candidates: string[]): Promise<string[]> {
  const ds = await __unstable__loadDesignSystem('@import "tailwindcss";\n@config "./tailwind.config.ts";', { base: BASE });
  const css = ds.candidatesToCss(candidates);
  return candidates.filter((c, i) => css[i] === null && UTILITY.test(c) && !PROSE.has(c));
}

describe('Tailwind classes used in src/', () => {
  it('all generate CSS with the token theme', async () => {
    // Test files ship no CSS (and use ids like "top-deals" that look like utilities): skip them.
    const scanner = new Scanner({ sources: [
      { base: `${BASE}/src`, pattern: '**/*.{ts,tsx}', negated: false },
      { base: `${BASE}/src`, pattern: '**/*.test.{ts,tsx}', negated: true },
    ] });
    expect(await invalidUtilities(scanner.scan())).toEqual([]);
  });

  it('the check itself catches off-token and typo classes', async () => {
    expect(await invalidUtilities(['bg-canvas', 'p-7', 'bg-red-500', 'text-fg-nope', 'hover:bg-accent/90', 'bg-canvas-base', 'p-15']))
      .toEqual(['bg-canvas', 'p-7', 'bg-red-500', 'text-fg-nope']);
  });
});
