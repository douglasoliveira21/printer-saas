"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServiceOrders, useUpdateServiceOrderStatus } from "@/hooks/use-service-orders";
import { useTenantUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder, ServiceOrderPriority, ServiceOrderStatus } from "@/lib/types";
import { CreateServiceOrderDialog } from "./create-service-order-dialog";
import { EditServiceOrderDialog } from "./edit-service-order-dialog";

const STATUS_OPTIONS: { value: ServiceOrderStatus; label: string }[] = [
  { value: "OPEN", label: "Aberta" },
  { value: "SCHEDULED", label: "Agendada" },
  { value: "IN_PROGRESS", label: "Em atendimento" },
  { value: "WAITING_PART", label: "Aguardando peça" },
  { value: "WAITING_CUSTOMER", label: "Aguardando cliente" },
  { value: "DONE", label: "Concluída" },
  { value: "CANCELLED", label: "Cancelada" },
];

const PRIORITY_CONFIG: Record<ServiceOrderPriority, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  LOW: { label: "Baixa", variant: "outline" },
  MEDIUM: { label: "Média", variant: "secondary" },
  HIGH: { label: "Alta", variant: "default" },
  URGENT: { label: "Urgente", variant: "destructive" },
};

function isLate(order: ServiceOrder) {
  return order.slaDueAt && !["DONE", "CANCELLED"].includes(order.status) && new Date(order.slaDueAt) < new Date();
}

function isDueSoon(order: ServiceOrder) {
  if (!order.slaDueAt || ["DONE", "CANCELLED"].includes(order.status)) return false;
  const dueAt = new Date(order.slaDueAt).getTime();
  const diff = dueAt - Date.now();
  return diff > 0 && diff <= 2 * 60 * 60 * 1000;
}

const OPEN_STATUSES: ServiceOrderStatus[] = ["OPEN", "SCHEDULED", "IN_PROGRESS", "WAITING_PART", "WAITING_CUSTOMER"];

export default function OrdensServicoPage() {
  const [view, setView] = useState<"table" | "queue">("table");
  const { data, isLoading } = useServiceOrders();
  const { data: users } = useTenantUsers();
  const updateStatus = useUpdateServiceOrderStatus();

  async function handleStatusChange(id: string, status: ServiceOrderStatus) {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success("Status atualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar status"));
    }
  }

  const queueColumns = useMemo(() => {
    const openOrders = (data?.data ?? []).filter((o) => OPEN_STATUSES.includes(o.status));
    const byTechnician = new Map<string, { name: string; orders: ServiceOrder[] }>();
    byTechnician.set("unassigned", { name: "Não atribuído", orders: [] });
    for (const user of users ?? []) {
      byTechnician.set(user.id, { name: user.name, orders: [] });
    }
    for (const order of openOrders) {
      const key = order.technician?.id ?? "unassigned";
      const bucket = byTechnician.get(key) ?? { name: order.technician?.name ?? "Não atribuído", orders: [] };
      bucket.orders.push(order);
      byTechnician.set(key, bucket);
    }
    return Array.from(byTechnician.values()).filter((b) => b.orders.length > 0 || b.name !== "Não atribuído");
  }, [data, users]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
        <div className="flex items-center gap-2">
          <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}>
            Lista
          </Button>
          <Button variant={view === "queue" ? "default" : "outline"} size="sm" onClick={() => setView("queue")}>
            Fila por técnico
          </Button>
          <CreateServiceOrderDialog />
        </div>
      </div>

      {view === "queue" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queueColumns.map((column) => (
            <Card key={column.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-neutral-500">
                  {column.name} ({column.orders.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {column.orders.length === 0 && <p className="text-sm text-neutral-400">Nenhuma OS aberta.</p>}
                {column.orders.map((order) => (
                  <div key={order.id} className="rounded-md border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">#{order.number}</span>
                      <Badge variant={PRIORITY_CONFIG[order.priority].variant}>{PRIORITY_CONFIG[order.priority].label}</Badge>
                    </div>
                    <p className="text-neutral-500">{order.customer?.tradeName || order.customer?.legalName || "—"}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      {isLate(order) ? (
                        <Badge variant="destructive">SLA vencido</Badge>
                      ) : isDueSoon(order) ? (
                        <Badge variant="secondary">Vence em breve</Badge>
                      ) : (
                        <span />
                      )}
                      <EditServiceOrderDialog order={order} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {view === "table" && (
      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Impressora</TableHead>
              <TableHead>Técnico</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberta em</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-neutral-400">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !data?.data.length && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-neutral-400">
                  Nenhuma ordem de serviço registrada ainda.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">#{order.number}</TableCell>
                <TableCell>{order.customer?.tradeName || order.customer?.legalName || "—"}</TableCell>
                <TableCell>{order.printer ? `${order.printer.model || ""} (${order.printer.ip || "—"})` : "—"}</TableCell>
                <TableCell>{order.technician?.name || "Não atribuído"}</TableCell>
                <TableCell>
                  <Badge variant={PRIORITY_CONFIG[order.priority].variant}>{PRIORITY_CONFIG[order.priority].label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select value={order.status} onValueChange={(v) => v && handleStatusChange(order.id, v as ServiceOrderStatus)}>
                      <SelectTrigger className="w-44">
                        <SelectValue>
                          {(value: ServiceOrderStatus) => STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isLate(order) && <Badge variant="destructive">Atrasada</Badge>}
                  </div>
                </TableCell>
                <TableCell>{new Date(order.createdAt).toLocaleDateString("pt-BR")}</TableCell>
                <TableCell className="text-right">
                  <EditServiceOrderDialog order={order} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      )}
    </div>
  );
}
