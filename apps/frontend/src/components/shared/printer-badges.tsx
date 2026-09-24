"use client";

import { Wifi, WifiOff, HelpCircle, Droplet, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASS } from "@/lib/status-colors";
import type { Printer, PrinterCapabilities } from "@/lib/types";

/**
 * Situação de comunicação (onlineStatus). Offline é só o ícone (sem a
 * palavra "Offline" escrita) — o wifi cortado vermelho já comunica sozinho;
 * Online/Desconhecido continuam com texto, já que não foi pedido pra tirar.
 */
export function OnlineBadge({ status }: { status: Printer["onlineStatus"] }) {
  if (status === "ONLINE") {
    return (
      <Badge className={STATUS_BADGE_CLASS.online}>
        <Wifi className="h-3 w-3" /> Online
      </Badge>
    );
  }
  if (status === "OFFLINE") {
    return <WifiOff className="h-5 w-5 text-red-600" aria-label="Offline" />;
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <HelpCircle className="h-3 w-3" /> Desconhecido
    </Badge>
  );
}

/**
 * Cor de impressão: colorida vs. preto e branco. Derived only from the
 * confirmed capability (capabilities.color) — never guessed. Absent/unknown
 * shows a neutral "—" so we don't invent a value the device never reported.
 * Colorida = gota ciano + gota magenta; preto e branco = gota preta + gota
 * branca (com contorno, senão a gota branca some no fundo da página).
 */
export function ColorBadge({ capabilities }: { capabilities: PrinterCapabilities | null | undefined }) {
  const color = capabilities?.color;
  if (color === true) {
    return (
      <span className="flex items-center gap-0.5" aria-label="Colorida">
        <Droplet className="h-4 w-4 fill-current text-cyan-500" />
        <Droplet className="h-4 w-4 fill-current text-fuchsia-500" />
      </span>
    );
  }
  if (color === false) {
    return (
      <span className="flex items-center gap-0.5" aria-label="Preto e branco">
        <Droplet className="h-4 w-4 fill-current text-black dark:text-white" />
        <Droplet className="h-4 w-4 fill-white text-neutral-400 dark:fill-neutral-800" />
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export const PRINTER_STATUS_LABEL: Record<string, string> = {
  DISCOVERED: "Descoberta",
  MONITORED: "Monitorada",
  IGNORED: "Ignorada",
  DECOMMISSIONED: "Desativada",
};

/** Status de monitoramento — check verde quando monitorada, X vermelho pra qualquer outro status (descoberta/ignorada/desativada). */
export function StatusIcon({ status }: { status: Printer["status"] }) {
  if (status === "MONITORED") {
    return <CheckCircle2 className="h-5 w-5 text-green-600" aria-label={PRINTER_STATUS_LABEL[status]} />;
  }
  return <XCircle className="h-5 w-5 text-red-600" aria-label={PRINTER_STATUS_LABEL[status] ?? status} />;
}

/** Tipo de conexão — how counters/consumables are collected for this printer. */
export function connectionLabel(method: Printer["collectionMethod"]): string {
  if (method === "SNMP") return "Rede (SNMP)";
  if (method === "MANUAL") return "Manual";
  return "—";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "Nunca";
  return new Date(value).toLocaleString("pt-BR");
}

/** Proprietário / cliente vinculado. */
export function ownerLabel(printer: Printer): string {
  return printer.customer?.tradeName || printer.customer?.legalName || "Sem proprietário";
}
