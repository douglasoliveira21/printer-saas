"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { useApplyContractReadjustment, useContractReadjustments, useCreateContractReadjustment } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ContractReadjustmentStatus } from "@/lib/types";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_CONFIG: Record<ContractReadjustmentStatus, { label: string; variant: "default" | "secondary" | "outline" }> = {
  SCHEDULED: { label: "Agendado", variant: "outline" },
  APPLIED: { label: "Aplicado", variant: "default" },
  CANCELLED: { label: "Cancelado", variant: "secondary" },
};

function currency(value: string | number | null) {
  return value === null ? "—" : Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ReadjustmentsTab({ contractId }: { contractId: string }) {
  const now = new Date();
  const { data: readjustments, isLoading } = useContractReadjustments(contractId);
  const createReadjustment = useCreateContractReadjustment();
  const applyReadjustment = useApplyContractReadjustment();

  const [percentage, setPercentage] = useState("");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [applyPercentage, setApplyPercentage] = useState("");

  async function handleSchedule(event: FormEvent) {
    event.preventDefault();
    if (!percentage) return;
    try {
      await createReadjustment.mutateAsync({ contractId, percentage: Number(percentage), effectiveMonth: month, effectiveYear: year, applyNow: false });
      toast.success("Reajuste agendado");
      setPercentage("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao agendar reajuste"));
    }
  }

  async function handleApplyNow(event: FormEvent) {
    event.preventDefault();
    if (!applyPercentage) return;
    try {
      await createReadjustment.mutateAsync({
        contractId,
        percentage: Number(applyPercentage),
        effectiveMonth: now.getMonth() + 1,
        effectiveYear: now.getFullYear(),
        applyNow: true,
      });
      toast.success("Reajuste aplicado");
      setApplyPercentage("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao aplicar reajuste"));
    }
  }

  async function handleApplyScheduled(readjustmentId: string) {
    try {
      await applyReadjustment.mutateAsync({ contractId, readjustmentId });
      toast.success("Reajuste aplicado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao aplicar reajuste"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agendar reajuste</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSchedule} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Mês inicial</Label>
                  <Select value={String(month)} onValueChange={(v) => setMonth(Number(v ?? month))}>
                    <SelectTrigger className="w-full">
                      <SelectValue>{() => MONTH_NAMES[month - 1]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, i) => (
                        <SelectItem key={name} value={String(i + 1)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Ano</Label>
                  <Input id="year" type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="percentage">Porcentagem de reajuste (%)</Label>
                <Input id="percentage" type="number" step="0.01" value={percentage} onChange={(e) => setPercentage(e.target.value)} />
              </div>
              <Button type="submit" disabled={!percentage || createReadjustment.isPending}>
                Agendar reajuste
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aplicar reajuste agora</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleApplyNow} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="applyPercentage">Porcentagem (%)</Label>
                <Input id="applyPercentage" type="number" step="0.01" value={applyPercentage} onChange={(e) => setApplyPercentage(e.target.value)} />
              </div>
              <Button type="submit" variant="outline" disabled={!applyPercentage || createReadjustment.isPending}>
                <TrendingUp className="mr-2 h-4 w-4" />
                Aplicar agora
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">Histórico de reajustes</h3>
        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && !readjustments?.length && (
          <Card>
            <EmptyState icon={TrendingUp} title="Nenhum reajuste registrado ainda" />
          </Card>
        )}
        {!!readjustments?.length && (
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Período</TableHead>
                  <TableHead>Porcentagem</TableHead>
                  <TableHead>Mensalidade antes</TableHead>
                  <TableHead>Mensalidade depois</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {readjustments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {MONTH_NAMES[r.effectiveMonth - 1]}/{r.effectiveYear}
                    </TableCell>
                    <TableCell>{Number(r.percentage).toFixed(2)}%</TableCell>
                    <TableCell>{currency(r.previousMonthlyFee)}</TableCell>
                    <TableCell>{currency(r.newMonthlyFee)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[r.status].variant}>{STATUS_CONFIG[r.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === "SCHEDULED" && (
                        <Button size="sm" variant="outline" onClick={() => handleApplyScheduled(r.id)} disabled={applyReadjustment.isPending}>
                          Aplicar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
