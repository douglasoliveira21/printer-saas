"use client";

import { Wifi, WifiOff, HelpCircle, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE_CLASS } from "@/lib/status-colors";
import type { Printer, PrinterCapabilities } from "@/lib/types";

/** Situação de comunicação (onlineStatus) — same three states used across the printer submenus. */
export function OnlineBadge({ status }: { status: Printer["onlineStatus"] }) {
  if (status === "ONLINE") {
    return (
      <Badge className={STATUS_BADGE_CLASS.online}>
        <Wifi className="h-3 w-3" /> Online
      </Badge>
    );
  }
  if (status === "OFFLINE") {
    return (
      <Badge variant="destructive" className="gap-1">
        <WifiOff className="h-3 w-3" /> Offline
      </Badge>
    );
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
 */
export function ColorBadge({ capabilities }: { capabilities: PrinterCapabilities | null | undefined }) {
  const color = capabilities?.color;
  if (color === true) {
    return (
      <Badge variant="outline" className="gap-1 border-fuchsia-400 text-fuchsia-600 dark:text-fuchsia-400">
        <Circle className="h-3 w-3 fill-current" /> Colorida
      </Badge>
    );
  }
  if (color === false) {
    return (
      <Badge variant="outline" className="gap-1 text-foreground/70">
        <Circle className="h-3 w-3 fill-current" /> Preto e branco
      </Badge>
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
