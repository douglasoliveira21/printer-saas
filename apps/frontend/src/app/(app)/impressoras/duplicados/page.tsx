"use client";

import Link from "next/link";
import { CopyCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { OnlineBadge, PRINTER_STATUS_LABEL, connectionLabel, formatDateTime, ownerLabel } from "@/components/shared/printer-badges";
import { usePrinterDuplicates } from "@/hooks/use-printers";
import type { PrinterDuplicateGroup } from "@/lib/types";

export default function MonitoramentosDuplicadosPage() {
  const { data, isLoading } = usePrinterDuplicates();
  const groups = data?.groups ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monitoramentos Duplicados"
        description="Mesma impressora (mesmo número de série) cadastrada mais de uma vez — normalmente porque o equipamento mudou de IP e foi redescoberto."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="h-40 animate-pulse bg-muted" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={CopyCheck}
            title="Nenhum monitoramento duplicado"
            description="Nenhum número de série aparece em mais de um cadastro. Tudo certo!"
          />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <TriangleAlert className="h-4 w-4" />
            {groups.length} série(s) com cadastro duplicado.
          </div>
          {groups.map((group) => (
            <DuplicateGroupCard key={group.normalizedSerial} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function DuplicateGroupCard({ group }: { group: PrinterDuplicateGroup }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-4 py-3">
        <div>
          <div className="text-sm text-muted-foreground">Número de série</div>
          <div className="font-mono font-medium">{group.serial}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="destructive" className="gap-1">
            {group.count} cadastros
          </Badge>
          {group.distinctIps.length > 1 && (
            <Badge variant="outline" className="gap-1">
              {group.distinctIps.length} IPs distintos
            </Badge>
          )}
        </div>
      </div>

      <div className="divide-y">
        {group.printers.map((p) => (
          <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Link href={`/impressoras/${p.id}`} className="font-medium hover:underline">
                  {p.manufacturer || "Fabricante não disponível"} {p.model || ""}
                </Link>
                <Badge variant={p.status === "MONITORED" ? "default" : "outline"}>{PRINTER_STATUS_LABEL[p.status]}</Badge>
                <OnlineBadge status={p.onlineStatus} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>IP: {p.ip || "—"}</span>
                <span>Conexão: {connectionLabel(p.collectionMethod)}</span>
                <span>Proprietário: {ownerLabel(p)}</span>
                <span>Local: {p.location?.name || "—"}</span>
                <span>Agent: {p.agent?.name || "—"}</span>
                <span>Última comunicação: {formatDateTime(p.lastSeenAt)}</span>
              </div>
            </div>
            <Button size="sm" variant="outline" render={<Link href={`/impressoras/${p.id}`}>Ver detalhes</Link>} />
          </div>
        ))}
      </div>
    </Card>
  );
}
