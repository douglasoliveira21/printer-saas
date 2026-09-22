"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useCustomers } from "@/hooks/use-customers";
import type { AgentStatus, Customer, CustomerStatus } from "@/lib/types";
import { CreateCustomerDialog } from "./create-customer-dialog";
import { CustomerQuickActionsDialog } from "./customer-quick-actions-dialog";

const STATUS_CONFIG: Record<CustomerStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  INACTIVE: { label: "Inativo", variant: "secondary" },
  BLOCKED: { label: "Bloqueado", variant: "destructive" },
};

const AGENT_STATUS_LABEL: Record<AgentStatus, string> = {
  PENDING: "Pendente",
  ONLINE: "Agent online",
  OFFLINE: "Agent offline",
  DISABLED: "Agent desativado",
};

function AgentCell({ agent }: { agent: Customer["agent"] }) {
  if (!agent) {
    return <span className="text-muted-foreground">—</span>;
  }
  if (agent.status === "PENDING" && agent.enrollmentToken) {
    return (
      <div className="flex items-center gap-1.5 font-mono text-xs">
        <span className="max-w-24 truncate" title={agent.enrollmentToken}>
          {agent.enrollmentToken}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => {
            navigator.clipboard.writeText(agent.enrollmentToken!);
            toast.success("Token copiado");
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    );
  }
  return <span className="text-xs text-muted-foreground">{AGENT_STATUS_LABEL[agent.status]}</span>;
}

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCustomers(search);
  const [quickActionsCustomer, setQuickActionsCustomer] = useState<Customer | null>(null);
  const router = useRouter();

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "name",
      header: "Nome",
      cell: (c) => <span className="font-medium">{c.tradeName || c.legalName}</span>,
    },
    { key: "city", header: "Cidade", cell: (c) => c.city || "—", hideOnMobile: true },
    {
      key: "printers",
      header: "Impressoras monitoradas",
      cell: (c) => c.monitoredPrinterCount ?? 0,
    },
    { key: "token", header: "Token do Agent", cell: (c) => <AgentCell agent={c.agent} /> },
    {
      key: "status",
      header: "Status",
      cell: (c) => <Badge variant={STATUS_CONFIG[c.status].variant}>{STATUS_CONFIG[c.status].label}</Badge>,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" actions={<CreateCustomerDialog />} />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CNPJ..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <p className="text-xs text-muted-foreground">Clique uma vez para ações rápidas, clique duas vezes para abrir os detalhes.</p>

      <ResponsiveDataTable
        columns={columns}
        data={data?.data}
        keyField={(c) => c.id}
        isLoading={isLoading}
        emptyIcon={Users}
        emptyTitle="Nenhum cliente cadastrado ainda"
        cardTitle={(c) => c.tradeName || c.legalName}
        cardMeta={(c) => <Badge variant={STATUS_CONFIG[c.status].variant}>{STATUS_CONFIG[c.status].label}</Badge>}
        onRowClick={(c) => setQuickActionsCustomer(c)}
        onRowDoubleClick={(c) => router.push(`/clientes/${c.id}`)}
      />

      <CustomerQuickActionsDialog
        customer={quickActionsCustomer}
        open={!!quickActionsCustomer}
        onOpenChange={(open) => !open && setQuickActionsCustomer(null)}
      />
    </div>
  );
}
