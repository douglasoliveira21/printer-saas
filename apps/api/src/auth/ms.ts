const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

/** Minimal "5m" / "30d" / "1500ms" duration parser — avoids pulling the `ms` package for one call site. */
export default function ms(input: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)$/i.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid duration: "${input}"`);
  }
  const [, value, unit] = match;
  return Math.round(parseFloat(value) * UNITS[unit.toLowerCase()]);
}
