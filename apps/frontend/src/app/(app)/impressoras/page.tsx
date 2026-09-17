"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Wifi, WifiOff, HelpCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
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
      <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Impressoras</h1>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <Input placeholder="Buscar por IP, serial, modelo..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
          <SelectTrigger className="w-48">
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

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Equipamento</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Situação</TableHead>
              <TableHead>Última coleta</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-400">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !data?.data.length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-neutral-400">
                  Nenhuma impressora encontrada. Instale um Agent para começar a descobrir impressoras na rede.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((printer) => (
              <TableRow key={printer.id}>
                <TableCell>
                  <Badge variant={printer.status === "MONITORED" ? "default" : "outline"}>{STATUS_LABEL[printer.status]}</Badge>
                </TableCell>
                <TableCell className="font-medium">
                  <Link href={`/impressoras/${printer.id}`} className="hover:underline">
                    {printer.manufacturer || "Fabricante não disponível"} {printer.model || ""}
                  </Link>
                  <div className="text-xs text-neutral-400">{printer.serial || "Serial não disponível"}</div>
                </TableCell>
                <TableCell>{printer.customer?.legalName || "—"}</TableCell>
                <TableCell>{printer.ip || "Não disponível"}</TableCell>
                <TableCell>
                  <OnlineBadge status={printer.onlineStatus} />
                </TableCell>
                <TableCell>{printer.lastCollectedAt ? new Date(printer.lastCollectedAt).toLocaleString("pt-BR") : "Nunca"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {claiming && <ClaimPrinterDialog printer={claiming} onClose={() => setClaiming(null)} />}
    </div>
  );
}
