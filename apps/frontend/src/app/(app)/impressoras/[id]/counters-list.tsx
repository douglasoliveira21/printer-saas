import type { CounterReading } from "@/lib/types";

function formatPages(value: number | null | undefined) {
  return value === null || value === undefined ? "Não disponível" : value.toLocaleString("pt-BR");
}

export function CountersList({ counter, supportsA3 }: { counter: CounterReading | undefined; supportsA3: boolean | null }) {
  const rows: { label: string; value: number | null | undefined; a3?: boolean }[] = [
    { label: "Geral", value: counter?.total },
    { label: "Geral P&B", value: counter?.blackWhite },
    { label: "Geral colorida total", value: counter?.color },
    { label: "Geral cor única", value: undefined },
    { label: "Impressão P&B", value: undefined },
    { label: "Impressão colorida total", value: undefined },
    { label: "Cópia P&B", value: undefined },
    { label: "Cópia colorida total", value: undefined },
    { label: "Cópia colorida única", value: undefined },
    { label: "A3 colorida total", value: undefined, a3: true },
    { label: "A3 P&B", value: undefined, a3: true },
    { label: "Cópia A3 colorida total", value: undefined, a3: true },
    { label: "Cópia A3 P&B", value: undefined, a3: true },
    { label: "Duplex", value: undefined },
    { label: "Impressão A3 colorida total", value: undefined, a3: true },
  ];

  // Not every printer takes A3 paper — showing these fields for an A4-only
  // machine implies a capability it doesn't have. Only show them once the
  // Agent has actually read a tray large enough for A3 on this printer;
  // otherwise they'd all just read "Não disponível" forever, which is noise
  // rather than information.
  const visibleRows = rows.filter((row) => !row.a3 || supportsA3 === true);

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          <span className={row.value === undefined ? "text-xs text-muted-foreground" : "font-medium"}>{formatPages(row.value)}</span>
        </div>
      ))}
      {supportsA3 !== true && (
        <p className="col-span-full text-xs text-neutral-400">
          {supportsA3 === false
            ? "Esta impressora não suporta papel A3."
            : "Ainda não foi possível determinar se esta impressora suporta A3."}
        </p>
      )}
    </div>
  );
}
