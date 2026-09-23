"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useClosingSettings, useUpdateClosingSettings, type ClosingSettings } from "@/hooks/use-tenant-settings";
import { getApiErrorMessage } from "@/lib/api-client";

export function ClosingTogglesCard() {
  const { data, isLoading } = useClosingSettings();
  const updateSettings = useUpdateClosingSettings();

  async function handleToggle(key: keyof ClosingSettings, checked: boolean) {
    try {
      await updateSettings.mutateAsync({ [key]: checked });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  if (isLoading || !data) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configurações de contratos e fechamentos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={data.allowDisablingPrinterMonitoring}
              onCheckedChange={(v) => handleToggle("allowDisablingPrinterMonitoring", v === true)}
            />
            Desabilitar manualmente o monitoramento das impressoras nos contratos
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={data.allowEditingClosingDocumentNumber}
              onCheckedChange={(v) => handleToggle("allowEditingClosingDocumentNumber", v === true)}
            />
            Alterar número do documento dos fechamentos
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Relatório de detalhes da impressora</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={data.hideUnknownLevelSupplies} onCheckedChange={(v) => handleToggle("hideUnknownLevelSupplies", v === true)} />
            Ocultar suprimentos com nível desconhecido
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={data.hideNonTonerSupplies} onCheckedChange={(v) => handleToggle("hideNonTonerSupplies", v === true)} />
            Ocultar suprimentos que não sejam Toners
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
