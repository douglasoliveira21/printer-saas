"use client";

import { toast } from "sonner";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAlerts, useResolveAlert, type Alert } from "@/hooks/use-alerts";
import { getApiErrorMessage } from "@/lib/api-client";

const LEVEL_CONFIG: Record<Alert["level"], { label: string; variant: "default" | "destructive" | "secondary"; icon: typeof Info }> = {
  CRITICAL: { label: "Crítico", variant: "destructive", icon: ShieldAlert },
  WARNING: { label: "Aviso", variant: "default", icon: AlertTriangle },
  INFO: { label: "Info", variant: "secondary", icon: Info },
};

export default function AlertasPage() {
  const { data: alerts, isLoading } = useAlerts("OPEN");
  const resolveAlert = useResolveAlert();

  async function handleResolve(id: string) {
    try {
      await resolveAlert.mutateAsync(id);
      toast.success("Alerta resolvido");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao resolver alerta"));
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Alertas</h1>

      {isLoading && <p className="text-neutral-400">Carregando...</p>}
      {!isLoading && !alerts?.length && <p className="text-neutral-400">Nenhum alerta em aberto. Tudo certo por aqui.</p>}

      <div className="space-y-3">
        {alerts?.map((alert) => {
          const config = LEVEL_CONFIG[alert.level];
          const Icon = config.icon;
          return (
            <Card key={alert.id}>
              <CardContent className="flex items-start justify-between gap-4 py-4">
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 ${alert.level === "CRITICAL" ? "text-red-600" : alert.level === "WARNING" ? "text-amber-600" : "text-blue-600"}`} />
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant={config.variant}>{config.label}</Badge>
                      {alert.printer?.customer && <span className="text-xs text-neutral-400">{alert.printer.customer.legalName}</span>}
                    </div>
                    <p className="mt-1 text-sm">{alert.message}</p>
                    <p className="mt-1 text-xs text-neutral-400">{new Date(alert.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleResolve(alert.id)} disabled={resolveAlert.isPending}>
                  Resolver
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
