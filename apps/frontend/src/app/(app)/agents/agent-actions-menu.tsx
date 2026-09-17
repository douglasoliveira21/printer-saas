"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, MoreHorizontal, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteAgent, useRegenerateAgentToken, useRenameAgent } from "@/hooks/use-agents";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Agent } from "@/lib/types";

export function AgentActionsMenu({ agent }: { agent: Agent }) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(agent.name);
  const [deleting, setDeleting] = useState(false);
  const [tokenResult, setTokenResult] = useState<{ enrollmentToken: string; expiresAt: string } | null>(null);

  const renameAgent = useRenameAgent();
  const deleteAgent = useDeleteAgent();
  const regenerateToken = useRegenerateAgentToken();

  async function handleRename() {
    try {
      await renameAgent.mutateAsync({ id: agent.id, name: newName });
      toast.success("Agent renomeado");
      setRenaming(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao renomear"));
    }
  }

  async function handleDelete() {
    try {
      await deleteAgent.mutateAsync(agent.id);
      toast.success("Agent removido");
      setDeleting(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover"));
    }
  }

  async function handleRegenerateToken() {
    try {
      const result = await regenerateToken.mutateAsync(agent.id);
      setTokenResult(result);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao gerar token"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setRenaming(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Renomear
          </DropdownMenuItem>
          {agent.status === "PENDING" && (
            <DropdownMenuItem onClick={handleRegenerateToken}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Gerar novo token
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setDeleting(true)} className="text-red-600 focus:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Agent</DialogTitle>
          </DialogHeader>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} className="my-4" />
          <DialogFooter>
            <Button onClick={handleRename} disabled={!newName.trim() || renameAgent.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Agent</DialogTitle>
            <DialogDescription>
              Isso remove &quot;{agent.name}&quot; da lista. As impressoras já descobertas por ele continuam no sistema.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteAgent.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!tokenResult} onOpenChange={(open) => !open && setTokenResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo token de instalação</DialogTitle>
            <DialogDescription>Use este token no Agent. Expira em 24h.</DialogDescription>
          </DialogHeader>
          {tokenResult && (
            <div className="flex items-center gap-2 rounded-md border bg-neutral-50 p-3 font-mono text-sm dark:bg-neutral-900">
              <span className="flex-1 break-all">{tokenResult.enrollmentToken}</span>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  navigator.clipboard.writeText(tokenResult.enrollmentToken);
                  toast.success("Token copiado");
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setTokenResult(null)}>Concluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
