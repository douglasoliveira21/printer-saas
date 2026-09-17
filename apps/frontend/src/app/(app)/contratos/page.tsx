"use client";

import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useContracts } from "@/hooks/use-contracts";
import type { Contract, ContractStatus } from "@/lib/types";
import { CreateContractDialog } from "./create-contract-dialog";
import { FranchiseUsage } from "./franchise-usage";
import { ContractActionsMenu } from "./contract-actions-menu";

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "outline" },
  ACTIVE: { label: "Ativo", variant: "default" },
  SUSPENDED: { label: "Suspenso", variant: "secondary" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  EXPIRED: { label: "Vencido", variant: "destructive" },
};

export default function ContratosPage() {
  const { data, isLoading } = useContracts();

  const columns: DataTableColumn<Contract>[] = [
    { key: "number", header: "Número", cell: (c) => `#${c.number}`, hideOnMobile: true },
    { key: "customer", header: "Cliente", cell: (c) => c.customer?.tradeName || c.customer?.legalName || "—" },
    {
      key: "monthlyFee",
      header: "Mensalidade",
      cell: (c) => Number(c.monthlyFee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
    { key: "franchise", header: "Uso da franquia", cell: (c) => <FranchiseUsage contract={c} /> },
    {
      key: "status",
      header: "Status",
      cell: (c) => <Badge variant={STATUS_CONFIG[c.status].variant}>{STATUS_CONFIG[c.status].label}</Badge>,
      hideOnMobile: true,
    },
    { key: "actions", header: "", cell: (c) => <ContractActionsMenu contract={c} />, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Contratos" actions={<CreateContractDialog />} />

      <ResponsiveDataTable
        columns={columns}
        data={data?.data}
        keyField={(c) => c.id}
        isLoading={isLoading}
        emptyIcon={FileText}
        emptyTitle="Nenhum contrato cadastrado ainda"
        cardTitle={(c) => `#${c.number} — ${c.customer?.tradeName || c.customer?.legalName || "—"}`}
        cardMeta={(c) => <Badge variant={STATUS_CONFIG[c.status].variant}>{STATUS_CONFIG[c.status].label}</Badge>}
        cardActions={(c) => <ContractActionsMenu contract={c} />}
      />
    </div>
  );
}
