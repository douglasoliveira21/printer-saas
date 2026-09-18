"use client";

import { UsageBarChart } from "@/components/shared/usage-bar-chart";
import { usePrinterPageUsage } from "@/hooks/use-printers";

export function HistoryTab({ printerId }: { printerId: string }) {
  const { data: monthly, isLoading: loadingMonthly } = usePrinterPageUsage(printerId, "month");
  const { data: daily, isLoading: loadingDaily } = usePrinterPageUsage(printerId, "day");

  return (
    <div className="grid grid-cols-1 gap-4">
      <UsageBarChart title="Total de páginas por mês (últimos 6 meses)" data={monthly} isLoading={loadingMonthly} />
      <UsageBarChart title="Total de páginas por dia (últimos 30 dias)" data={daily} isLoading={loadingDaily} />
    </div>
  );
}
