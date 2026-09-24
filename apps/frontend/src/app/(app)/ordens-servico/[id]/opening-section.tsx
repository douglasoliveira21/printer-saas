"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { useServiceOrderTypes } from "@/hooks/use-service-order-types";
import { useTenantUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder, ServiceOrderPriority, ServiceOrderStatus } from "@/lib/types";
import { PRIORITY_LABEL, SERVICE_TYPE_LABEL, STATUS_LABEL } from "./labels";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function OpeningSection({ order }: { order: ServiceOrder }) {
  const [title, setTitle] = useState(order.title ?? "");
  const [typeCatalogId, setTypeCatalogId] = useState(order.serviceOrderTypeCatalogId ?? "");
  const [technicianId, setTechnicianId] = useState(order.technician?.id ?? "");
  const [status, setStatus] = useState<ServiceOrderStatus>(order.status);
  const [priority, setPriority] = useState<ServiceOrderPriority>(order.priority);
  const [description, setDescription] = useState(order.description ?? "");
  const updateOrder = useUpdateServiceOrder();
  const { data: catalogTypes } = useServiceOrderTypes();
  const { data: users } = useTenantUsers();

  const dirty =
    title !== (order.title ?? "") ||
    typeCatalogId !== (order.serviceOrderTypeCatalogId ?? "") ||
    technicianId !== (order.technician?.id ?? "") ||
    status !== order.status ||
    priority !== order.priority ||
    description !== (order.description ?? "");

  async function handleSave() {
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        title: title || undefined,
        serviceOrderTypeCatalogId: typeCatalogId || undefined,
        technicianId: technicianId || undefined,
        status,
        priority,
        description: description || undefined,
      });
      toast.success("Salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">1. Abertura da OS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Nº da OS" value={`#${order.number}`} />
          <Field label="Data/hora de abertura" value={new Date(order.createdAt).toLocaleString("pt-BR")} />
          <Field label="Cliente" value={order.customer?.tradeName || order.customer?.legalName || "—"} />
          <Field label="Unidade/filial" value={order.location?.name || "—"} />
          <Field label="Equipamento" value={order.printer ? `${order.printer.manufacturer ?? ""} ${order.printer.model ?? ""}`.trim() || "—" : "—"} />
          <Field label="Usuário que abriu" value={order.createdBy?.name || "—"} />
          {!order.serviceOrderTypeCatalog && order.serviceType && <Field label="Tipo (legado)" value={SERVICE_TYPE_LABEL[order.serviceType]} />}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">Título do chamado</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de chamado (Configurações &gt; Chamados)</Label>
            <Select value={typeCatalogId} onValueChange={(v) => setTypeCatalogId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione (opcional)">
                  {(v: string) => (v ? catalogTypes?.find((t) => t.id === v)?.name || v : "Selecione (opcional)")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {catalogTypes?.filter((t) => t.active).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Técnico responsável</Label>
            <Select value={technicianId} onValueChange={(v) => setTechnicianId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Não atribuído">
                  {(v: string) => (v ? users?.find((u) => u.id === v)?.name || v : "Não atribuído")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {users?.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Situação do chamado</Label>
            <Select value={status} onValueChange={(v) => setStatus((v ?? "OPEN") as ServiceOrderStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: ServiceOrderStatus) => STATUS_LABEL[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABEL) as ServiceOrderStatus[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {STATUS_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority((v ?? "MEDIUM") as ServiceOrderPriority)}>
              <SelectTrigger className="w-full">
                <SelectValue>{(v: ServiceOrderPriority) => PRIORITY_LABEL[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PRIORITY_LABEL) as ServiceOrderPriority[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PRIORITY_LABEL[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Descrição do atendimento</Label>
          <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        {order.alerts && order.alerts.length > 0 && (
          <div className="space-y-2">
            <Label>Alertas relacionados</Label>
            <div className="space-y-1">
              {order.alerts.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md border border-border p-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  <Badge variant={a.level === "CRITICAL" ? "destructive" : "secondary"}>{a.level}</Badge>
                  <span>{a.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={!dirty || updateOrder.isPending}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
