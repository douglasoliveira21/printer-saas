/**
 * Mirrors the --chart-1..5 tokens in globals.css as literal color values.
 * Recharts sets `fill` as a plain SVG attribute (not a CSS property), and
 * presentation attributes don't resolve var() references, so the palette
 * needs to be duplicated here as resolved oklch() literals instead of
 * reading the CSS custom properties directly.
 */
export const CHART_COLORS = [
  "oklch(0.488 0.243 264.376)", // brand blue
  "oklch(0.6 0.15 190)", // teal
  "oklch(0.7 0.18 40)", // orange
  "oklch(0.6 0.2 300)", // purple
  "oklch(0.65 0.2 20)", // red
] as const;
