"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { downloadReportPdf } from "@/hooks/use-reports";
import { getApiErrorMessage } from "@/lib/api-client";

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function TotaisPorClienteReportPage() {
  const [from, setFrom] = useState(() => dateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => dateStr(new Date()));
  const [downloading, setDownloading] = useState(false);

  async function handleGenerate() {
    setDownloading(true);
    try {
      await downloadReportPdf("totals-by-customer", "totais-por-cliente", { from, to });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar relatório"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Totais por cliente</h1>
        <p className="text-sm text-muted-foreground">Preencha o período — gera um PDF com o total de páginas de todos os clientes.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from">De</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to">Até</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleGenerate} disabled={downloading}>
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Gerando..." : "Gerar relatório (PDF)"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
