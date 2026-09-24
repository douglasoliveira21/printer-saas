"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomers } from "@/hooks/use-customers";
import { downloadReportPdf } from "@/hooks/use-reports";
import { getApiErrorMessage } from "@/lib/api-client";
import { SERVICE_ORDER_REPORT_COLUMNS } from "./report-columns";

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

const DEFAULT_SELECTED = new Set(
  SERVICE_ORDER_REPORT_COLUMNS.flatMap((g) => g.columns).filter((c) => c.wired).map((c) => c.key),
);

export default function ChamadosReportPage() {
  const [customerId, setCustomerId] = useState("");
  const [from, setFrom] = useState(() => dateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => dateStr(new Date()));
  const [selected, setSelected] = useState<Set<string>>(DEFAULT_SELECTED);
  const [downloading, setDownloading] = useState(false);

  const { data: customers } = useCustomers();

  function toggleColumn(key: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function toggleGroup(group: (typeof SERVICE_ORDER_REPORT_COLUMNS)[number], checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const col of group.columns) {
        if (checked) next.add(col.key);
        else next.delete(col.key);
      }
      return next;
    });
  }

  async function handleGenerate() {
    setDownloading(true);
    try {
      await downloadReportPdf("service-orders-detailed", "relatorio-de-chamados", {
        from,
        to,
        customerId: customerId || undefined,
        columns: Array.from(selected).join(","),
      });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar relatório"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Relatório de chamados</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o período, opcionalmente um cliente, e marque as colunas que quer no relatório.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos os clientes">
                    {(v: string) => (v ? customers?.data.find((c) => c.id === v)?.tradeName || customers?.data.find((c) => c.id === v)?.legalName || v : "Todos os clientes")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customers?.data.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName || c.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="from">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {SERVICE_ORDER_REPORT_COLUMNS.map((group) => {
        const allChecked = group.columns.every((c) => selected.has(c.key));
        return (
          <Card key={group.group}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">{group.group}</CardTitle>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={allChecked} onCheckedChange={(v) => toggleGroup(group, v === true)} />
                Marcar/Desmarcar todos
              </label>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 pb-4">
              {group.columns.map((col) => (
                <label key={col.key} className="flex items-center gap-2 text-sm" title={col.wired ? undefined : "Sem dado registrado ainda — aparece como “Não disponível”"}>
                  <Checkbox checked={selected.has(col.key)} onCheckedChange={(v) => toggleColumn(col.key, v === true)} />
                  {col.label}
                  {!col.wired && <span className="text-xs text-muted-foreground">(sem dado)</span>}
                </label>
              ))}
            </CardContent>
          </Card>
        );
      })}

      <div className="flex justify-end">
        <Button onClick={handleGenerate} disabled={selected.size === 0 || downloading}>
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "Gerando..." : "Gerar relatório (PDF)"}
        </Button>
      </div>
    </div>
  );
}
