import type { Config } from 'tailwindcss';
import * as tokens from './design-tokens.ts';

/**
 * Theme = design/tokens.json (via design-tokens.ts). `colors`, `spacing`, `borderRadius`, `fontSize`,
 * `fontWeight`, `boxShadow` REPLACE Tailwind's defaults: only token values exist as utilities
 * (`bg-red-500`, `p-7` don't), so off-system styling fails visibly instead of slipping in.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: { transparent: 'transparent', current: 'currentColor', inherit: 'inherit', ...tokens.colors() },
    spacing: tokens.spacing(),
    borderRadius: tokens.borderRadius(),
    fontFamily: tokens.fontFamily(),
    fontWeight: tokens.fontWeight(),
    fontSize: tokens.fontSize(),
    boxShadow: { none: 'none', ...tokens.boxShadow() },
    backdropBlur: tokens.backdropBlur(),
    extend: {
      // Layout measurements taken from design/screens (1440px viewport), NOT tokens.json:
      // they're component dimensions, not part of the spacing rhythm.
      spacing: {
        header: '96px',        // header top row
        nav: '50px',           // main nav bar
        'control-sm': '34px',  // Secondary / Outline buttons, offer-row "Buy now"
        control: '40px',       // inputs, Primary buttons (checkout)
        'control-lg': '56px',  // header search, login inputs
        'platform-bar': '22px',
        icon: '20px',
        'icon-sm': '16px',
        'icon-lg': '24px',
        card: '224px',         // product card width in a 5-up row (5×224 + 4×20 = 1200)
        'card-sm': '200px',    // carousel cards ("Top games")
      },
      maxWidth: { content: '1200px', wide: '1360px' },
      aspectRatio: { cover: '4 / 5' },
    },
  },
} satisfies Config;
