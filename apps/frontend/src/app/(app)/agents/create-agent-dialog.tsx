"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Download, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { useCreateAgentEnrollment, type CreateAgentEnrollmentResult } from "@/hooks/use-agents";
import { getApiErrorMessage } from "@/lib/api-client";

// Precisa ficar em sincronia com WindowsServiceInstaller.DefaultApiUrl
// (apps/agent-windows/src/PrinterAgent.ConfigTool/WindowsServiceInstaller.cs) —
// é o mesmo endpoint fixo que o instalador do Agent já usa por padrão.
const AGENT_DEFAULT_API_URL = "https://api.print.vgon.com.br";

export function CreateAgentDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [result, setResult] = useState<CreateAgentEnrollmentResult | null>(null);

  const { data: customers } = useCustomers();
  const { data: customer } = useCustomer(customerId || undefined);
  const createEnrollment = useCreateAgentEnrollment();

  function resetAndClose() {
    setName("");
    setCustomerId("");
    setLocationId("");
    setResult(null);
    setOpen(false);
  }

  async function handleSubmit() {
    try {
      const data = await createEnrollment.mutateAsync({ name, customerId: customerId || undefined, locationId: locationId || undefined });
      setResult(data);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar token"));
    }
  }

  function copyToken() {
    if (!result) return;
    navigator.clipboard.writeText(result.enrollmentToken);
    toast.success("Token copiado");
  }

  function downloadInstallSeed() {
    if (!result) return;
    const seed = {
      apiUrl: AGENT_DEFAULT_API_URL,
      enrollmentToken: result.enrollmentToken,
      agentName: name,
      customerName: customer?.tradeName || customer?.legalName || undefined,
    };
    const blob = new Blob([JSON.stringify(seed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "install-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetAndClose();
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar Agent
      </DialogTrigger>
      <DialogContent>
        {!result ? (
          <>
            <DialogHeader>
              <DialogTitle>Novo Agent</DialogTitle>
              <DialogDescription>Gera um token de instalação de uso único (válido por 24h).</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Agent *</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Agent Matriz" />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={customerId} onValueChange={(v) => { setCustomerId(v ?? ""); setLocationId(""); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione (opcional)" />
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
              {customer && customer.locations.length > 0 && (
                <div className="space-y-2">
                  <Label>Local</Label>
                  <Select value={locationId} onValueChange={(v) => setLocationId(v ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione o local" />
                    </SelectTrigger>
                    <SelectContent>
                      {customer.locations.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit} disabled={!name || createEnrollment.isPending}>
                {createEnrollment.isPending ? "Gerando..." : "Gerar token"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Instale o Agent</DialogTitle>
              <DialogDescription>Use este token durante a instalação/configuração do Agent Windows.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <div className="flex items-center gap-2 rounded-md border bg-neutral-50 p-3 font-mono text-sm dark:bg-neutral-900">
                <span className="flex-1 break-all">{result.enrollmentToken}</span>
                <Button size="icon" variant="ghost" onClick={copyToken}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-neutral-500">
                Expira em {new Date(result.expiresAt).toLocaleString("pt-BR")}. O Agent aparecerá como &quot;Online&quot; assim que
                enviar o primeiro heartbeat.
              </p>
              <Button variant="outline" className="w-full" onClick={downloadInstallSeed}>
                <Download className="mr-2 h-4 w-4" />
                Baixar arquivo de instalação
              </Button>
              <p className="text-xs text-neutral-500">
                Coloque o <code className="font-mono">install-config.json</code> baixado ao lado do{" "}
                <code className="font-mono">PrinterAgentSetup.exe</code> antes de rodar — o instalador identifica o cliente e
                preenche o token sozinho, sem precisar digitar nada.
              </p>
            </div>
            <DialogFooter>
              <Button onClick={resetAndClose}>Concluir</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
