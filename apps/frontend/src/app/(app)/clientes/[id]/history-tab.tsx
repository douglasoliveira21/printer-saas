"use client";

import { FileText, Receipt, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useCustomerHistory } from "@/hooks/use-customers";
import type { CustomerHistoryItemType } from "@/lib/types";

const ICON: Record<CustomerHistoryItemType, typeof Wrench> = {
  service_order: Wrench,
  contract: FileText,
  monthly_closing: Receipt,
};

const SERVICE_ORDER_STATUS_LABEL: Record<string, string> = {
  OPEN: "Aberta",
  SCHEDULED: "Aguardando atendimento",
  IN_PROGRESS: "Em atendimento",
  WAITING_PART: "Aguardando peça",
  WAITING_CUSTOMER: "Aguardando cliente",
  DONE: "Resolvida",
  CANCELLED: "Cancelada",
};

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  ENDED: "Encerrado",
  EXPIRED: "Vencido",
};

function statusLabel(type: CustomerHistoryItemType, status: string | null) {
  if (!status) return null;
  if (type === "service_order") return SERVICE_ORDER_STATUS_LABEL[status] ?? status;
  if (type === "contract") return CONTRACT_STATUS_LABEL[status] ?? status;
  return status;
}

export function HistoryTab({ customerId }: { customerId: string }) {
  const { data: items, isLoading } = useCustomerHistory(customerId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (!items || items.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Wrench}
          title="Nenhum evento ainda"
          description="Ordens de serviço, contratos e fechamentos mensais deste cliente aparecem aqui conforme forem registrados."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, i) => {
        const Icon = ICON[item.type];
        const label = statusLabel(item.type, item.status);
        return (
          <Card key={i}>
            <CardContent className="flex items-start gap-3 py-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.label}</span>
                  {label && <Badge variant="outline">{label}</Badge>}
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
