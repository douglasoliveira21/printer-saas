"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAgents } from "@/hooks/use-agents";
import { CreateAgentDialog } from "./create-agent-dialog";
import type { Agent } from "@/lib/types";

const STATUS_CONFIG: Record<Agent["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ONLINE: { label: "Online", variant: "default" },
  OFFLINE: { label: "Offline", variant: "destructive" },
  PENDING: { label: "Aguardando instalação", variant: "outline" },
  DISABLED: { label: "Desativado", variant: "secondary" },
};

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgents();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Agents</h1>
        <CreateAgentDialog />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Versão</TableHead>
              <TableHead>Último heartbeat</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-400">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !agents?.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-400">
                  Nenhum Agent instalado ainda.
                </TableCell>
              </TableRow>
            )}
            {agents?.map((agent) => (
              <TableRow key={agent.id}>
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell>{agent.hostname || "Não disponível"}</TableCell>
                <TableCell>{agent.localIp || "Não disponível"}</TableCell>
                <TableCell>{agent.agentVersion || "—"}</TableCell>
                <TableCell>{agent.lastHeartbeatAt ? new Date(agent.lastHeartbeatAt).toLocaleString("pt-BR") : "Nunca"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_CONFIG[agent.status].variant}>{STATUS_CONFIG[agent.status].label}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
