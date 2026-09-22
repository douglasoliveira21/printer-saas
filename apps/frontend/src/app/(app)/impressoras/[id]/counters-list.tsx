import type { CounterReading, PrinterCapabilities } from "@/lib/types";

function formatPages(value: number | null | undefined) {
  return value === null || value === undefined ? "Não disponível" : value.toLocaleString("pt-BR");
}

type CapabilityKey = keyof PrinterCapabilities;

export function CountersList({ counter, capabilities }: { counter: CounterReading | undefined; capabilities: PrinterCapabilities | null }) {
  const rows: { label: string; value: number | null | undefined; requires?: CapabilityKey[] }[] = [
    { label: "Geral", value: counter?.total },
    { label: "Geral P&B", value: counter?.blackWhite },
    { label: "Geral colorida total", value: counter?.color, requires: ["color"] },
    { label: "Geral cor única", value: undefined, requires: ["color"] },
    { label: "Impressão P&B", value: undefined },
    { label: "Impressão colorida total", value: undefined, requires: ["color"] },
    { label: "Cópia P&B", value: undefined, requires: ["copy"] },
    // Cópia/A3 "colorida" precisam da impressora ser colorida E ter a
    // outra capacidade ao mesmo tempo — antes só checava uma das duas, o
    // que mostrava "colorida" pra multifuncional P&B com cópia (ou pra
    // impressora A3 sem cor nenhuma).
    { label: "Cópia colorida total", value: undefined, requires: ["copy", "color"] },
    { label: "Cópia colorida única", value: undefined, requires: ["copy", "color"] },
    { label: "A3 colorida total", value: undefined, requires: ["a3", "color"] },
    { label: "A3 P&B", value: undefined, requires: ["a3"] },
    { label: "Cópia A3 colorida total", value: undefined, requires: ["a3", "copy", "color"] },
    { label: "Cópia A3 P&B", value: undefined, requires: ["a3", "copy"] },
    { label: "Duplex", value: undefined, requires: ["duplex"] },
    { label: "Impressão A3 colorida total", value: undefined, requires: ["a3", "color"] },
  ];

  // Not every printer has every capability — showing a field the equipment
  // doesn't actually have (or that was never confirmed) implies something
  // untrue about it. A field only renders once ALL of its required
  // capabilities were positively confirmed (true); false/undefined both
  // mean "don't show it", same rule, never distinguished in the UI (spec:
  // not_supported and unknown both collapse to "not rendered").
  const visibleRows = rows.filter((row) => !row.requires || row.requires.every((key) => capabilities?.[key] === true));
  const hiddenCapabilities = (["color", "duplex", "a3", "copy"] as CapabilityKey[]).filter((key) => capabilities?.[key] !== true);

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      {visibleRows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3 border-b border-border py-1.5 text-sm">
          <span className="text-muted-foreground">{row.label}</span>
          <span className={row.value === undefined ? "text-xs text-muted-foreground" : "font-medium"}>{formatPages(row.value)}</span>
        </div>
      ))}
      {hiddenCapabilities.length > 0 && (
        <p className="col-span-full text-xs text-neutral-400">
          Campos não aplicáveis a esta impressora (não suportados ou ainda não confirmados) ficam ocultos em vez de mostrar
          &quot;Não disponível&quot;.
        </p>
      )}
    </div>
  );
}
