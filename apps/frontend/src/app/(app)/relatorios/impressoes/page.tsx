"use client";

import { PrinterUsageReportForm } from "../printer-usage-report-form";

export default function ImpressoesReportPage() {
  return (
    <PrinterUsageReportForm
      path="printers-usage"
      filename="impressoes-e-copias-por-impressora"
      title="Impressões e cópias por impressora"
      description="Selecione o cliente, opcionalmente um contrato, e o período — gera um PDF com o total de páginas de cada impressora."
    />
  );
}
