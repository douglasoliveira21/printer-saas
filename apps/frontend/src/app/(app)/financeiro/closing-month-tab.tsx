"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Download, FileStack, Lock, LockOpen, Printer, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { useCustomers } from "@/hooks/use-customers";
import {
  downloadClosingPdf,
  useClosings,
  useFreezeClosing,
  useGenerateClosing,
  useUnfreezeClosing,
  useUpdateClosingDocumentNumber,
} from "@/hooks/use-closings";
import { useClosingSettings } from "@/hooks/use-tenant-settings";
import { getApiErrorMessage } from "@/lib/api-client";

const PAGE_COST_MODE_LABEL: Record<string, string> = {
  TIERED: "Faixas de páginas",
  FRANCHISE: "Franquia + excedente",
  FLAT: "Custo por página",
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function currency(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ClosingMonthTab() {
  const now = new Date();
  const [customerId, setCustomerId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: customers } = useCustomers();
  const { data: closings, isLoading } = useClosings(customerId || undefined, year);
  const generateClosing = useGenerateClosing();
  const freezeClosing = useFreezeClosing();
  const unfreezeClosing = useUnfreezeClosing();
  const updateDocumentNumber = useUpdateClosingDocumentNumber();
  const { data: closingSettings } = useClosingSettings();
  const [documentNumber, setDocumentNumber] = useState("");

  const closing = closings?.find((c) => c.referenceMonth === month && c.referenceYear === year);
  const customerName = closing?.customer?.tradeName || closing?.customer?.legalName;

  useEffect(() => {
    setDocumentNumber(closing?.documentNumber ?? "");
  }, [closing?.id, closing?.documentNumber]);

  async function handleSaveDocumentNumber() {
    if (!closing) return;
    try {
      await updateDocumentNumber.mutateAsync({ id: closing.id, customerId: closing.customerId, documentNumber: documentNumber || null });
      toast.success("Número do documento salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar número do documento"));
    }
  }

  async function handleGenerate() {
    if (!customerId) return;
    try {
      await generateClosing.mutateAsync({ customerId, year, month });
      toast.success("Fechamento gerado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar fechamento"));
    }
  }

  async function handleFreeze() {
    if (!closing) return;
    try {
      await freezeClosing.mutateAsync({ id: closing.id, customerId: closing.customerId });
      toast.success("Fechamento congelado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao congelar fechamento"));
    }
  }

  async function handleUnfreeze() {
    if (!closing) return;
    try {
      await unfreezeClosing.mutateAsync({ id: closing.id, customerId: closing.customerId });
      toast.success("Fechamento descongelado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao descongelar fechamento"));
    }
  }

  async function handleExportPdf() {
    if (!closing) return;
    try {
      await downloadClosingPdf(closing.id, `fechamento-${customerName}-${month}-${year}.pdf`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao exportar PDF"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
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
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v ?? month))}>
          <SelectTrigger className="w-40">
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
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v ?? year))}>
          <SelectTrigger className="w-28">
            <SelectValue>{() => String(year)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={handleGenerate} disabled={!customerId || generateClosing.isPending || closing?.status === "FROZEN"}>
          <RefreshCw className="mr-2 h-4 w-4" />
          {generateClosing.isPending ? "Gerando..." : closing ? "Atualizar fechamento" : "Gerar fechamento"}
        </Button>
      </div>

      {!customerId && (
        <Card>
          <EmptyState icon={FileStack} title="Selecione um cliente" description="Escolha um cliente e o período para gerar o fechamento mensal." />
        </Card>
      )}

      {customerId && !isLoading && !closing && (
        <Card>
          <EmptyState icon={FileStack} title="Nenhum fechamento gerado para este período" description="Clique em “Gerar fechamento” para calcular." />
        </Card>
      )}

      {closing && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Gerado em {new Date(closing.generatedAt).toLocaleString("pt-BR")}</span>
              <Badge variant={closing.status === "FROZEN" ? "default" : "secondary"}>
                {closing.status === "FROZEN" ? "Congelado" : "Pendente"}
              </Badge>
              {closingSettings?.allowEditingClosingDocumentNumber && (
                <div className="flex items-center gap-1">
                  <span>Documento nº</span>
                  <Input
                    className="h-7 w-28"
                    value={documentNumber}
                    onChange={(e) => setDocumentNumber(e.target.value)}
                    onBlur={() => documentNumber !== (closing.documentNumber ?? "") && handleSaveDocumentNumber()}
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {closing.status === "FROZEN" ? (
                <Button variant="outline" size="sm" onClick={handleUnfreeze} disabled={unfreezeClosing.isPending}>
                  <LockOpen className="mr-2 h-4 w-4" />
                  Descongelar
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleFreeze} disabled={freezeClosing.isPending}>
                  <Lock className="mr-2 h-4 w-4" />
                  Congelar
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          </div>

          <div className="hidden print:block">
            <h2 className="text-lg font-semibold">
              Fechamento — {customerName} — {MONTH_NAMES[month - 1]}/{year}
            </h2>
          </div>

          {closing.details.map((contractLine) => (
            <Card key={contractLine.contractId} className="overflow-hidden py-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <span className="font-medium">
                  Contrato #{contractLine.contractNumber} — Mensalidade {currency(contractLine.monthlyFee)}
                </span>
                <span className="font-semibold">{currency(contractLine.contractTotal)}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Impressora</TableHead>
                    <TableHead>P&B</TableHead>
                    <TableHead>Colorida</TableHead>
                    <TableHead>Digitalização</TableHead>
                    <TableHead>Custo fixo</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractLine.printers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Nenhuma impressora vinculada
                      </TableCell>
                    </TableRow>
                  )}
                  {contractLine.printers.map((p) => (
                    <TableRow key={p.printerId}>
                      <TableCell>{p.printerModel ?? p.printerId}</TableCell>
                      <TableCell>{p.pagesBw ?? "—"} × {currency(p.priceBw)}</TableCell>
                      <TableCell>{p.pagesColor ?? "—"} × {currency(p.priceColor)}</TableCell>
                      <TableCell>{p.pagesScan ?? "—"} × {currency(p.priceScan)}</TableCell>
                      <TableCell>{currency(p.fixedCost)}</TableCell>
                      <TableCell className="font-medium">{currency(p.lineTotal)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      Custo de páginas ({PAGE_COST_MODE_LABEL[contractLine.pageCost.mode]})
                    </TableCell>
                    <TableCell className="font-medium">{currency(contractLine.pageCost.amount)}</TableCell>
                  </TableRow>
                  {contractLine.fixedCosts.map((fc, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5} className="text-muted-foreground">
                        Custo adicional — {fc.label}
                      </TableCell>
                      <TableCell className="font-medium">{currency(fc.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {contractLine.notes && (
                <div className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Observação: </span>
                  {contractLine.notes}
                </div>
              )}
            </Card>
          ))}

          <Card>
            <CardContent className="flex items-center justify-between py-4">
              <span className="text-sm font-medium text-muted-foreground">Total do fechamento</span>
              <span className="text-2xl font-bold">{currency(closing.totalAmount)}</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
