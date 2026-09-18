"use client";

import { useState } from "react";
import { FileText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useContracts } from "@/hooks/use-contracts";
import type { Contract, ContractStatus } from "@/lib/types";
import { CreateContractDialog } from "./create-contract-dialog";
import { ContractActionsMenu } from "./contract-actions-menu";

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "outline" },
  ACTIVE: { label: "Ativo", variant: "default" },
  SUSPENDED: { label: "Suspenso", variant: "secondary" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  EXPIRED: { label: "Vencido", variant: "destructive" },
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos os status" },
  { value: "DRAFT", label: "Rascunho" },
  { value: "ACTIVE", label: "Ativo" },
  { value: "SUSPENDED", label: "Suspenso" },
  { value: "ENDED", label: "Encerrado" },
  { value: "EXPIRED", label: "Vencido" },
];

export default function ContratosPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const { data, isLoading } = useContracts({ search: search || undefined, status: status === "all" ? undefined : status });

  const columns: DataTableColumn<Contract>[] = [
    { key: "number", header: "Número", cell: (c) => `#${c.number}`, hideOnMobile: true },
    { key: "customer", header: "Cliente", cell: (c) => c.customer?.tradeName || c.customer?.legalName || "—" },
    { key: "billingDay", header: "Dia de início de faturamento", cell: (c) => c.billingDay },
    {
      key: "endDate",
      header: "Fim do contrato",
      cell: (c) => (c.status === "ENDED" && c.endDate ? new Date(c.endDate).toLocaleDateString("pt-BR") : "—"),
    },
    { key: "printers", header: "Impressoras", cell: (c) => c._count?.contractPrinters ?? 0 },
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por cliente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>{(value: string) => STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={data?.data}
        keyField={(c) => c.id}
        isLoading={isLoading}
        emptyIcon={FileText}
        emptyTitle="Nenhum contrato cadastrado ainda"
        rowHref={(c) => `/contratos/${c.id}`}
        cardTitle={(c) => `#${c.number} — ${c.customer?.tradeName || c.customer?.legalName || "—"}`}
        cardMeta={(c) => <Badge variant={STATUS_CONFIG[c.status].variant}>{STATUS_CONFIG[c.status].label}</Badge>}
        cardActions={(c) => <ContractActionsMenu contract={c} />}
      />
    </div>
  );
}
