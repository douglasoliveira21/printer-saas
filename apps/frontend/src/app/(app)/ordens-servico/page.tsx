"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
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

  const columns: DataTableColumn<ServiceOrder>[] = [
    { key: "number", header: "Número", cell: (o) => `#${o.number}`, hideOnMobile: true },
    { key: "customer", header: "Cliente", cell: (o) => o.customer?.tradeName || o.customer?.legalName || "—" },
    {
      key: "printer",
      header: "Impressora",
      cell: (o) => (o.printer ? `${o.printer.model || ""} (${o.printer.ip || "—"})` : "—"),
    },
    { key: "technician", header: "Técnico", cell: (o) => o.technician?.name || "Não atribuído" },
    {
      key: "priority",
      header: "Prioridade",
      cell: (o) => <Badge variant={PRIORITY_CONFIG[o.priority].variant}>{PRIORITY_CONFIG[o.priority].label}</Badge>,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: "Status",
      cell: (o) => (
        <div className="flex items-center gap-2">
          <Select value={o.status} onValueChange={(v) => v && handleStatusChange(o.id, v as ServiceOrderStatus)}>
            <SelectTrigger className="w-44">
              <SelectValue>{(value: ServiceOrderStatus) => STATUS_OPTIONS.find((opt) => opt.value === value)?.label ?? value}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isLate(o) && <Badge variant="destructive">Atrasada</Badge>}
        </div>
      ),
    },
    { key: "createdAt", header: "Aberta em", cell: (o) => new Date(o.createdAt).toLocaleDateString("pt-BR"), hideOnMobile: true },
    { key: "actions", header: "", cell: (o) => <EditServiceOrderDialog order={o} />, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ordens de Serviço"
        actions={
          <>
            <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")}>
              Lista
            </Button>
            <Button variant={view === "queue" ? "default" : "outline"} size="sm" onClick={() => setView("queue")}>
              Fila por técnico
            </Button>
            <CreateServiceOrderDialog />
          </>
        }
      />

      {view === "queue" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {queueColumns.map((column) => (
            <Card key={column.name}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {column.name} ({column.orders.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {column.orders.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma OS aberta.</p>}
                {column.orders.map((order) => (
                  <div key={order.id} className="rounded-md border border-border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">#{order.number}</span>
                      <Badge variant={PRIORITY_CONFIG[order.priority].variant}>{PRIORITY_CONFIG[order.priority].label}</Badge>
                    </div>
                    <p className="text-muted-foreground">{order.customer?.tradeName || order.customer?.legalName || "—"}</p>
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
        <ResponsiveDataTable
          columns={columns}
          data={data?.data}
          keyField={(o) => o.id}
          isLoading={isLoading}
          emptyIcon={Wrench}
          emptyTitle="Nenhuma ordem de serviço registrada ainda"
          cardTitle={(o) => `#${o.number} — ${o.customer?.tradeName || o.customer?.legalName || "—"}`}
          cardMeta={(o) => <Badge variant={PRIORITY_CONFIG[o.priority].variant}>{PRIORITY_CONFIG[o.priority].label}</Badge>}
          cardActions={(o) => <EditServiceOrderDialog order={o} />}
        />
      )}
    </div>
  );
}
