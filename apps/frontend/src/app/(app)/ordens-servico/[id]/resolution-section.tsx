"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder, ServiceOrderStatus } from "@/lib/types";
import { STATUS_LABEL } from "./labels";

export function ResolutionSection({ order }: { order: ServiceOrder }) {
  const [status, setStatus] = useState<ServiceOrderStatus>(order.status);
  const [solution, setSolution] = useState(order.solution ?? "");
  const [equipmentWorking, setEquipmentWorking] = useState<string>(
    order.equipmentWorking === null ? "" : order.equipmentWorking ? "yes" : "no",
  );
  const updateOrder = useUpdateServiceOrder();

  const dirty =
    status !== order.status ||
    solution !== (order.solution ?? "") ||
    equipmentWorking !== (order.equipmentWorking === null ? "" : order.equipmentWorking ? "yes" : "no");

  async function handleSave() {
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        status,
        solution,
        equipmentWorking: equipmentWorking ? equipmentWorking === "yes" : undefined,
      });
      toast.success("Salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">6. Resultado da OS</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Status</Label>
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
            <Label>Equipamento funcionando?</Label>
            <Select value={equipmentWorking} onValueChange={(v) => setEquipmentWorking(v ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione">{(v: string) => (v === "yes" ? "Sim" : "Não")}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Sim</SelectItem>
                <SelectItem value="no">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="solution">Solução aplicada</Label>
          <Textarea id="solution" rows={3} value={solution} onChange={(e) => setSolution(e.target.value)} />
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
