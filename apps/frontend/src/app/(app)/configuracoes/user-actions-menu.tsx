"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, MoreHorizontal, Pencil, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRoles, useToggleUserActive, useUpdateUser, type TenantUser } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";

export function UserActionsMenu({ user }: { user: TenantUser }) {
  const [editing, setEditing] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [name, setName] = useState(user.name);
  const [roleId, setRoleId] = useState(user.roleId ?? "");
  const [newPassword, setNewPassword] = useState("");

  const { data: roles } = useRoles();
  const updateUser = useUpdateUser();
  const toggleActive = useToggleUserActive();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updateUser.mutateAsync({ id: user.id, name, roleId: roleId || undefined });
      toast.success("Usuário atualizado");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar usuário"));
    }
  }

  async function handleResetPassword(event: FormEvent) {
    event.preventDefault();
    try {
      await updateUser.mutateAsync({ id: user.id, password: newPassword });
      toast.success("Senha redefinida");
      setNewPassword("");
      setResettingPassword(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao redefinir senha"));
    }
  }

  async function handleToggleActive() {
    try {
      await toggleActive.mutateAsync({ id: user.id, activate: user.status !== "ACTIVE" });
      toast.success(user.status === "ACTIVE" ? "Usuário desativado" : "Usuário ativado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao alterar status"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setResettingPassword(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Redefinir senha
          </DropdownMenuItem>
          {user.status === "ACTIVE" ? (
            <DropdownMenuItem onClick={handleToggleActive} className="text-red-600 focus:text-red-600">
              <UserX className="mr-2 h-4 w-4" />
              Desativar
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={handleToggleActive}>
              <UserCheck className="mr-2 h-4 w-4" />
              Ativar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Editar usuário</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Perfil</Label>
                <Select value={roleId} onValueChange={(v) => setRoleId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles?.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateUser.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={resettingPassword} onOpenChange={setResettingPassword}>
        <DialogContent>
          <form onSubmit={handleResetPassword}>
            <DialogHeader>
              <DialogTitle>Redefinir senha</DialogTitle>
              <DialogDescription>Defina uma nova senha para {user.name}.</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label htmlFor="newPassword">Nova senha *</Label>
              <Input
                id="newPassword"
                type="password"
                minLength={8}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-2"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={newPassword.length < 8 || updateUser.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
