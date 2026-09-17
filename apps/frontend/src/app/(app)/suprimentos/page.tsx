"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReplacements, useSupplyForecast } from "@/hooks/use-consumables";
import type { ConsumableReplacementStatus } from "@/lib/types";

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Suprimentos</h1>

      <Tabs defaultValue="previsoes">
        <TabsList>
          <TabsTrigger value="previsoes">Reposição Inteligente</TabsTrigger>
          <TabsTrigger value="trocas">Trocas</TabsTrigger>
        </TabsList>

        <TabsContent value="previsoes" className="mt-4">
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Impressora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Suprimento</TableHead>
                  <TableHead>Nível atual</TableHead>
                  <TableHead>Previsão de troca</TableHead>
                  <TableHead>Dias restantes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingForecast && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-neutral-400">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!loadingForecast && !forecast?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-neutral-400">
                      Sem dados suficientes ainda para prever trocas. Volte quando houver mais histórico de coleta.
                    </TableCell>
                  </TableRow>
                )}
                {forecast?.map((entry, i) => (
                  <TableRow key={`${entry.printer.id}-${entry.type}-${entry.color ?? "default"}-${i}`}>
                    <TableCell>
                      <Link href={`/impressoras/${entry.printer.id}`} className="text-neutral-900 hover:underline dark:text-neutral-100">
                        {entry.printer.model || entry.printer.ip || entry.printer.id}
                      </Link>
                    </TableCell>
                    <TableCell>{entry.customer?.legalName ?? "—"}</TableCell>
                    <TableCell>
                      {entry.type}
                      {entry.color ? ` (${entry.color})` : ""}
                    </TableCell>
                    <TableCell>{entry.currentLevelPercent}%</TableCell>
                    <TableCell>{new Date(entry.predictedReplacementAt).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      <Badge variant={urgencyVariant(entry.daysRemaining)}>{Math.max(0, Math.round(entry.daysRemaining))} dias</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="trocas" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "")}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PREDICTED">Previstas</SelectItem>
                <SelectItem value="CONFIRMED">Confirmadas</SelectItem>
                <SelectItem value="PREMATURE">Prematuras</SelectItem>
                <SelectItem value="DISMISSED">Descartadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card className="overflow-hidden py-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Impressora</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Suprimento</TableHead>
                  <TableHead>Previsão</TableHead>
                  <TableHead>Troca real</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingReplacements && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-neutral-400">
                      Carregando...
                    </TableCell>
                  </TableRow>
                )}
                {!loadingReplacements && !replacements?.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-neutral-400">
                      Nenhuma troca registrada ainda.
                    </TableCell>
                  </TableRow>
                )}
                {replacements?.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      {r.printer ? (
                        <Link href={`/impressoras/${r.printer.id}`} className="text-neutral-900 hover:underline dark:text-neutral-100">
                          {r.printer.model || r.printer.ip || r.printer.id}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>{r.printer?.customer?.legalName ?? "—"}</TableCell>
                    <TableCell>
                      {r.type}
                      {r.color ? ` (${r.color})` : ""}
                    </TableCell>
                    <TableCell>{r.predictedAt ? new Date(r.predictedAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>{r.replacedAt ? new Date(r.replacedAt).toLocaleDateString("pt-BR") : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={REPLACEMENT_STATUS_VARIANT[r.status]}>{REPLACEMENT_STATUS_LABEL[r.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
