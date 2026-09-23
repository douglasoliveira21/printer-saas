"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import { useCreateAgentRelease, useUpdateAgentRelease, type AgentRelease, type AgentReleaseInput } from "@/hooks/use-agent-releases";

const EMPTY: AgentReleaseInput = {
  version: "",
  downloadUrl: "",
  sha256: "",
  signingCertThumbprint: null,
  releaseNotes: null,
  isActive: true,
};

export function AgentReleaseDialog({
  release,
  open,
  onOpenChange,
}: {
  release: AgentRelease | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<AgentReleaseInput>(EMPTY);
  const createRelease = useCreateAgentRelease();
  const updateRelease = useUpdateAgentRelease();
  const isEditing = !!release;
  const pending = createRelease.isPending || updateRelease.isPending;

  useEffect(() => {
    if (!open) return;
    setForm(release ? { ...release } : EMPTY);
  }, [open, release]);

  function patch(update: Partial<AgentReleaseInput>) {
    setForm((prev) => ({ ...prev, ...update }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      if (isEditing) {
        await updateRelease.mutateAsync({ id: release!.id, ...form });
        toast.success("Release atualizada");
      } else {
        await createRelease.mutateAsync(form);
        toast.success("Release publicada — os Agents vão detectar na próxima checagem");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar release"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar release" : "Publicar nova release do Agent"}</DialogTitle>
            <DialogDescription>
              O .msi precisa estar assinado com o certificado configurado no Agent (ver{" "}
              <code>AuthenticodeVerifier.ExpectedThumbprint</code>) — uma release com hash ou assinatura errados é
              rejeitada silenciosamente pelo Agent (ele só loga e tenta de novo depois).
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Versão (SemVer) *</Label>
              <Input required placeholder="1.1.0" value={form.version} onChange={(e) => patch({ version: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>URL de download do .msi *</Label>
              <Input required type="url" value={form.downloadUrl} onChange={(e) => patch({ downloadUrl: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>SHA-256 do .msi *</Label>
              <Input
                required
                placeholder="64 caracteres hexadecimais"
                value={form.sha256}
                onChange={(e) => patch({ sha256: e.target.value.trim() })}
              />
            </div>

            <div className="space-y-2">
              <Label>Thumbprint do certificado de assinatura</Label>
              <Input
                placeholder="Informativo — não é o que o Agent usa pra decidir confiar"
                value={form.signingCertThumbprint ?? ""}
                onChange={(e) => patch({ signingCertThumbprint: e.target.value || null })}
              />
            </div>

            <div className="space-y-2">
              <Label>Notas da release</Label>
              <Textarea rows={3} value={form.releaseNotes ?? ""} onChange={(e) => patch({ releaseNotes: e.target.value || null })} />
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) => patch({ isActive: checked === true })}
              />
              <div className="space-y-0.5">
                <Label htmlFor="isActive">Ativa</Label>
                <p className="text-sm text-muted-foreground">Só releases ativas são oferecidas aos Agents</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
