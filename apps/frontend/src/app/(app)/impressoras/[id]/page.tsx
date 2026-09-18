"use client";

import { use, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Ban, Droplet, FileStack, Info, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDecommissionPrinter, usePrinter } from "@/hooks/use-printers";
import { useAlerts } from "@/hooks/use-alerts";
import { getApiErrorMessage } from "@/lib/api-client";
import { EditPrinterDialog } from "./edit-printer-dialog";
import { RegisterReplacementDialog } from "./register-replacement-dialog";
import { PrinterInfoGrid } from "./printer-info-grid";
import { CountersList } from "./counters-list";
import { HistoryTab } from "./history-tab";
import { TimelineTab } from "./timeline-tab";
import { CommentsTab } from "./comments-tab";

function formatForecast(daysRemaining: number, predictedReplacementAt: string) {
  const date = new Date(predictedReplacementAt).toLocaleDateString("pt-BR");
  const days = Math.max(0, Math.round(daysRemaining));
  return `Previsão de troca: ${date} (~${days} dia${days === 1 ? "" : "s"})`;
}

const CONSUMABLE_COLOR_HEX: Record<string, string> = {
  black: "#1f2937",
  cyan: "#06b6d4",
  magenta: "#ec4899",
  yellow: "#eab308",
};

const ALERT_LEVEL_CONFIG = {
  CRITICAL: { label: "Crítico", variant: "destructive" as const, icon: ShieldAlert },
  WARNING: { label: "Aviso", variant: "default" as const, icon: AlertTriangle },
  INFO: { label: "Info", variant: "secondary" as const, icon: Info },
};

