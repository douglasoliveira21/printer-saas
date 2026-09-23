"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDeleteUser, useTenantUser, useToggleUserActive, useUpdateUser } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import { AccountForm, type AccountFormValue } from "../account-form";

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: user, isLoading } = useTenantUser(id);
  const updateUser = useUpdateUser();
  const toggleActive = useToggleUserActive();
  const deleteUser = useDeleteUser();
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleSubmit(value: AccountFormValue) {
    try {
      await updateUser.mutateAsync({ id, ...value });
      toast.success("Conta salva");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar conta"));
    }
  }

  async function handleToggleActive() {
    if (!user) return;
    try {
      await toggleActive.mutateAsync({ id, activate: user.status !== "ACTIVE" });
      toast.success(user.status === "ACTIVE" ? "Conta desativada" : "Conta reativada");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao alterar status da conta"));
    }
  }

  async function handleDelete() {
    try {
      await deleteUser.mutateAsync(id);
      toast.success("Conta excluída");
      router.push("/configuracoes");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir conta"));
      setDeleteOpen(false);
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }
  if (!user) {
    return <p className="text-muted-foreground">Conta não encontrada.</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/configuracoes" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Configurações
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.status === "ACTIVE" ? "default" : "secondary"}>{user.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>
          <Button variant="outline" size="sm" onClick={handleToggleActive} disabled={toggleActive.isPending}>
            {user.status === "ACTIVE" ? "Desativar" : "Reativar"}
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" className="text-destructive" />}>
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir esta conta?</DialogTitle>
                <DialogDescription>
                  A conta de {user.name} será excluída e não poderá mais fazer login. Essa ação não pode ser desfeita pela tela.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteUser.isPending}>
                  Excluir
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AccountForm mode="edit" user={user} onSubmit={handleSubmit} submitting={updateUser.isPending} submitLabel="Salvar alterações" />
    </div>
  );
}
