"use client";

import { useContractBillingPreview } from "@/hooks/use-contracts";
import type { Contract } from "@/lib/types";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const to = now.toISOString();
  return { from, to };
}

export function FranchiseUsage({ contract }: { contract: Contract }) {
  const { from, to } = monthRange();
  const { data, isLoading } = useContractBillingPreview(contract.printer ? contract.id : undefined, from, to);

  if (!contract.printer) {
    return <span className="text-sm text-neutral-400">Sem impressora vinculada</span>;
  }

  if (isLoading) {
    return <span className="text-sm text-neutral-400">Calculando...</span>;
  }

  if (!data || !data.dataAvailable || data.pagesUsed === null) {
    return <span className="text-sm text-neutral-400">Dados insuficientes no período</span>;
  }

  const percent = contract.franchisePages > 0 ? Math.min(100, Math.round((data.pagesUsed / contract.franchisePages) * 100)) : 0;
  const overLimit = (data.overturnedPages ?? 0) > 0;

  return (
    <div className="w-40 space-y-1">
      <div className="flex justify-between text-xs">
        <span>
          {data.pagesUsed.toLocaleString("pt-BR")} / {contract.franchisePages.toLocaleString("pt-BR")}
        </span>
        <span className={overLimit ? "font-medium text-red-600" : "text-neutral-500"}>{percent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className={`h-full rounded-full ${overLimit ? "bg-red-600" : "bg-blue-600"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
