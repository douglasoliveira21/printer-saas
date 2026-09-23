"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAlertThresholds, useUpdateAlertThresholds } from "@/hooks/use-tenant-settings";
import { getApiErrorMessage } from "@/lib/api-client";

export function CommunicationThresholdsTab() {
  const { data, isLoading } = useAlertThresholds();
  const updateThresholds = useUpdateAlertThresholds();
  const [agentHours, setAgentHours] = useState("");
  const [printerHours, setPrinterHours] = useState("");

  useEffect(() => {
    if (!data) return;
    setAgentHours(data.agentOfflineThresholdHours ? String(data.agentOfflineThresholdHours) : "");
    setPrinterHours(data.printerOfflineThresholdHours ? String(data.printerOfflineThresholdHours) : "");
  }, [data]);

  async function handleSave() {
    try {
      await updateThresholds.mutateAsync({
        agentOfflineThresholdHours: agentHours ? Number(agentHours) : undefined,
        printerOfflineThresholdHours: printerHours ? Number(printerHours) : undefined,
      });
      toast.success("Limiares salvos");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Alertas de falha na comunicação — selecione as horas que você deseja aguardar antes de receber os alertas
          (em branco usa o padrão do sistema).
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="agentHours">Agent sem comunicação (horas)</Label>
            <Input id="agentHours" type="number" min="1" value={agentHours} onChange={(e) => setAgentHours(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="printerHours">Impressora sem comunicação (horas)</Label>
            <Input id="printerHours" type="number" min="1" value={printerHours} onChange={(e) => setPrinterHours(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateThresholds.isPending}>
            {updateThresholds.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
