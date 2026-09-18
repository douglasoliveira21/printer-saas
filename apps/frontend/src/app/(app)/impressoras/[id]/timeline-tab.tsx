"use client";

import { Droplet, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { usePrinterTimeline } from "@/hooks/use-printers";

const REPLACEMENT_STATUS_LABEL: Record<string, string> = {
  PREDICTED: "Prevista",
  CONFIRMED: "Confirmada",
  PREMATURE: "Prematura",
  DISMISSED: "Descartada",
};

const SERVICE_ORDER_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  SCHEDULED: "Agendada",
  IN_PROGRESS: "Em atendimento",
  WAITING_PART: "Aguardando peça",
  WAITING_CUSTOMER: "Aguardando cliente",
  DONE: "Concluída",
  CANCELLED: "Cancelada",
};

export function TimelineTab({ printerId }: { printerId: string }) {
  const { data: items, isLoading } = usePrinterTimeline(printerId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!items || items.length === 0) {
    return (
      <Card>
        <EmptyState icon={Wrench} title="Nenhum evento ainda" description="Trocas de suprimento e ordens de serviço aparecem aqui conforme forem registradas." />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const isReplacement = item.type === "replacement";
        const Icon = isReplacement ? Droplet : Wrench;
        const statusLabel = isReplacement ? REPLACEMENT_STATUS_LABEL[item.status] : SERVICE_ORDER_STATUS_LABEL[item.status];
        return (
          <Card key={i}>
            <CardContent className="flex items-start gap-3 py-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  <Badge variant="outline">{statusLabel ?? item.status}</Badge>
                </div>
                {item.notes && <p className="mt-1 text-sm text-muted-foreground">{item.notes}</p>}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(item.date).toLocaleDateString("pt-BR")}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
