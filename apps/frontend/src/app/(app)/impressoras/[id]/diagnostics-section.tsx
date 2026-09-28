import { Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  success: "default",
  not_available: "outline",
  table_empty: "outline",
  failed: "destructive",
  host_probe_exceeded_ceiling: "destructive",
};

/**
 * Fase 9 (diagnóstico) — mostra os dicionários que o Agent já coleta há
 * tempo (capabilitySources, discoveryDiagnostics) mas que nunca tinham
 * aparecido em lugar nenhum da tela — só existiam no banco. Responde "por
 * que esse campo veio vazio?" sem precisar olhar log nem banco direto.
 * Puramente informativo/suporte: nunca usado pra decidir o que mais
 * renderizar na página.
 */
export function DiagnosticsSection({
  capabilitySources,
  discoveryDiagnostics,
}: {
  capabilitySources?: Record<string, string> | null;
  discoveryDiagnostics?: Record<string, string> | null;
}) {
  const hasSources = capabilitySources && Object.keys(capabilitySources).length > 0;
  const hasDiagnostics = discoveryDiagnostics && Object.keys(discoveryDiagnostics).length > 0;
  if (!hasSources && !hasDiagnostics) {
    return null;
  }

  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
        <Wrench className="h-5 w-5 text-neutral-400" />
        Diagnóstico técnico da última coleta
      </h2>
      <Card>
        <CardContent className="space-y-4 py-4 text-sm">
          {hasDiagnostics && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Resultado por protocolo/tabela</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(discoveryDiagnostics!).map(([key, value]) => (
                  <Badge key={key} variant={OUTCOME_VARIANT[value] ?? "secondary"} title={`${key}: ${value}`}>
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {hasSources && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Origem de cada capacidade</p>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(capabilitySources!).map(([key, value]) => (
                  <Badge key={key} variant="outline" title={`${key}: ${value}`}>
                    {key}: {value}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
