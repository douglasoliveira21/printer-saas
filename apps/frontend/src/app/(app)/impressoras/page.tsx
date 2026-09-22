"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Printer as PrinterIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import {
  OnlineBadge,
  ColorBadge,
  PRINTER_STATUS_LABEL,
  connectionLabel,
  ownerLabel,
} from "@/components/shared/printer-badges";
import { useIgnorePrinter, usePrinters, useRestorePrinter } from "@/hooks/use-printers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Printer } from "@/lib/types";
import { ClaimPrinterDialog } from "./claim-printer-dialog";

export default function ParqueCompletoPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [claiming, setClaiming] = useState<Printer | null>(null);
  const { data, isLoading } = usePrinters({ search: search || undefined, status: status === "all" ? undefined : status });
  const ignorePrinter = useIgnorePrinter();
  const restorePrinter = useRestorePrinter();

  const printers = data?.data ?? [];

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
        <Button size="sm" variant="ghost" render={<Link href={`/impressoras/${printer.id}`}>Detalhes</Link>} />
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
    { key: "online", header: "Comunicação", cell: (p) => <OnlineBadge status={p.onlineStatus} /> },
    {
      key: "status",
      header: "Status",
      cell: (p) => <Badge variant={p.status === "MONITORED" ? "default" : "outline"}>{PRINTER_STATUS_LABEL[p.status]}</Badge>,
      hideOnMobile: true,
    },
    { key: "color", header: "Cor", cell: (p) => <ColorBadge capabilities={p.capabilities} /> },
    { key: "manufacturer", header: "Fabricante", cell: (p) => p.manufacturer || "—" },
    {
      key: "model",
      header: "Modelo",
      cell: (p) => (
        <Link href={`/impressoras/${p.id}`} className="hover:underline">
          {p.model || "—"}
        </Link>
      ),
    },
    { key: "serial", header: "Nº de série", cell: (p) => p.serial || "—", hideOnMobile: true },
    { key: "connection", header: "Conexão", cell: (p) => connectionLabel(p.collectionMethod), hideOnMobile: true },
    { key: "owner", header: "Proprietário", cell: (p) => ownerLabel(p) },
    {
      key: "location",
      header: "Localização atual",
      cell: (p) => p.location?.name || (p.ip ? `IP ${p.ip}` : "—"),
      hideOnMobile: true,
    },
    { key: "actions", header: "", cell: (p) => <div className="flex justify-end gap-1">{renderActions(p)}</div>, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Parque Completo" description="Todo o parque de máquinas monitorado e descoberto pelos Agents." />

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
        {!isLoading && (
          <span className="text-sm text-muted-foreground">
            {printers.length} equipamento(s)
          </span>
        )}
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={printers}
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
