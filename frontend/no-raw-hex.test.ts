// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ESLint bans hex literals in TS/TSX; this also covers CSS, HTML and config files, so colors can
 * only come from design/tokens.json.
 */
const ROOT = import.meta.dirname;
const HEX = /#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})\b/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

it('has no raw hex colors outside design/tokens.json', () => {
  const candidates = [
    ...files(join(ROOT, 'src')).filter((f) => /\.(css|tsx?|html)$/.test(f) && !f.endsWith('.test.ts')),
    join(ROOT, 'index.html'),
    join(ROOT, 'tailwind.config.ts'),
    join(ROOT, 'design-tokens.ts'),
    join(ROOT, 'vite.config.ts'),
  ];
  const offenders = candidates.flatMap((file) =>
    readFileSync(file, 'utf8')
      .split('\n')
      .map((line, i) => ({ line, i }))
      // allow in-page anchors like href="#content"
      .filter(({ line }) => HEX.test(line.replace(/href="#[a-z-]+"/gi, '')))
      .map(({ line, i }) => `${relative(ROOT, file)}:${i + 1}: ${line.trim()}`),
  );
  expect(offenders).toEqual([]);
});
