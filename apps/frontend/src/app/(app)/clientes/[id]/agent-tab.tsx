"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Download, KeyRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateAgentEnrollment, useRegenerateAgentToken, type CreateAgentEnrollmentResult } from "@/hooks/use-agents";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Customer } from "@/lib/types";

// Precisa ficar em sincronia com WindowsServiceInstaller.DefaultApiUrl
// (apps/agent-windows/src/PrinterAgent.ConfigTool/WindowsServiceInstaller.cs) —
// é o mesmo endpoint fixo que o instalador do Agent já usa por padrão.
const AGENT_DEFAULT_API_URL = "https://api.print.vgon.com.br";

const STATUS_CONFIG: Record<NonNullable<Customer["agent"]>["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  ONLINE: { label: "Online", variant: "default" },
  OFFLINE: { label: "Offline", variant: "destructive" },
  PENDING: { label: "Aguardando instalação", variant: "outline" },
  DISABLED: { label: "Desativado", variant: "secondary" },
};

export function AgentTab({ customer }: { customer: Customer }) {
  const [result, setResult] = useState<CreateAgentEnrollmentResult | null>(null);
  const queryClient = useQueryClient();
  const createEnrollment = useCreateAgentEnrollment();
  const regenerate = useRegenerateAgentToken();
  const agentName = customer.tradeName || customer.legalName;

  function copy(value: string) {
    navigator.clipboard.writeText(value);
    toast.success("Token copiado");
  }

  function downloadInstallSeed(token: string) {
    const seed = {
      apiUrl: AGENT_DEFAULT_API_URL,
      enrollmentToken: token,
      agentName,
      customerName: agentName,
    };
    const blob = new Blob([JSON.stringify(seed, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "install-config.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCreate() {
    try {
      const data = await createEnrollment.mutateAsync({ name: agentName, customerId: customer.id });
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["customers", customer.id] });
      copy(data.enrollmentToken);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar token"));
    }
  }

  async function handleRegenerate() {
    if (!customer.agent) return;
    try {
      const data = await regenerate.mutateAsync(customer.agent.id);
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["customers", customer.id] });
      copy(data.enrollmentToken);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar token"));
    }
  }

  const pending = createEnrollment.isPending || regenerate.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agent de monitoramento</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {customer.agent && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-500">Status:</span>
            <Badge variant={STATUS_CONFIG[customer.agent.status].variant}>{STATUS_CONFIG[customer.agent.status].label}</Badge>
          </div>
        )}

        {!customer.agent && !result && (
          <>
            <p className="text-sm text-neutral-500">
              Este cliente ainda não tem um Agent vinculado. Gere um token de instalação de uso único (válido por 24h) para
              instalar o Agent Windows na rede do cliente.
            </p>
            <Button onClick={handleCreate} disabled={pending}>
              <KeyRound className="mr-2 h-4 w-4" />
              {pending ? "Gerando..." : "Gerar token de instalação"}
            </Button>
          </>
        )}

        {customer.agent && !result && (
          <>
            <p className="text-sm text-neutral-500">
              {customer.agent.status === "PENDING"
                ? "Ainda aguardando o primeiro heartbeat. Use o token abaixo para instalar o Agent."
                : "Já instalado. Gerar um novo token invalida o anterior e volta o Agent para \"Aguardando instalação\" — use apenas para reconfigurar/reinstalar."}
            </p>
            {customer.agent.status === "PENDING" && customer.agent.enrollmentToken ? (
              <div className="flex items-center gap-2 rounded-md border bg-neutral-50 p-3 font-mono text-sm dark:bg-neutral-900">
                <span className="flex-1 break-all">{customer.agent.enrollmentToken}</span>
                <Button size="icon" variant="ghost" onClick={() => copy(customer.agent!.enrollmentToken!)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ) : null}
            <Button variant="outline" onClick={handleRegenerate} disabled={pending}>
              <KeyRound className="mr-2 h-4 w-4" />
              {pending ? "Gerando..." : "Gerar novo token"}
            </Button>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-md border bg-neutral-50 p-3 font-mono text-sm dark:bg-neutral-900">
              <span className="flex-1 break-all">{result.enrollmentToken}</span>
              <Button size="icon" variant="ghost" onClick={() => copy(result.enrollmentToken)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-neutral-500">
              Expira em {new Date(result.expiresAt).toLocaleString("pt-BR")}. O Agent aparecerá como &quot;Online&quot; assim que
              enviar o primeiro heartbeat.
            </p>
            <Button variant="outline" onClick={() => downloadInstallSeed(result.enrollmentToken)}>
              <Download className="mr-2 h-4 w-4" />
              Baixar arquivo de instalação
            </Button>
            <p className="text-xs text-neutral-500">
              Coloque o <code className="font-mono">install-config.json</code> baixado ao lado do{" "}
              <code className="font-mono">PrinterAgentSetup.exe</code> antes de rodar — o instalador identifica o cliente e
              preenche o token sozinho, sem precisar digitar nada.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
