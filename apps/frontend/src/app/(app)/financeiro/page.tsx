"use client";

import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useFinancialEntries, useFinancialSummary, useMarkEntryPaid } from "@/hooks/use-financial";
import { getApiErrorMessage } from "@/lib/api-client";
import type { FinancialEntry, FinancialEntryStatus } from "@/lib/types";
import { CreateEntryDialog } from "./create-entry-dialog";
import { EntryActionsMenu } from "./entry-actions-menu";

function currency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STATUS_CONFIG: Record<FinancialEntryStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  PENDING: { label: "Pendente", variant: "secondary" },
  PAID: { label: "Pago", variant: "default" },
  OVERDUE: { label: "Vencido", variant: "destructive" },
  CANCELLED: { label: "Cancelado", variant: "outline" },
};

function isOverdue(entry: FinancialEntry) {
  return entry.status === "PENDING" && new Date(entry.dueDate) < new Date();
}

function EntriesTable({ type }: { type: "RECEIVABLE" | "PAYABLE" }) {
  const { data, isLoading } = useFinancialEntries({ type });
  const markPaid = useMarkEntryPaid();

  async function handleMarkPaid(id: string) {
    try {
      await markPaid.mutateAsync(id);
      toast.success("Lançamento baixado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao baixar lançamento"));
    }
  }

  function renderActions(entry: FinancialEntry) {
    return (
      <>
        {entry.status === "PENDING" && (
          <Button size="sm" variant="outline" onClick={() => handleMarkPaid(entry.id)}>
            Baixar
          </Button>
        )}
        <EntryActionsMenu entry={entry} />
      </>
    );
  }

  const columns: DataTableColumn<FinancialEntry>[] = [
    { key: "category", header: "Categoria", cell: (e) => e.category, hideOnMobile: true },
    {
      key: "who",
      header: type === "RECEIVABLE" ? "Cliente" : "Descrição",
      cell: (e) => e.customer?.tradeName || e.customer?.legalName || e.description || "—",
    },
    { key: "amount", header: "Valor", cell: (e) => currency(e.amount) },
    { key: "dueDate", header: "Vencimento", cell: (e) => new Date(e.dueDate).toLocaleDateString("pt-BR") },
    {
      key: "status",
      header: "Status",
      cell: (e) => (
        <Badge variant={isOverdue(e) ? "destructive" : STATUS_CONFIG[e.status].variant}>
          {isOverdue(e) ? "Vencido" : STATUS_CONFIG[e.status].label}
        </Badge>
      ),
      hideOnMobile: true,
    },
    { key: "actions", header: "", cell: (e) => <div className="flex justify-end gap-2">{renderActions(e)}</div>, className: "text-right" },
  ];

  return (
    <ResponsiveDataTable
      columns={columns}
      data={data?.data}
      keyField={(e) => e.id}
      isLoading={isLoading}
      emptyIcon={Wallet}
      emptyTitle="Nenhum lançamento cadastrado"
      cardTitle={(e) => e.category}
      cardMeta={(e) => (
        <Badge variant={isOverdue(e) ? "destructive" : STATUS_CONFIG[e.status].variant}>
          {isOverdue(e) ? "Vencido" : STATUS_CONFIG[e.status].label}
        </Badge>
      )}
      cardActions={renderActions}
    />
  );
}

export default function FinanceiroPage() {
  const { data: summary, isLoading } = useFinancialSummary();

  return (
    <div className="space-y-6">
      <PageHeader title="Financeiro" actions={<CreateEntryDialog />} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Receber hoje", key: "receivableToday" as const, tone: "text-emerald-600" },
          { label: "Vencido", key: "receivableOverdue" as const, tone: "text-destructive" },
          { label: "A vencer", key: "receivableUpcoming" as const, tone: "text-foreground" },
          { label: "Pagar", key: "payablePending" as const, tone: "text-amber-600" },
          { label: "Saldo previsto", key: "projectedBalance" as const, tone: "text-primary" },
        ].map((card) => (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading || !summary ? (
                <Skeleton className="h-7 w-24" />
              ) : (
                <span className={`text-xl font-bold ${card.tone}`}>{currency(summary[card.key])}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="receber">
        <TabsList>
          <TabsTrigger value="receber">Contas a receber</TabsTrigger>
          <TabsTrigger value="pagar">Contas a pagar</TabsTrigger>
        </TabsList>
        <TabsContent value="receber" className="mt-4">
          <EntriesTable type="RECEIVABLE" />
        </TabsContent>
        <TabsContent value="pagar" className="mt-4">
          <EntriesTable type="PAYABLE" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
