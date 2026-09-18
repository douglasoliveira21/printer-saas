"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useApproveServiceOrder, downloadServiceOrderPdf } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder } from "@/lib/types";
import { SignatureCanvas } from "./signature-canvas";

export function ApprovalSection({ order }: { order: ServiceOrder }) {
  const [approvalName, setApprovalName] = useState(order.approvalName ?? "");
  const [approvalNotes, setApprovalNotes] = useState(order.approvalNotes ?? "");
  const [signature, setSignature] = useState<string | null>(order.approvalSignature);
  const approve = useApproveServiceOrder();
  const [downloading, setDownloading] = useState(false);

  async function handleApprove() {
    if (!approvalName.trim() || !signature) {
      toast.error("Informe o nome e a assinatura para confirmar.");
      return;
    }
    try {
      await approve.mutateAsync({ serviceOrderId: order.id, approvalName: approvalName.trim(), approvalSignature: signature, approvalNotes });
      toast.success("Aprovação registrada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao registrar aprovação"));
    }
  }

  async function handleDownloadPdf() {
    setDownloading(true);
    try {
      await downloadServiceOrderPdf(order.id, `os-${order.number}.pdf`);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar PDF"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">7. Aprovação do cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {order.approvalAt && (
          <p className="text-sm text-muted-foreground">
            Aprovado por {order.approvalName} em {new Date(order.approvalAt).toLocaleString("pt-BR")}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="approvalName">Nome do responsável</Label>
          <Input id="approvalName" value={approvalName} onChange={(e) => setApprovalName(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Assinatura digital</Label>
          <SignatureCanvas onChange={setSignature} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="approvalNotes">Observação do cliente</Label>
          <Textarea id="approvalNotes" rows={2} value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} />
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={handleDownloadPdf} disabled={downloading}>
            <Download className="mr-2 h-4 w-4" />
            {downloading ? "Gerando..." : "Gerar PDF"}
          </Button>
          <Button onClick={handleApprove} disabled={approve.isPending}>
            Confirmar aprovação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
