"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useClosingSettings, useUpdateClosingSettings } from "@/hooks/use-tenant-settings";
import { getApiErrorMessage } from "@/lib/api-client";
import { CLOSING_REPORT_COLUMNS, PRINT_USAGE_REPORT_COLUMNS, type ReportColumnGroup } from "./report-columns";

function ColumnGroups({
  groups,
  values,
  onToggle,
}: {
  groups: ReportColumnGroup[];
  values: Record<string, boolean>;
  onToggle: (key: string, checked: boolean) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.group} className="space-y-2">
          <p className="text-xs font-semibold uppercase text-muted-foreground">{group.group}</p>
          <div className="flex flex-wrap gap-4">
            {group.columns.map((col) => (
              <label key={col.key} className="flex items-center gap-2 text-sm" title={col.wired ? undefined : "Guardado, sem efeito no relatório ainda"}>
                <Checkbox checked={values[col.key] ?? false} onCheckedChange={(v) => onToggle(col.key, v === true)} />
                {col.label}
                {!col.wired && <span className="text-xs text-muted-foreground">(em breve)</span>}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportSettingsTab() {
  const { data, isLoading } = useClosingSettings();
  const updateSettings = useUpdateClosingSettings();

  const [title, setTitle] = useState("Relatório de Fechamento");
  const [closingColumns, setClosingColumns] = useState<Record<string, boolean>>({});
  const [printUsageColumns, setPrintUsageColumns] = useState<Record<string, boolean>>({});
  const [additionalText, setAdditionalText] = useState("");

  useEffect(() => {
    if (!data) return;
    setTitle(data.closingReportTitle);
    setClosingColumns(data.closingReportColumns ?? {});
    setPrintUsageColumns(data.printUsageReportColumns ?? {});
    setAdditionalText(data.additionalText ?? "");
  }, [data]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({
        closingReportTitle: title,
        closingReportColumns: closingColumns,
        printUsageReportColumns: printUsageColumns,
        additionalText,
      });
      toast.success("Configurações de relatório salvas");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  if (isLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Título do relatório de fechamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Input value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} />
          <p className="text-xs text-muted-foreground">{title.length}/40 caracteres</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Colunas do relatório de fechamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ColumnGroups
            groups={CLOSING_REPORT_COLUMNS}
            values={closingColumns}
            onToggle={(key, checked) => setClosingColumns((prev) => ({ ...prev, [key]: checked }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Texto adicional no relatório de fechamento</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={3} value={additionalText} onChange={(e) => setAdditionalText(e.target.value)} placeholder="Insira seu texto adicional" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Colunas do relatório de impressões e cópias</CardTitle>
        </CardHeader>
        <CardContent>
          <ColumnGroups
            groups={PRINT_USAGE_REPORT_COLUMNS}
            values={printUsageColumns}
            onToggle={(key, checked) => setPrintUsageColumns((prev) => ({ ...prev, [key]: checked }))}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
