"use client";

import { useState } from "react";
import { Printer, Users, Droplet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { PieStatCard } from "@/components/shared/pie-stat-card";
import { UsageBarChart } from "@/components/shared/usage-bar-chart";
import { useDashboardSummary, usePageUsage, useTopCustomersByUsage } from "@/hooks/use-dashboard";
import { useCustomers } from "@/hooks/use-customers";

const AUTO_REFRESH_INTERVAL_MS = 30_000;

function StatCard({ title, icon: Icon, value, isLoading }: { title: string; icon: React.ElementType; value: number | undefined; isLoading?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>{isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{value ?? 0}</div>}</CardContent>
    </Card>
  );
}

export default function PainelPage() {
  const [customerId, setCustomerId] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const refetchInterval = autoRefresh ? AUTO_REFRESH_INTERVAL_MS : undefined;

  const { data: customers } = useCustomers();
  const { data: summary, isLoading: loadingSummary } = useDashboardSummary(customerId || undefined, refetchInterval);
  const { data: monthlyUsage, isLoading: loadingMonthly } = usePageUsage("month", customerId || undefined, refetchInterval);
  const { data: dailyUsage, isLoading: loadingDaily } = usePageUsage("day", customerId || undefined, refetchInterval);
  const { data: topCustomers, isLoading: loadingTopCustomers } = useTopCustomersByUsage(customerId || undefined, refetchInterval);

  return (
    <div className="space-y-6">
      <PageHeader title="Painel" description="Visão geral do seu parque de impressoras." />

      <div className="flex flex-wrap items-center gap-4">
        <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Todos os clientes">
              {(v: string) => (v ? customers?.data.find((c) => c.id === v)?.tradeName || customers?.data.find((c) => c.id === v)?.legalName || v : "Todos os clientes")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os clientes</SelectItem>
            {customers?.data.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.tradeName || c.legalName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Checkbox id="auto-refresh" checked={autoRefresh} onCheckedChange={(checked) => setAutoRefresh(checked === true)} />
          <Label htmlFor="auto-refresh" className="cursor-pointer text-sm font-normal text-muted-foreground">
            Atualizar automaticamente
          </Label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard title="Total de clientes" icon={Users} value={summary?.customers.total} isLoading={loadingSummary} />
        <StatCard title="Total de impressoras" icon={Printer} value={summary?.printers.total} isLoading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PieStatCard
          title="Origem das impressoras"
          isLoading={loadingSummary}
          slices={[
            { label: "Nos clientes", value: summary?.printers.origin.clientes ?? 0 },
            { label: "Na sua empresa", value: summary?.printers.origin.empresa ?? 0 },
            { label: "Novas", value: summary?.printers.origin.novas ?? 0 },
          ]}
        />
        <PieStatCard
          title="Status de comunicação"
          isLoading={loadingSummary}
          slices={[
            { label: "Comunicação OK", value: summary?.printers.communication.ok ?? 0 },
            { label: "Falha de comunicação", value: summary?.printers.communication.falha ?? 0 },
            { label: "Contador manual", value: summary?.printers.communication.manual ?? 0 },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PieStatCard
          title="Alertas ativos"
          isLoading={loadingSummary}
          total={summary?.alerts.total}
          slices={[
            { label: "Alto", value: summary?.alerts.alto ?? 0 },
            { label: "Médio", value: summary?.alerts.medio ?? 0 },
          ]}
        />
        <PieStatCard
          title="Chamados"
          isLoading={loadingSummary}
          total={summary?.serviceOrders.total}
          slices={[
            { label: "Pendente", value: summary?.serviceOrders.pendente ?? 0 },
            { label: "Em andamento", value: summary?.serviceOrders.andamento ?? 0 },
            { label: "Finalizado", value: summary?.serviceOrders.finalizado ?? 0 },
          ]}
        />
        <StatCard title="Trocas de suprimento pendentes" icon={Droplet} value={summary?.replacementsPending} isLoading={loadingSummary} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <UsageBarChart title="Total de páginas por mês (últimos 6 meses)" data={monthlyUsage} isLoading={loadingMonthly} />
        <UsageBarChart title="Total de páginas por dia (últimos 30 dias)" data={dailyUsage} isLoading={loadingDaily} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PieStatCard
          title="Clientes que mais imprimiram (últimos 30 dias)"
          isLoading={loadingTopCustomers}
          slices={(topCustomers ?? []).map((c) => ({ label: c.name, value: c.pages }))}
        />
      </div>
    </div>
  );
}
