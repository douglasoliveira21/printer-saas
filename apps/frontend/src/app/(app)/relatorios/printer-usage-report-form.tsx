"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomers } from "@/hooks/use-customers";
import { useContracts } from "@/hooks/use-contracts";
import { downloadReportPdf } from "@/hooks/use-reports";
import { getApiErrorMessage } from "@/lib/api-client";

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function PrinterUsageReportForm({ path, filename, title, description }: { path: string; filename: string; title: string; description: string }) {
  const [customerId, setCustomerId] = useState("");
  const [contractId, setContractId] = useState("");
  const [from, setFrom] = useState(() => dateStr(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [to, setTo] = useState(() => dateStr(new Date()));
  const [downloading, setDownloading] = useState(false);

  const { data: customers } = useCustomers();
  const { data: contracts } = useContracts({ status: "ACTIVE" });
  const customerContracts = (contracts?.data ?? []).filter((c) => c.customer?.id === customerId);

  async function handleGenerate() {
    if (!customerId) return;
    setDownloading(true);
    try {
      await downloadReportPdf(path, filename, { customerId, contractId: contractId || undefined, from, to });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar relatório"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 py-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v ?? ""); setContractId(""); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o cliente">
                    {(v: string) => (v ? customers?.data.find((c) => c.id === v)?.tradeName || customers?.data.find((c) => c.id === v)?.legalName || v : "Selecione o cliente")}
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
              <Label>Contrato</Label>
              <Select value={contractId} onValueChange={(v) => setContractId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Todos os contratos do cliente">
                    {(v: string) => (v ? `Contrato #${customerContracts.find((c) => c.id === v)?.number ?? v}` : "Todos os contratos do cliente")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {customerContracts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      Contrato #{c.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
            <Button onClick={handleGenerate} disabled={!customerId || downloading}>
              <Download className="mr-2 h-4 w-4" />
              {downloading ? "Gerando..." : "Gerar relatório (PDF)"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
