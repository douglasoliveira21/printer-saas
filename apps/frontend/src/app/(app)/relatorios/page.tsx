"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ReportCard } from "./report-card";

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function RelatoriosPage() {
  const [from, setFrom] = useState(() => dateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => dateStr(new Date()));

  const range = { from, to };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <div className="flex items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="from" className="text-xs">
              De
            </Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to" className="text-xs">
              Até
            </Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ReportCard
          title="Impressões por equipamento"
          path="printers-usage"
          filename="impressoes-por-equipamento"
          params={range}
          columns={[
            { key: "customer", header: "Cliente" },
            { key: "model", header: "Modelo" },
            { key: "totalPages", header: "Total" },
            { key: "colorPages", header: "Colorido" },
          ]}
        />

        <ReportCard
          title="Ordens de serviço"
          path="service-orders"
          filename="ordens-de-servico"
          params={range}
          columns={[
            { key: "number", header: "Número" },
            { key: "customer", header: "Cliente" },
            { key: "status", header: "Status" },
            { key: "late", header: "Atrasada", format: (v) => (v ? "Sim" : "Não") },
          ]}
        />

        <ReportCard
          title="Financeiro"
          path="financial"
          filename="financeiro"
          params={range}
          columns={[
            { key: "type", header: "Tipo" },
            { key: "customer", header: "Cliente" },
            { key: "amount", header: "Valor", format: (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) },
            { key: "status", header: "Status" },
          ]}
        />

        <ReportCard
          title="Impressoras offline"
          path="printers-offline"
          filename="impressoras-offline"
          columns={[
            { key: "customer", header: "Cliente" },
            { key: "model", header: "Modelo" },
            { key: "ip", header: "IP" },
            { key: "lastSeenAt", header: "Visto por último", format: (v) => (v ? new Date(v as string).toLocaleString("pt-BR") : "Nunca") },
          ]}
        />

        <ReportCard
          title="Contratos vencendo (30 dias)"
          path="contracts-expiring"
          filename="contratos-vencendo"
          columns={[
            { key: "number", header: "Contrato" },
            { key: "customer", header: "Cliente" },
            { key: "endDate", header: "Vencimento", format: (v) => new Date(v as string).toLocaleDateString("pt-BR") },
          ]}
        />
      </div>
    </div>
  );
}
