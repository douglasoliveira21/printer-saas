"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFAULT_WORK_SCHEDULE, WorkScheduleEditor } from "@/components/shared/work-schedule-editor";
import { useSetTenantWorkingHours, useTenantWorkingHours } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { WorkingHourEntry } from "@/lib/types";

/** Used by any customer whose SLA hour mode is "horas úteis da minha empresa" (see clientes/[id]/settings-tab.tsx). */
export function CompanyWorkingHoursCard() {
  const { data: savedHours } = useTenantWorkingHours();
  const setWorkingHours = useSetTenantWorkingHours();
  const [schedule, setSchedule] = useState<WorkingHourEntry[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized || savedHours === undefined) return;
    setSchedule(savedHours.length > 0 ? savedHours : DEFAULT_WORK_SCHEDULE);
    setInitialized(true);
  }, [savedHours, initialized]);

  async function handleSave() {
    try {
      await setWorkingHours.mutateAsync(schedule);
      toast.success("Horário de trabalho da empresa salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar horário"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Horário de trabalho da empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Usado como referência de horas úteis para clientes configurados com SLA no modo &quot;horas úteis da minha
          empresa&quot;.
        </p>
        <WorkScheduleEditor value={schedule} onChange={setSchedule} />
        <Button size="sm" onClick={handleSave} disabled={setWorkingHours.isPending}>
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
