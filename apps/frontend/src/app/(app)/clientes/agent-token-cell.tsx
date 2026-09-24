"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegenerateAgentToken } from "@/hooks/use-agents";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Customer } from "@/lib/types";

/**
 * Always offers a way to get a working install token for this customer's
 * Agent, regardless of its current online/offline status — the permanent
 * API key an already-installed Agent uses is stored hashed (irreversible by
 * design, see AgentCredentialStore), so it can never be displayed again.
 * What's always available instead is generating a FRESH one-time token
 * (moves the Agent back to "Pendente" so it's ready to redeem again — same
 * regenerate-token endpoint the Agents page already exposes), which is
 * exactly what's needed to reconfigure/reinstall on that client's machine.
 */
export function AgentTokenCell({ agent }: { agent: Customer["agent"] }) {
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const regenerate = useRegenerateAgentToken();

  if (!agent) {
    return (
      <span className="text-xs text-muted-foreground" title="Este cliente ainda não tem nenhum Agent — abra o cliente e vá na aba Agent para gerar o token de instalação.">
        Sem Agent
      </span>
    );
  }

  const token = freshToken ?? (agent.status === "PENDING" ? agent.enrollmentToken : null);

  function copy(value: string) {
    navigator.clipboard.writeText(value);
    toast.success("Token copiado");
  }

  async function handleGenerate() {
    try {
      const result = await regenerate.mutateAsync(agent!.id);
      setFreshToken(result.enrollmentToken);
      copy(result.enrollmentToken);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar token"));
    }
  }

  if (token) {
    return (
      <div className="flex items-center gap-1.5 font-mono text-xs">
        <span className="max-w-24 truncate" title={token}>
          {token}
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copy(token)}>
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleGenerate} disabled={regenerate.isPending}>
      <KeyRound className="mr-1.5 h-3 w-3" />
      {regenerate.isPending ? "Gerando..." : "Gerar token"}
    </Button>
  );
}
