import type { CounterReading } from "@/lib/types";

function formatPages(value: number | null | undefined) {
  return value === null || value === undefined ? "Não disponível" : value.toLocaleString("pt-BR");
}

export function CountersList({ counter }: { counter: CounterReading | undefined }) {
  const rows: { label: string; value: number | null | undefined }[] = [
    { label: "Geral", value: counter?.total },
    { label: "Geral P&B", value: counter?.blackWhite },
    { label: "Geral colorida total", value: counter?.color },
    { label: "Geral cor única", value: undefined },
    { label: "Impressão P&B", value: undefined },
    { label: "Impressão colorida total", value: undefined },
    { label: "Cópia P&B", value: undefined },
    { label: "Cópia colorida total", value: undefined },
    { label: "Cópia colorida única", value: undefined },
    { label: "A3 colorida total", value: undefined },
    { label: "A3 P&B", value: undefined },
    { label: "Cópia A3 colorida total", value: undefined },
    { label: "Cópia A3 P&B", value: undefined },
    { label: "Duplex", value: undefined },
    { label: "Impressão A3 colorida total", value: undefined },
  ];

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          <span className={row.value === undefined ? "text-xs text-muted-foreground" : "font-medium"}>{formatPages(row.value)}</span>
        </div>
      ))}
    </div>
  );
}
