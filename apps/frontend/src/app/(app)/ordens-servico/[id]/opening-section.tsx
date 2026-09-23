"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { useServiceOrderTypes } from "@/hooks/use-service-order-types";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder, ServiceOrderPriority, ServiceOrderType } from "@/lib/types";
import { PRIORITY_LABEL, SERVICE_TYPE_LABEL } from "./labels";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function OpeningSection({ order }: { order: ServiceOrder }) {
  const [serviceType, setServiceType] = useState<ServiceOrderType | "">(order.serviceType ?? "");
  const [typeCatalogId, setTypeCatalogId] = useState(order.serviceOrderTypeCatalogId ?? "");
  const [priority, setPriority] = useState<ServiceOrderPriority>(order.priority);
  const updateOrder = useUpdateServiceOrder();
  const { data: catalogTypes } = useServiceOrderTypes();

  const dirty =
    serviceType !== (order.serviceType ?? "") ||
    typeCatalogId !== (order.serviceOrderTypeCatalogId ?? "") ||
    priority !== order.priority;

  async function handleSave() {
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        serviceType: serviceType || undefined,
        serviceOrderTypeCatalogId: typeCatalogId || undefined,
        priority,
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
          <Field label="Técnico responsável" value={order.technician?.name || "Não atribuído"} />
          <Field label="Usuário que abriu" value={order.createdBy?.name || "—"} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Tipo de chamado (Configurações &gt; Chamados)</Label>
            <Select value={typeCatalogId} onValueChange={(v) => setTypeCatalogId(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione (opcional)" />
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
            <Label>Tipo de atendimento</Label>
            <Select value={serviceType} onValueChange={(v) => setServiceType((v ?? "") as ServiceOrderType)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione">{(v: ServiceOrderType) => SERVICE_TYPE_LABEL[v]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SERVICE_TYPE_LABEL) as ServiceOrderType[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SERVICE_TYPE_LABEL[key]}
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

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={!dirty || updateOrder.isPending}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
