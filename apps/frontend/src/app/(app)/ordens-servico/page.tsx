"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useServiceOrders, useUpdateServiceOrderStatus } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder, ServiceOrderPriority, ServiceOrderStatus } from "@/lib/types";
import { CreateServiceOrderDialog } from "./create-service-order-dialog";

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

export default function OrdensServicoPage() {
  const { data, isLoading } = useServiceOrders();
  const updateStatus = useUpdateServiceOrderStatus();

  async function handleStatusChange(id: string, status: ServiceOrderStatus) {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success("Status atualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar status"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Ordens de Serviço</h1>
        <CreateServiceOrderDialog />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Impressora</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberta em</TableHead>
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
            {!isLoading && !data?.data.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-400">
                  Nenhuma ordem de serviço registrada ainda.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium">#{order.number}</TableCell>
                <TableCell>{order.customer?.tradeName || order.customer?.legalName || "—"}</TableCell>
                <TableCell>{order.printer ? `${order.printer.model || ""} (${order.printer.ip || "—"})` : "—"}</TableCell>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
