"use client";

import { PrinterUsageReportForm } from "../printer-usage-report-form";

export default function DigitalizacoesReportPage() {
  return (
    <PrinterUsageReportForm
      path="scans-usage"
      filename="digitalizacoes-por-impressora"
      title="Digitalizações por impressora"
      description="Selecione o cliente, opcionalmente um contrato, e o período — gera um PDF com o total de digitalizações de cada impressora."
    />
  );
}
