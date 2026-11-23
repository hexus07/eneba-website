/**
 * design/tokens.json (DTCG) → Tailwind theme values. The ONLY place token values are read;
 * tailwind.config.ts consumes this, components use the resulting classes.
 *
 * Naming: token groups are renamed so classes read well:
 *   color.bg → canvas · color.text → fg · color.border → line
 *   (surface, overlay, accent, success, danger keep their names)
 *   e.g. color.text.muted → `text-fg-muted`, color.bg.header → `bg-canvas-header`.
 */
import raw from '../design/tokens.json' with { type: 'json' };

type Json = Record<string, unknown>;

const isToken = (v: unknown): v is { $value: unknown } => typeof v === 'object' && v !== null && '$value' in v;

/** Resolve "{color.surface.card}"-style references (recursively). */
export function resolve(value: unknown, root: Json = raw, seen: string[] = []): unknown {
  if (typeof value !== 'string') return value;
  const ref = /^\{([^}]+)\}$/.exec(value);
  if (!ref) return value;
  const path = ref[1] ?? '';
  if (seen.includes(path)) throw new Error(`Circular token reference: ${[...seen, path].join(' → ')}`);
  const target = path.split('.').reduce<unknown>((node, key) => (node as Json | undefined)?.[key], root);
  if (!isToken(target)) throw new Error(`Unresolved token reference {${path}}`);
  return resolve(target.$value, root, [...seen, path]);
}

/** Leaf tokens of a group as { key: resolvedValue }, nested groups kept nested. */
function group(node: Json): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith('$')) continue;
    out[key] = isToken(child) ? resolve(child.$value) : group(child as Json);
  }
  return out;
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const COLOR_GROUPS: Record<string, string> = {
  bg: 'canvas', surface: 'surface', overlay: 'overlay', accent: 'accent',
  success: 'success', danger: 'danger', text: 'fg', border: 'line',
};

export function colors(): Record<string, unknown> {
  const all = group(raw.color);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(all)) {
    const name = COLOR_GROUPS[key];
    if (!name) throw new Error(`Unmapped color group "${key}" in tokens.json; add it to COLOR_GROUPS`);
    out[name] = typeof value === 'object' && value !== null
      ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k === 'DEFAULT' ? k : kebab(k), v]))
      : value;
  }
  return out;
}

export const spacing = (): Record<string, string> => ({ px: '1px', 0: '0px', ...(group(raw.space) as Record<string, string>) });
export const borderRadius = () => group(raw.radius) as Record<string, string>;
// Metropolis is self-hosted (src/main.tsx imports @fontsource/metropolis, weights 400–800).
export const fontFamily = () => ({ sans: resolve(raw.font.family.base.$value) as string[] });
export const fontWeight = () =>
  Object.fromEntries(Object.entries(group(raw.font.weight as Json)).map(([k, v]) => [k, String(v)]));

interface Typography { fontSize: string; lineHeight: string; fontWeight: number }
/** `text-h2`, `text-price-lg`, `text-title-card`… each sets size, line height and weight together. */
export function fontSize(): Record<string, [string, { lineHeight: string; fontWeight: string }]> {
  const out: Record<string, [string, { lineHeight: string; fontWeight: string }]> = {};
  for (const [key, token] of Object.entries(raw.text as Json)) {
    if (key.startsWith('$') || !isToken(token)) continue;
    const t = token.$value as Typography;
    out[kebab(key)] = [t.fontSize, { lineHeight: t.lineHeight, fontWeight: String(t.fontWeight) }];
  }
  return out;
}

interface Shadow { offsetX: string; offsetY: string; blur: string; spread: string; color: string }
export const boxShadow = () =>
  Object.fromEntries(
    Object.entries(group(raw.shadow as Json)).map(([k, v]) => {
      const s = v as Shadow;
      return [k, `${s.offsetX} ${s.offsetY} ${s.blur} ${s.spread} ${s.color}`];
    }),
  );
export const backdropBlur = () => group(raw.blur) as Record<string, string>;
