"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DEFAULT_WORK_SCHEDULE, WorkScheduleEditor } from "@/components/shared/work-schedule-editor";
import { useCustomerWorkingHours, useSetCustomerWorkingHours, useUpdateCustomer } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Customer, SlaHourMode, WorkingHourEntry } from "@/lib/types";

const HOUR_MODE_LABEL: Record<SlaHourMode, string> = {
  CALENDAR: "Horas corridas",
  BUSINESS_HOURS_COMPANY: "Horas úteis da minha empresa",
  BUSINESS_HOURS_CUSTOMER: "Horas úteis do cliente",
};

export function SettingsTab({ customer }: { customer: Customer }) {
  const [slaEnabled, setSlaEnabled] = useState(customer.slaEnabled);
  const [slaHourMode, setSlaHourMode] = useState<SlaHourMode>(customer.slaHourMode);
  const [slaHours, setSlaHours] = useState(customer.slaHours?.toString() ?? "");
  const [scheduleState, setScheduleState] = useState<{ initialized: boolean; hours: WorkingHourEntry[] }>({
    initialized: false,
    hours: [],
  });

  const updateCustomer = useUpdateCustomer();
  const { data: savedHours } = useCustomerWorkingHours(customer.id);
  const setWorkingHours = useSetCustomerWorkingHours();

  // Pré-popula Segunda–Sexta 08:00–18:00 só na primeira vez que o cliente
  // entra no modo "horas úteis do cliente" sem nenhum horário salvo ainda —
  // depois disso, o que já foi salvo sempre tem prioridade.
  if (!scheduleState.initialized && savedHours !== undefined) {
    setScheduleState({
      initialized: true,
      hours: savedHours.length > 0 ? savedHours : DEFAULT_WORK_SCHEDULE,
    });
  }

  const schedule = scheduleState.hours;
  const setSchedule = (hours: WorkingHourEntry[]) => setScheduleState({ initialized: true, hours });

  const dirty =
    slaEnabled !== customer.slaEnabled || slaHourMode !== customer.slaHourMode || slaHours !== (customer.slaHours?.toString() ?? "");

  async function handleSaveSla() {
    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        slaEnabled,
        slaHourMode,
        slaHours: slaHours ? Number(slaHours) : undefined,
      });
      toast.success("Configuração de SLA salva");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar SLA"));
    }
  }

  async function handleSaveSchedule() {
    try {
      await setWorkingHours.mutateAsync({ id: customer.id, hours: schedule });
      toast.success("Horário de trabalho salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar horário"));
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">SLA de atendimento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={slaEnabled} onCheckedChange={(checked) => setSlaEnabled(checked === true)} />
            Ativar SLA para este cliente
          </label>

          {slaEnabled && (
            <div className="space-y-4 border-l-2 border-border pl-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tempo máximo de atendimento (horas)</Label>
                  <Input type="number" min={0} value={slaHours} onChange={(e) => setSlaHours(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Como contar as horas</Label>
                  <Select value={slaHourMode} onValueChange={(v) => v && setSlaHourMode(v as SlaHourMode)}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{(v: SlaHourMode) => HOUR_MODE_LABEL[v]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(HOUR_MODE_LABEL) as SlaHourMode[]).map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {HOUR_MODE_LABEL[mode]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {slaHourMode === "BUSINESS_HOURS_CUSTOMER" && (
                <div className="space-y-2">
                  <Label>Horário de trabalho do cliente</Label>
                  <WorkScheduleEditor value={schedule} onChange={setSchedule} />
                  <Button size="sm" onClick={handleSaveSchedule} disabled={setWorkingHours.isPending}>
                    Salvar horário
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end">
            <Button onClick={handleSaveSla} disabled={!dirty || updateCustomer.isPending}>
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
