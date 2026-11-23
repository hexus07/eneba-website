// @vitest-environment node
import raw from '../design/tokens.json' with { type: 'json' };
import config from './tailwind.config.ts';
import * as tokens from './design-tokens.ts';

const HEX = /^#(?:[0-9A-F]{6}|[0-9A-F]{8})$/i;

function leaves(node: unknown, path = ''): [string, unknown][] {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return [[path, node]];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

describe('design-tokens', () => {
  it('resolves references between tokens', () => {
    expect(tokens.resolve('{color.surface.card}')).toBe(raw.color.surface.card.$value);
    expect(tokens.resolve('{color.border.card}')).toBe(raw.color.accent.cashback.$value); // ref → ref
    expect(tokens.resolve('#FFFFFF')).toBe('#FFFFFF');
    expect(() => tokens.resolve('{color.nope}')).toThrow(/Unresolved/);
  });

  it('maps token groups to readable Tailwind names', () => {
    const c = tokens.colors() as Record<string, Record<string, string>>;
    expect(c.canvas?.base).toBe(raw.color.bg.base.$value);
    expect(c.fg?.muted).toBe(raw.color.text.muted.$value);
    expect(c.fg?.['on-accent']).toBe(raw.color.surface.card.$value);
    expect(c.line?.card).toBe(raw.color.accent.cashback.$value);
    expect(c.accent?.DEFAULT).toBe(raw.color.accent.DEFAULT.$value);
  });

  it('produces only valid hex colors (no unresolved references)', () => {
    for (const [path, value] of leaves(tokens.colors())) {
      expect(value, path).toMatch(HEX);
    }
  });

  it('builds typography with size, line height and weight', () => {
    expect(tokens.fontSize()['price-lg']).toEqual(['22px', { lineHeight: '22px', fontWeight: '800' }]);
    expect(tokens.fontSize()['h2-sm']?.[0]).toBe('18px');
  });

  it('exposes spacing, radius, shadow and blur from tokens.json', () => {
    expect(tokens.spacing()['15']).toBe('15px');
    expect(tokens.borderRadius().none).toBe('0px');
    expect(tokens.boxShadow().panel).toBe('0px 3px 9px 0px #00000040');
    expect(tokens.backdropBlur().scrim).toBe('10px');
  });
});

describe('tailwind.config', () => {
  const theme = config.theme as Record<string, Record<string, unknown>>;

  it('replaces the default palette, so only token colors exist', () => {
    expect(Object.keys(theme.colors ?? {}).sort()).toEqual(
      ['accent', 'canvas', 'current', 'danger', 'fg', 'inherit', 'line', 'overlay', 'success', 'surface', 'transparent'],
    );
  });

  it('uses the token spacing scale (not Tailwind’s 4px multiples)', () => {
    expect(theme.spacing?.['4']).toBe('4px');
    expect(theme.spacing?.['7']).toBeUndefined();
  });
});
