"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Wifi, WifiOff, HelpCircle, Printer as PrinterIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { STATUS_BADGE_CLASS } from "@/lib/status-colors";
import { useIgnorePrinter, usePrinters, useRestorePrinter } from "@/hooks/use-printers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Printer } from "@/lib/types";
import { ClaimPrinterDialog } from "./claim-printer-dialog";

const STATUS_LABEL: Record<string, string> = {
  DISCOVERED: "Descoberta",
  MONITORED: "Monitorada",
  IGNORED: "Ignorada",
  DECOMMISSIONED: "Desativada",
};

function OnlineBadge({ status }: { status: Printer["onlineStatus"] }) {
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

export default function ImpressorasPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [claiming, setClaiming] = useState<Printer | null>(null);
  const { data, isLoading } = usePrinters({ search: search || undefined, status: status === "all" ? undefined : status });
  const ignorePrinter = useIgnorePrinter();
  const restorePrinter = useRestorePrinter();

  async function handleIgnore(printer: Printer) {
    try {
      await ignorePrinter.mutateAsync(printer.id);
      toast.success("Impressora ignorada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao ignorar impressora"));
    }
  }

  async function handleRestore(printer: Printer) {
    try {
      await restorePrinter.mutateAsync(printer.id);
      toast.success("Impressora restaurada para Descoberta");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao restaurar impressora"));
    }
  }

  function renderActions(printer: Printer) {
    return (
      <>
        {printer.status === "DISCOVERED" && (
          <>
            <Button size="sm" onClick={() => setClaiming(printer)}>
              Adicionar
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleIgnore(printer)}>
              Ignorar
            </Button>
          </>
        )}
        {(printer.status === "IGNORED" || printer.status === "DECOMMISSIONED") && (
          <Button size="sm" variant="outline" onClick={() => handleRestore(printer)}>
            Restaurar
          </Button>
        )}
      </>
    );
  }

  const columns: DataTableColumn<Printer>[] = [
    {
      key: "status",
      header: "Status",
      cell: (p) => <Badge variant={p.status === "MONITORED" ? "default" : "outline"}>{STATUS_LABEL[p.status]}</Badge>,
      hideOnMobile: true,
    },
    {
      key: "equipment",
      header: "Equipamento",
      cell: (p) => (
        <>
          <Link href={`/impressoras/${p.id}`} className="hover:underline">
            {p.manufacturer || "Fabricante não disponível"} {p.model || ""}
          </Link>
          <div className="text-xs text-muted-foreground">{p.serial || "Serial não disponível"}</div>
        </>
      ),
      hideOnMobile: true,
    },
    { key: "customer", header: "Cliente", cell: (p) => p.customer?.legalName || "—" },
    { key: "ip", header: "IP", cell: (p) => p.ip || "Não disponível" },
    { key: "online", header: "Situação", cell: (p) => <OnlineBadge status={p.onlineStatus} />, hideOnMobile: true },
    {
      key: "lastCollectedAt",
      header: "Última coleta",
      cell: (p) => (p.lastCollectedAt ? new Date(p.lastCollectedAt).toLocaleString("pt-BR") : "Nunca"),
    },
    { key: "actions", header: "", cell: (p) => <div className="flex justify-end gap-2">{renderActions(p)}</div>, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Impressoras" />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por IP, serial, modelo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {(value: string) =>
                ({
                  all: "Todos os status",
                  DISCOVERED: "Descobertas",
                  MONITORED: "Monitoradas",
                  IGNORED: "Ignoradas",
                  DECOMMISSIONED: "Desativadas",
                })[value] ?? value
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="DISCOVERED">Descobertas</SelectItem>
            <SelectItem value="MONITORED">Monitoradas</SelectItem>
            <SelectItem value="IGNORED">Ignoradas</SelectItem>
            <SelectItem value="DECOMMISSIONED">Desativadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={data?.data}
        keyField={(p) => p.id}
        isLoading={isLoading}
        emptyIcon={PrinterIcon}
        emptyTitle="Nenhuma impressora encontrada"
        emptyDescription="Instale um Agent para começar a descobrir impressoras na rede."
        cardTitle={(p) => (
          <Link href={`/impressoras/${p.id}`} className="hover:underline">
            {p.manufacturer || "Fabricante não disponível"} {p.model || ""}
          </Link>
        )}
        cardMeta={(p) => <OnlineBadge status={p.onlineStatus} />}
        cardActions={renderActions}
      />

      {claiming && <ClaimPrinterDialog printer={claiming} onClose={() => setClaiming(null)} />}
    </div>
  );
}
