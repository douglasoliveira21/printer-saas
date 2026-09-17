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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useDecommissionPrinter, usePrinter } from "@/hooks/use-printers";
import { useAlerts } from "@/hooks/use-alerts";
import { getApiErrorMessage } from "@/lib/api-client";
import { EditPrinterDialog } from "./edit-printer-dialog";

function formatPages(value: number | null | undefined) {
  return value === null || value === undefined ? "Não disponível" : value.toLocaleString("pt-BR");
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
          <Badge variant="outline">{printer.status === "MONITORED" ? "Monitorada" : printer.status}</Badge>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">IP</CardTitle>
          </CardHeader>
          <CardContent>{printer.ip || "Não disponível"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Serial</CardTitle>
          </CardHeader>
          <CardContent>{printer.serial || "Não disponível"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Agent</CardTitle>
          </CardHeader>
          <CardContent>{printer.agent?.name || "Não disponível"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Última coleta</CardTitle>
          </CardHeader>
          <CardContent>{printer.lastCollectedAt ? new Date(printer.lastCollectedAt).toLocaleString("pt-BR") : "Nunca"}</CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
          <FileStack className="h-5 w-5 text-neutral-400" />
          Contadores
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{formatPages(latestCounter?.total)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">P&B</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{formatPages(latestCounter?.blackWhite)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">Colorido</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{formatPages(latestCounter?.color)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">Cópias</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{formatPages(latestCounter?.copies)}</CardContent>
          </Card>
        </div>
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from(latestConsumables.values()).map((c) => {
              const level = c.levelPercent;
              const barColor = level === null ? "#9ca3af" : level <= 10 ? "#dc2626" : level <= 20 ? "#f59e0b" : "#16a34a";
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

      <div>
        <h2 className="mb-3 text-lg font-semibold">Histórico de contadores</h2>
        {!printer.counters || printer.counters.length === 0 ? (
          <p className="text-sm text-neutral-400">Sem histórico ainda.</p>
        ) : (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>P&B</TableHead>
                  <TableHead>Colorido</TableHead>
                  <TableHead>Cópias</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {printer.counters.slice(0, 15).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{new Date(c.collectedAt).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{formatPages(c.total)}</TableCell>
                    <TableCell>{formatPages(c.blackWhite)}</TableCell>
                    <TableCell>{formatPages(c.color)}</TableCell>
                    <TableCell>{formatPages(c.copies)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
