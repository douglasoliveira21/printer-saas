"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { OnlineBadge, ColorBadge, connectionLabel, formatDateTime } from "@/components/shared/printer-badges";
import { useIgnorePrinter, usePrinters } from "@/hooks/use-printers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Printer } from "@/lib/types";
import { ClaimPrinterDialog } from "../claim-printer-dialog";

export default function NovasImpressorasPage() {
  const [claiming, setClaiming] = useState<Printer | null>(null);
  // DISCOVERED + agentEnrolled: printers auto-detected on clients that
  // already have a working (enrolled) Agent installed.
  const { data, isLoading } = usePrinters({ status: "DISCOVERED", agentEnrolled: true });
  const ignorePrinter = useIgnorePrinter();
  const printers = data?.data ?? [];

  async function handleIgnore(printer: Printer) {
    try {
      await ignorePrinter.mutateAsync(printer.id);
      toast.success("Impressora ignorada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao ignorar impressora"));
    }
  }

  function renderActions(printer: Printer) {
    return (
      <>
        <Button size="sm" variant="ghost" render={<Link href={`/impressoras/${printer.id}`}>Detalhes</Link>} />
        <Button size="sm" onClick={() => setClaiming(printer)}>
          Adicionar
        </Button>
        <Button size="sm" variant="outline" onClick={() => handleIgnore(printer)}>
          Ignorar
        </Button>
      </>
    );
  }

  const columns: DataTableColumn<Printer>[] = [
    { key: "online", header: "Comunicação", cell: (p) => <OnlineBadge status={p.onlineStatus} /> },
    { key: "color", header: "Cor", cell: (p) => <ColorBadge capabilities={p.capabilities} />, hideOnMobile: true },
    { key: "manufacturer", header: "Fabricante", cell: (p) => p.manufacturer || "—" },
    { key: "model", header: "Modelo", cell: (p) => p.model || "—" },
    { key: "serial", header: "Nº de série", cell: (p) => p.serial || "—", hideOnMobile: true },
    { key: "ip", header: "Endereço IP", cell: (p) => p.ip || "—" },
    { key: "connection", header: "Conexão", cell: (p) => connectionLabel(p.collectionMethod), hideOnMobile: true },
    { key: "agent", header: "Agent (cliente)", cell: (p) => p.agent?.name || "—", hideOnMobile: true },
    { key: "detected", header: "Detectada em", cell: (p) => formatDateTime(p.createdAt) },
    { key: "actions", header: "", cell: (p) => <div className="flex justify-end gap-1">{renderActions(p)}</div>, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novas Impressoras"
        description="Impressoras recém-detectadas em clientes que já possuem o Agent instalado. Adicione para começar a monitorar ou ignore."
      />

      {!isLoading && (
        <div className="text-sm text-muted-foreground">{printers.length} nova(s) impressora(s) aguardando decisão.</div>
      )}

      <ResponsiveDataTable
        columns={columns}
        data={printers}
        keyField={(p) => p.id}
        isLoading={isLoading}
        emptyIcon={Sparkles}
        emptyTitle="Nenhuma impressora nova"
        emptyDescription="Quando um Agent instalado descobrir novos equipamentos na rede, eles aparecerão aqui."
        cardTitle={(p) => (
          <span>
            {p.manufacturer || "Fabricante não disponível"} {p.model || ""}
          </span>
        )}
        cardMeta={(p) => <OnlineBadge status={p.onlineStatus} />}
        cardActions={renderActions}
      />

      {claiming && <ClaimPrinterDialog printer={claiming} onClose={() => setClaiming(null)} />}
    </div>
  );
}
