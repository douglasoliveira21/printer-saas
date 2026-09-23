"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useUpdateMyProfile } from "@/hooks/use-my-account";
import { getApiErrorMessage } from "@/lib/api-client";

export function MyProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, updateUser } = useAuth();
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
          <div className="grid gap-4 py-4">
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
