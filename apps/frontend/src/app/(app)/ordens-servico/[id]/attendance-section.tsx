"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder } from "@/lib/types";

function toLocalInputValue(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const offset = d.getTimezoneOffset();
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 16);
}

export function AttendanceSection({ order }: { order: ServiceOrder }) {
  const [arrivedAt, setArrivedAt] = useState(toLocalInputValue(order.arrivedAt));
  const [departedAt, setDepartedAt] = useState(toLocalInputValue(order.departedAt));
  const [mileageKm, setMileageKm] = useState(order.mileageKm?.toString() ?? "");
  const [activityPerformed, setActivityPerformed] = useState(order.activityPerformed ?? "");
  const [attendanceNotes, setAttendanceNotes] = useState(order.attendanceNotes ?? "");
  const updateOrder = useUpdateServiceOrder();

  const dirty =
    arrivedAt !== toLocalInputValue(order.arrivedAt) ||
    departedAt !== toLocalInputValue(order.departedAt) ||
    mileageKm !== (order.mileageKm?.toString() ?? "") ||
    activityPerformed !== (order.activityPerformed ?? "") ||
    attendanceNotes !== (order.attendanceNotes ?? "");

  const durationMinutes =
    arrivedAt && departedAt ? Math.round((new Date(departedAt).getTime() - new Date(arrivedAt).getTime()) / 60000) : null;

  async function handleSave() {
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        arrivedAt: arrivedAt ? new Date(arrivedAt).toISOString() : undefined,
        departedAt: departedAt ? new Date(departedAt).toISOString() : undefined,
        mileageKm: mileageKm ? Number(mileageKm) : undefined,
        activityPerformed,
        attendanceNotes,
      });
      toast.success("Salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">5. Atendimento do técnico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="arrivedAt">Data/hora de chegada</Label>
            <Input id="arrivedAt" type="datetime-local" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="departedAt">Data/hora de saída</Label>
            <Input id="departedAt" type="datetime-local" value={departedAt} onChange={(e) => setDepartedAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mileageKm">Quilometragem (km)</Label>
            <Input id="mileageKm" type="number" min="0" value={mileageKm} onChange={(e) => setMileageKm(e.target.value)} />
          </div>
        </div>
        {durationMinutes !== null && durationMinutes >= 0 && (
          <p className="text-xs text-muted-foreground">Tempo de atendimento: {Math.floor(durationMinutes / 60)}h{durationMinutes % 60}min</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="activityPerformed">Atividade realizada</Label>
          <Textarea
            id="activityPerformed"
            rows={2}
            placeholder="Ex: realizada limpeza interna, substituição do fusor e teste de impressão."
            value={activityPerformed}
            onChange={(e) => setActivityPerformed(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="attendanceNotes">Observações</Label>
          <Textarea id="attendanceNotes" rows={2} value={attendanceNotes} onChange={(e) => setAttendanceNotes(e.target.value)} />
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
