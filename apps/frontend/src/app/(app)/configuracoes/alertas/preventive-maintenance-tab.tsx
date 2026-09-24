"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { Wrench } from "lucide-react";
import { usePrinters } from "@/hooks/use-printers";
import {
  useCreatePreventiveMaintenanceSchedule,
  useDeletePreventiveMaintenanceSchedule,
  usePreventiveMaintenanceSchedules,
  useUpdatePreventiveMaintenanceSchedule,
} from "@/hooks/use-preventive-maintenance";
import { getApiErrorMessage } from "@/lib/api-client";

export function PreventiveMaintenanceTab() {
  const { data: schedules, isLoading } = usePreventiveMaintenanceSchedules();
  const { data: printers } = usePrinters({ status: "MONITORED" });
  const createSchedule = useCreatePreventiveMaintenanceSchedule();
  const updateSchedule = useUpdatePreventiveMaintenanceSchedule();
  const deleteSchedule = useDeletePreventiveMaintenanceSchedule();

  const [printerId, setPrinterId] = useState("");
  const [intervalDays, setIntervalDays] = useState("90");
  const [notes, setNotes] = useState("");

  async function handleCreate() {
    if (!printerId || !intervalDays) return;
    try {
      await createSchedule.mutateAsync({ printerId, intervalDays: Number(intervalDays), notes: notes || undefined });
      setPrinterId("");
      setIntervalDays("90");
      setNotes("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar agendamento"));
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    try {
      await updateSchedule.mutateAsync({ id, active });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar agendamento"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteSchedule.mutateAsync(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir agendamento"));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">Crie uma manutenção preventiva recorrente para uma impressora — um chamado é aberto automaticamente a cada intervalo.</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1 space-y-2">
              <Label>Impressora</Label>
              <Select value={printerId} onValueChange={(v) => setPrinterId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione">
                    {(v: string) => {
                      if (!v) return "Selecione";
                      const p = printers?.data.find((printer) => printer.id === v);
                      return p ? `${p.manufacturer} ${p.model} (${p.ip})` : v;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {printers?.data.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.manufacturer} {p.model} ({p.ip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32 space-y-2">
              <Label>Intervalo (dias)</Label>
              <Input type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} />
            </div>
            <div className="min-w-[200px] flex-1 space-y-2">
              <Label>Observação</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
            <Button onClick={handleCreate} disabled={!printerId || createSchedule.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isLoading && !schedules?.length && <EmptyState icon={Wrench} title="Nenhuma manutenção preventiva agendada" />}

      {schedules?.map((s) => (
        <Card key={s.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium">
                {s.printer.manufacturer} {s.printer.model} ({s.printer.serial ?? "—"})
              </p>
              <p className="text-xs text-muted-foreground">
                A cada {s.intervalDays} dias — próxima em {new Date(s.nextDueAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={s.active} onCheckedChange={(v) => handleToggleActive(s.id, v === true)} />
                Ativo
              </label>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(s.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