export default function PrinterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: printer, isLoading } = usePrinter(id);
  const { data: alerts } = useAlerts(undefined, id);
  const [decommissioning, setDecommissioning] = useState(false);
  const decommissionPrinter = useDecommissionPrinter();

  async function handleDecommission() {
    try {
      await decommissionPrinter.mutateAsync(id);
      toast.success("Impressora desativada");
      setDecommissioning(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao desativar impressora"));
    }
  }

  if (isLoading) {
    return <p className="text-neutral-400">Carregando...</p>;
  }

  if (!printer) {
    return <p className="text-neutral-400">Impressora não encontrada.</p>;
  }

  const latestCounter = printer.counters?.[0];

  // Latest reading per physical part — consumables come back newest-first.
  // Keyed by name (e.g. "Fuser", "MP Roller") when available, since most
  // non-toner supply items share the same type/color (both often absent);
  // keying by type+color alone would collapse them all into one entry.
  const latestConsumables = new Map<string, NonNullable<typeof printer.consumables>[number]>();
  for (const c of printer.consumables ?? []) {
    const key = c.name ?? `${c.type}:${c.color ?? "default"}`;
    if (!latestConsumables.has(key)) {
      latestConsumables.set(key, c);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/impressoras" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-900">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Impressoras
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            {printer.manufacturer || "Fabricante não disponível"} {printer.model || ""}
          </h1>
          <p className="text-sm text-neutral-500">
            {printer.customer?.legalName ?? "Sem cliente vinculado"}
            {printer.location ? ` — ${printer.location.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={printer.onlineStatus === "ONLINE" ? "default" : "destructive"}>
            {printer.onlineStatus === "ONLINE" ? "Online" : printer.onlineStatus === "OFFLINE" ? "Offline" : "Desconhecido"}
          </Badge>
          <EditPrinterDialog printer={printer} />
          {printer.status !== "DECOMMISSIONED" && (
            <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600" onClick={() => setDecommissioning(true)}>
              <Ban className="mr-2 h-4 w-4" />
              Desativar
            </Button>
          )}
        </div>
      </div>

      <Dialog open={decommissioning} onOpenChange={setDecommissioning}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desativar impressora</DialogTitle>
            <DialogDescription>
              Marca este equipamento como desativado (removido/substituído). O histórico de contadores e OS é preservado.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDecommission} disabled={decommissionPrinter.isPending}>
              Desativar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="timeline">Linha do tempo</TabsTrigger>
          <TabsTrigger value="comments">Comentários</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-6">
          <Card>
            <CardContent className="py-4">
              <PrinterInfoGrid printer={printer} />
            </CardContent>
          </Card>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <FileStack className="h-5 w-5 text-neutral-400" />
              Contadores gerais
            </h2>
            <Card>
              <CardContent className="py-4">
                <CountersList counter={latestCounter} />
              </CardContent>
            </Card>
            {!latestCounter && <p className="mt-2 text-sm text-neutral-400">Nenhuma leitura de contador recebida ainda.</p>}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <Droplet className="h-5 w-5 text-neutral-400" />
              Toner / Consumíveis
            </h2>
            {latestConsumables.size === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum consumível reportado ainda.</p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from(latestConsumables.values()).map((c) => {
                  const level = c.levelPercent;
                  const barColor = level === null ? "#9ca3af" : level <= 10 ? "#dc2626" : level <= 20 ? "#f59e0b" : "#16a34a";
                  const stats = c.stats;
                  return (
                    <Card key={c.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-neutral-500">
                          {c.color && (
                            <span
                              className="h-3 w-3 rounded-full border"
                              style={{ backgroundColor: CONSUMABLE_COLOR_HEX[c.color] ?? "#9ca3af" }}
                            />
                          )}
                          {c.name || c.color || c.type}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {level === null || level === undefined ? (
                          <p className="text-sm text-neutral-400">Não disponível</p>
                        ) : (
                          <>
                            <div className="text-xl font-bold">{level}%</div>
                            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                              <div className="h-full rounded-full" style={{ width: `${level}%`, backgroundColor: barColor }} />
                            </div>
                          </>
                        )}
                        {c.forecast && (
                          <p className="mt-2 text-xs text-neutral-500">
                            {formatForecast(c.forecast.daysRemaining, c.forecast.predictedReplacementAt)}
                          </p>
                        )}
                        {stats && (
                          <dl className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
                            <div className="flex items-center justify-between">
                              <dt className="text-muted-foreground">Páginas impressas até agora</dt>
                              <dd className="font-medium">{stats.pagesPrintedSinceInstall?.toLocaleString("pt-BR") ?? "Não disponível"}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt className="text-muted-foreground">Média de páginas por troca</dt>
                              <dd className="font-medium">{stats.averagePagesPerReplacement?.toLocaleString("pt-BR") ?? "Não disponível"}</dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt className="text-muted-foreground">Média de tempo entre trocas</dt>
                              <dd className="font-medium">
                                {stats.averageDaysBetweenReplacements !== null ? `${stats.averageDaysBetweenReplacements} dias` : "Não disponível"}
                              </dd>
                            </div>
                            <div className="flex items-center justify-between">
                              <dt className="text-muted-foreground">Cobertura média (estimada)</dt>
                              <dd className="font-medium">
                                {stats.estimatedCoveragePercent !== null ? `${stats.estimatedCoveragePercent}% / página` : "Não disponível"}
                              </dd>
                            </div>
                          </dl>
                        )}
                        <div className="mt-3">
                          <RegisterReplacementDialog printerId={printer.id} type={c.type} color={c.color} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <AlertTriangle className="h-5 w-5 text-neutral-400" />
              Alertas desta impressora
            </h2>
            {!alerts || alerts.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum alerta para esta impressora.</p>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => {
                  const config = ALERT_LEVEL_CONFIG[alert.level];
                  const Icon = config.icon;
                  return (
                    <Card key={alert.id}>
                      <CardContent className="flex items-center gap-3 py-3">
                        <Icon className={`h-4 w-4 ${alert.level === "CRITICAL" ? "text-red-600" : alert.level === "WARNING" ? "text-amber-600" : "text-blue-600"}`} />
                        <Badge variant={config.variant}>{config.label}</Badge>
                        <span className="text-sm">{alert.message}</span>
                        <span className="ml-auto text-xs text-neutral-400">{new Date(alert.createdAt).toLocaleString("pt-BR")}</span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab printerId={id} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineTab printerId={id} />
        </TabsContent>

        <TabsContent value="comments" className="mt-4">
          <CommentsTab printerId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
