"use client";

import Link from "next/link";
import { useState } from "react";
import { Droplet, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useReplacements, useSupplyForecast } from "@/hooks/use-consumables";
import type { ConsumableReplacement, ConsumableReplacementStatus, SupplyForecastEntry } from "@/lib/types";

function urgencyVariant(daysRemaining: number): "destructive" | "secondary" | "outline" {
  if (daysRemaining <= 7) return "destructive";
  if (daysRemaining <= 15) return "secondary";
  return "outline";
}

const REPLACEMENT_STATUS_LABEL: Record<ConsumableReplacementStatus, string> = {
  PREDICTED: "Prevista",
  CONFIRMED: "Confirmada",
  PREMATURE: "Prematura",
  DISMISSED: "Descartada",
};

const REPLACEMENT_STATUS_VARIANT: Record<ConsumableReplacementStatus, "default" | "secondary" | "destructive" | "outline"> = {
  PREDICTED: "outline",
  CONFIRMED: "default",
  PREMATURE: "destructive",
  DISMISSED: "secondary",
};

export default function SuprimentosPage() {
  const { data: forecast, isLoading: loadingForecast } = useSupplyForecast();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const { data: replacements, isLoading: loadingReplacements } = useReplacements(statusFilter || undefined);

  const forecastColumns: DataTableColumn<SupplyForecastEntry>[] = [
    {
      key: "printer",
      header: "Impressora",
      cell: (e) => (
        <Link href={`/impressoras/${e.printer.id}`} className="hover:underline">
          {e.printer.model || e.printer.ip || e.printer.id}
        </Link>
      ),
      hideOnMobile: true,
    },
    { key: "customer", header: "Cliente", cell: (e) => e.customer?.legalName ?? "—" },
    { key: "supply", header: "Suprimento", cell: (e) => `${e.type}${e.color ? ` (${e.color})` : ""}` },
    { key: "level", header: "Nível atual", cell: (e) => `${e.currentLevelPercent}%` },
    {
      key: "predicted",
      header: "Previsão de troca",
      cell: (e) => new Date(e.predictedReplacementAt).toLocaleDateString("pt-BR"),
      hideOnMobile: true,
    },
    {
      key: "days",
      header: "Dias restantes",
      cell: (e) => <Badge variant={urgencyVariant(e.daysRemaining)}>{Math.max(0, Math.round(e.daysRemaining))} dias</Badge>,
    },
  ];

  const replacementColumns: DataTableColumn<ConsumableReplacement>[] = [
    {
      key: "printer",
      header: "Impressora",
      cell: (r) =>
        r.printer ? (
          <Link href={`/impressoras/${r.printer.id}`} className="hover:underline">
            {r.printer.model || r.printer.ip || r.printer.id}
          </Link>
        ) : (
          "—"
        ),
      hideOnMobile: true,
    },
    { key: "customer", header: "Cliente", cell: (r) => r.printer?.customer?.legalName ?? "—" },
    { key: "supply", header: "Suprimento", cell: (r) => `${r.type}${r.color ? ` (${r.color})` : ""}` },
    {
      key: "predictedAt",
      header: "Previsão",
      cell: (r) => (r.predictedAt ? new Date(r.predictedAt).toLocaleDateString("pt-BR") : "—"),
      hideOnMobile: true,
    },
    { key: "replacedAt", header: "Troca real", cell: (r) => (r.replacedAt ? new Date(r.replacedAt).toLocaleDateString("pt-BR") : "—") },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge variant={REPLACEMENT_STATUS_VARIANT[r.status]}>{REPLACEMENT_STATUS_LABEL[r.status]}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Suprimentos" />

      <Tabs defaultValue="previsoes">
        <TabsList>
          <TabsTrigger value="previsoes">Reposição Inteligente</TabsTrigger>
          <TabsTrigger value="trocas">Trocas</TabsTrigger>
        </TabsList>

        <TabsContent value="previsoes" className="mt-4">
          <ResponsiveDataTable
            columns={forecastColumns}
            data={forecast}
            keyField={(e) => `${e.printer.id}-${e.type}-${e.color ?? "default"}`}
            isLoading={loadingForecast}
            emptyIcon={Droplet}
            emptyTitle="Sem dados suficientes ainda para prever trocas"
            emptyDescription="Volte quando houver mais histórico de coleta."
            cardTitle={(e) => e.printer.model || e.printer.ip || e.printer.id}
            cardMeta={(e) => <Badge variant={urgencyVariant(e.daysRemaining)}>{Math.max(0, Math.round(e.daysRemaining))} dias</Badge>}
          />
        </TabsContent>

        <TabsContent value="trocas" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "")}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Todos os status">
                  {(v: ConsumableReplacementStatus | "") => (v ? REPLACEMENT_STATUS_LABEL[v] : "Todos os status")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PREDICTED">Previstas</SelectItem>
                <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
                <SelectItem value="PREMATURE">Prematuras</SelectItem>
                <SelectItem value="DISMISSED">Descartadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ResponsiveDataTable
            columns={replacementColumns}
            data={replacements}
            keyField={(r) => r.id}
            isLoading={loadingReplacements}
            emptyIcon={Wrench}
            emptyTitle="Nenhuma troca registrada ainda"
            cardTitle={(r) => (r.printer ? r.printer.model || r.printer.ip || r.printer.id : "—")}
            cardMeta={(r) => <Badge variant={REPLACEMENT_STATUS_VARIANT[r.status]}>{REPLACEMENT_STATUS_LABEL[r.status]}</Badge>}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
