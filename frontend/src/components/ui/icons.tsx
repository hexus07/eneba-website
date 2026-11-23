import type { SVGProps } from 'react';

/** Simple stroke icons (own artwork, currentColor). Decorative by default; pass aria-label to expose. */
type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  const labelled = props['aria-label'] !== undefined;
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={labelled ? undefined : true}
      role={labelled ? 'img' : undefined}
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const SearchIcon = (p: IconProps) => <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Svg>;
export const CartIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 4h2l2.4 11h10.2L20 8H6.2" /><circle cx="9" cy="19.5" r="1.5" /><circle cx="17" cy="19.5" r="1.5" /></Svg>
);
export const UserIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></Svg>;
export const GlobeIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></Svg>
);
export const PlusIcon = (p: IconProps) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>;
export const MinusIcon = (p: IconProps) => <Svg {...p}><path d="M5 12h14" /></Svg>;
export const CheckIcon = (p: IconProps) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>;
export const InfoIcon = (p: IconProps) => <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></Svg>;
export const MenuIcon = (p: IconProps) => <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>;
export const ChevronRightIcon = (p: IconProps) => <Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>;
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></Svg>
);
export const CloseIcon = (p: IconProps) => <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>;
/** Circular "money back" arrow used in cashback badges. */
export const CashbackIcon = (p: IconProps) => (
  <Svg {...p}><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 4v4h-4" /><path d="M12 8v8M8 12h8" /></Svg>
);
