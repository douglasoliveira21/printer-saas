"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { useCustomers } from "@/hooks/use-customers";
import { useClosings } from "@/hooks/use-closings";
import { CHART_COLORS } from "@/lib/chart-colors";
import { BarChart3 } from "lucide-react";

const MONTH_ABBR = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function ClosingHistoryTab() {
  const [customerId, setCustomerId] = useState("");
  const { data: customers } = useCustomers();
  const { data: closings, isLoading } = useClosings(customerId || undefined);

  const chartData = (closings ?? [])
    .slice()
    .reverse()
    .slice(-12)
    .map((c) => ({ period: `${MONTH_ABBR[c.referenceMonth - 1]}/${String(c.referenceYear).slice(2)}`, total: Number(c.totalAmount) }));

  return (
    <div className="space-y-4">
      <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
        <SelectTrigger className="w-full sm:w-64">
          <SelectValue placeholder="Selecione o cliente" />
        </SelectTrigger>
        <SelectContent>
          {customers?.data.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.tradeName || c.legalName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {!customerId && (
        <Card>
          <EmptyState icon={BarChart3} title="Selecione um cliente" description="Veja o histórico de fechamentos mensais em gráfico." />
        </Card>
      )}

      {customerId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de fechamentos por mês</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum fechamento gerado ainda para este cliente.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ left: -20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="period" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} />
                    <Bar dataKey="total" name="Total" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
