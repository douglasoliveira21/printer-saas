"use client";

import { Cpu } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useAgents } from "@/hooks/use-agents";
import { CreateAgentDialog } from "./create-agent-dialog";
import { AgentActionsMenu } from "./agent-actions-menu";
import type { Agent } from "@/lib/types";

const STATUS_CONFIG: Record<Agent["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ONLINE: { label: "Online", variant: "default" },
  OFFLINE: { label: "Offline", variant: "destructive" },
  PENDING: { label: "Aguardando instalação", variant: "outline" },
  DISABLED: { label: "Desativado", variant: "secondary" },
};

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgents();

  const columns: DataTableColumn<Agent>[] = [
    { key: "name", header: "Nome", cell: (a) => a.name, hideOnMobile: true },
    { key: "hostname", header: "Hostname", cell: (a) => a.hostname || "Não disponível" },
    { key: "ip", header: "IP", cell: (a) => a.localIp || "Não disponível" },
    { key: "version", header: "Versão", cell: (a) => a.agentVersion || "—" },
    {
      key: "heartbeat",
      header: "Último heartbeat",
      cell: (a) => (a.lastHeartbeatAt ? new Date(a.lastHeartbeatAt).toLocaleString("pt-BR") : "Nunca"),
    },
    {
      key: "status",
      header: "Status",
      cell: (a) => <Badge variant={STATUS_CONFIG[a.status].variant}>{STATUS_CONFIG[a.status].label}</Badge>,
      hideOnMobile: true,
    },
    { key: "actions", header: "", cell: (a) => <AgentActionsMenu agent={a} />, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Agents" actions={<CreateAgentDialog />} />

      <ResponsiveDataTable
        columns={columns}
        data={agents}
        keyField={(a) => a.id}
        isLoading={isLoading}
        emptyIcon={Cpu}
        emptyTitle="Nenhum Agent instalado ainda"
        cardTitle={(a) => a.name}
        cardMeta={(a) => <Badge variant={STATUS_CONFIG[a.status].variant}>{STATUS_CONFIG[a.status].label}</Badge>}
        cardActions={(a) => <AgentActionsMenu agent={a} />}
      />
    </div>
  );
}
