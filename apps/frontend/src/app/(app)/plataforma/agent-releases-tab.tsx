"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DownloadCloud, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { getApiErrorMessage } from "@/lib/api-client";
import { useAgentReleases, useDeleteAgentRelease, type AgentRelease } from "@/hooks/use-agent-releases";
import { AgentReleaseDialog } from "./agent-release-dialog";

export function AgentReleasesTab() {
  const { data: releases, isLoading } = useAgentReleases();
  const [editing, setEditing] = useState<AgentRelease | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AgentRelease | null>(null);
  const deleteRelease = useDeleteAgentRelease();

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRelease.mutateAsync(deleteTarget.id);
      toast.success("Release removida");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover release"));
    }
  }

  const columns: DataTableColumn<AgentRelease>[] = [
    { key: "version", header: "Versão", cell: (r) => r.version },
    {
      key: "status",
      header: "Status",
      cell: (r) => <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Ativa" : "Inativa"}</Badge>,
    },
    { key: "publishedAt", header: "Publicada em", cell: (r) => new Date(r.publishedAt).toLocaleString("pt-BR"), hideOnMobile: true },
    { key: "sha256", header: "SHA-256", cell: (r) => <span className="font-mono text-xs">{r.sha256.slice(0, 16)}…</span>, hideOnMobile: true },
    {
      key: "actions",
      header: "",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
            Editar
          </Button>
          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteTarget(r)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Releases do Agent Windows para auto-update — o Agent só instala uma versão nova se o hash SHA-256 bater E a
          assinatura Authenticode do .msi corresponder ao certificado fixado no próprio Agent (nunca confia no
          thumbprint informado aqui sozinho).
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Publicar release
        </Button>
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={releases}
        keyField={(r) => r.id}
        isLoading={isLoading}
        emptyIcon={DownloadCloud}
        emptyTitle="Nenhuma release publicada ainda"
        cardTitle={(r) => r.version}
        cardMeta={(r) => <Badge variant={r.isActive ? "default" : "outline"}>{r.isActive ? "Ativa" : "Inativa"}</Badge>}
        cardActions={(r) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
              Editar
            </Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteTarget(r)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      <AgentReleaseDialog release={null} open={creating} onOpenChange={setCreating} />
      <AgentReleaseDialog release={editing} open={!!editing} onOpenChange={(open) => !open && setEditing(null)} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover release</DialogTitle>
            <DialogDescription>
              Tem certeza que quer remover a versão &quot;{deleteTarget?.version}&quot;? Agents que já instalaram essa
              versão continuam rodando ela normalmente — isso só tira ela da lista de releases disponíveis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteRelease.isPending}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
