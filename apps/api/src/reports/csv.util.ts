/** Minimal RFC 4180-ish CSV serializer — no external dependency for a handful of report exports. */
export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    const str = String(value);
    return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = columns.map((c) => escape(c.header)).join(';');
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(';'));
  return [header, ...lines].join('\n');
}
