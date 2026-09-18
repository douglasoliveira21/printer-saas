"use client";

import { toast } from "sonner";
import { AlertTriangle, Bell, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { useAlerts, useResolveAlert, type Alert } from "@/hooks/use-alerts";
import { getApiErrorMessage } from "@/lib/api-client";
import { CreateServiceOrderFromAlertDialog } from "./create-service-order-from-alert-dialog";

const LEVEL_CONFIG: Record<Alert["level"], { label: string; variant: "default" | "destructive" | "secondary"; icon: typeof Info; tone: string }> = {
  CRITICAL: { label: "Crítico", variant: "destructive", icon: ShieldAlert, tone: "text-destructive" },
  WARNING: { label: "Aviso", variant: "default", icon: AlertTriangle, tone: "text-amber-600" },
  INFO: { label: "Info", variant: "secondary", icon: Info, tone: "text-primary" },
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
      <PageHeader title="Alertas" />

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted" />
          ))}
        </div>
      )}
      {!isLoading && !alerts?.length && (
        <Card>
          <EmptyState icon={Bell} title="Nenhum alerta em aberto" description="Tudo certo por aqui." />
        </Card>
      )}

      <div className="space-y-3">
        {alerts?.map((alert) => {
          const config = LEVEL_CONFIG[alert.level];
          const Icon = config.icon;
          return (
            <Card key={alert.id}>
              <CardContent className="flex flex-col items-start justify-between gap-3 py-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${config.tone}`} />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={config.variant}>{config.label}</Badge>
                      {alert.printer?.customer && <span className="text-xs text-muted-foreground">{alert.printer.customer.legalName}</span>}
                    </div>
                    <p className="mt-1 text-sm">{alert.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{new Date(alert.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <CreateServiceOrderFromAlertDialog alert={alert} />
                  <Button size="sm" variant="outline" onClick={() => handleResolve(alert.id)} disabled={resolveAlert.isPending}>
                    Resolver
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
