"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadServiceOrderPdf } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder } from "@/lib/types";

export function PdfSection({ order }: { order: ServiceOrder }) {
  const [downloading, setDownloading] = useState(false);
  const [showBlankLines, setShowBlankLines] = useState(false);

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadServiceOrderPdf(order.id, `os-${order.number}.pdf`, showBlankLines);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar PDF"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Impressão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={showBlankLines} onCheckedChange={(v) => setShowBlankLines(v === true)} />
          Exibir linhas adicionais em branco nos itens do chamado
        </label>

        <div className="flex justify-end">
          <Button onClick={handleDownloadPdf} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Gerando..." : "Gerar PDF"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
