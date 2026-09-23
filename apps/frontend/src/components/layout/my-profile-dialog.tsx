"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { useMyFullProfile, useUpdateMyProfile } from "@/hooks/use-my-account";
import { getApiErrorMessage } from "@/lib/api-client";

const ACCOUNT_TYPE_LABEL: Record<string, string> = { STAFF: "Colaborador", CUSTOMER: "Cliente" };
const STATUS_LABEL: Record<string, string> = { ACTIVE: "Ativo", INACTIVE: "Inativo", INVITED: "Convidado" };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

export function MyProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, updateUser } = useAuth();
  const { data: profile, isLoading } = useMyFullProfile();
  const updateProfile = useUpdateMyProfile();
  const [name, setName] = useState(user?.name ?? "");

  useEffect(() => {
    if (open) setName(user?.name ?? "");
  }, [open, user?.name]);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await updateProfile.mutateAsync({ name: name.trim() });
      updateUser({ name: name.trim() });
      toast.success("Perfil atualizado");
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar perfil"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Meu perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {isLoading || !profile ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
                <Field label="Tipo de conta" value={ACCOUNT_TYPE_LABEL[profile.accountType] ?? profile.accountType} />
                <Field label="Status" value={<Badge variant={profile.status === "ACTIVE" ? "default" : "secondary"}>{STATUS_LABEL[profile.status]}</Badge>} />
                {profile.customer && <Field label="Cliente vinculado" value={profile.customer.tradeName || profile.customer.legalName} />}
                {profile.role && <Field label="Perfil" value={profile.role.name} />}
                <Field label="Permissões diretas" value={profile.directPermissions.length} />
                <Field label="Último acesso" value={profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString("pt-BR") : "Nunca"} />
                <Field label="Conta criada em" value={new Date(profile.createdAt).toLocaleDateString("pt-BR")} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="profileName">Nome</Label>
              <Input id="profileName" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="profileEmail">E-mail</Label>
              <Input id="profileEmail" disabled value={user?.email ?? ""} />
              <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado por aqui — fale com um administrador.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || updateProfile.isPending}>
              {updateProfile.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
