"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
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
import { useDeleteSnmpCredential, useSnmpCredentials, type SnmpCredential } from "@/hooks/use-snmp-credentials";
import { SnmpCredentialDialog } from "./snmp-credential-dialog";

const SECURITY_LEVEL_BADGE: Record<SnmpCredential["securityLevel"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  authPriv: { label: "Auth + Priv", variant: "default" },
  authNoPriv: { label: "Auth apenas", variant: "secondary" },
  noAuthNoPriv: { label: "Sem auth/priv", variant: "outline" },
};

export function SnmpCredentialsTab() {
  const { data: credentials, isLoading } = useSnmpCredentials();
  const [editing, setEditing] = useState<SnmpCredential | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SnmpCredential | null>(null);
  const deleteCredential = useDeleteSnmpCredential();

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteCredential.mutateAsync(deleteTarget.id);
      toast.success("Credencial removida");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover credencial"));
    }
  }

  const columns: DataTableColumn<SnmpCredential>[] = [
    { key: "name", header: "Nome", cell: (c) => c.name },
    { key: "userName", header: "Usuário", cell: (c) => c.userName, hideOnMobile: true },
    {
      key: "securityLevel",
      header: "Segurança",
      cell: (c) => <Badge variant={SECURITY_LEVEL_BADGE[c.securityLevel].variant}>{SECURITY_LEVEL_BADGE[c.securityLevel].label}</Badge>,
    },
    {
      key: "usage",
      header: "Em uso",
      cell: (c) => `${c.printersUsingIt} impressora(s), ${c.agentsUsingItAsDefault} agent(s)`,
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
            Editar
          </Button>
          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteTarget(c)}>
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
          Credenciais SNMP v3 reutilizáveis — atribua a uma impressora específica (na tela de detalhes dela) ou defina
          como padrão de um Agent. Senhas ficam criptografadas no banco e nunca voltam em texto puro pra essa tela.
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova credencial
        </Button>
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={credentials}
        keyField={(c) => c.id}
        isLoading={isLoading}
        emptyIcon={ShieldCheck}
        emptyTitle="Nenhuma credencial SNMP v3 cadastrada ainda"
        cardTitle={(c) => c.name}
        cardMeta={(c) => <Badge variant={SECURITY_LEVEL_BADGE[c.securityLevel].variant}>{SECURITY_LEVEL_BADGE[c.securityLevel].label}</Badge>}
        cardActions={(c) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(c)}>
              Editar
            </Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteTarget(c)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      <SnmpCredentialDialog credential={null} open={creating} onOpenChange={setCreating} />
      <SnmpCredentialDialog credential={editing} open={!!editing} onOpenChange={(open) => !open && setEditing(null)} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover credencial SNMP v3</DialogTitle>
            <DialogDescription>
              Tem certeza que quer remover &quot;{deleteTarget?.name}&quot;?
              {deleteTarget && (deleteTarget.printersUsingIt > 0 || deleteTarget.agentsUsingItAsDefault > 0)
                ? " Ela ainda está em uso — reatribua as impressoras/agents antes de remover."
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteCredential.isPending || (!!deleteTarget && (deleteTarget.printersUsingIt > 0 || deleteTarget.agentsUsingItAsDefault > 0))}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
