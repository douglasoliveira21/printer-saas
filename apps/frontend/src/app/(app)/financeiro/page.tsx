"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinancialEntries, useFinancialSummary, useMarkEntryPaid } from "@/hooks/use-financial";
import { getApiErrorMessage } from "@/lib/api-client";
import type { FinancialEntry, FinancialEntryStatus } from "@/lib/types";
import { CreateEntryDialog } from "./create-entry-dialog";

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

  return (
    <Card className="overflow-hidden py-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead>{type === "RECEIVABLE" ? "Cliente" : "Descrição"}</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Vencimento</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-neutral-400">
                Carregando...
              </TableCell>
            </TableRow>
          )}
          {!isLoading && !data?.data.length && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-neutral-400">
                Nenhum lançamento cadastrado.
              </TableCell>
            </TableRow>
          )}
          {data?.data.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="font-medium">{entry.category}</TableCell>
              <TableCell>{entry.customer?.tradeName || entry.customer?.legalName || entry.description || "—"}</TableCell>
              <TableCell>{currency(entry.amount)}</TableCell>
              <TableCell>{new Date(entry.dueDate).toLocaleDateString("pt-BR")}</TableCell>
              <TableCell>
                <Badge variant={isOverdue(entry) ? "destructive" : STATUS_CONFIG[entry.status].variant}>
                  {isOverdue(entry) ? "Vencido" : STATUS_CONFIG[entry.status].label}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                {entry.status === "PENDING" && (
                  <Button size="sm" variant="outline" onClick={() => handleMarkPaid(entry.id)}>
                    Baixar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export default function FinanceiroPage() {
  const { data: summary, isLoading } = useFinancialSummary();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Financeiro</h1>
        <CreateEntryDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Receber hoje", key: "receivableToday" as const, tone: "text-emerald-600" },
          { label: "Vencido", key: "receivableOverdue" as const, tone: "text-red-600" },
          { label: "A vencer", key: "receivableUpcoming" as const, tone: "text-neutral-700" },
          { label: "Pagar", key: "payablePending" as const, tone: "text-amber-600" },
          { label: "Saldo previsto", key: "projectedBalance" as const, tone: "text-blue-600" },
        ].map((card) => (
          <Card key={card.key}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-neutral-500">{card.label}</CardTitle>
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
