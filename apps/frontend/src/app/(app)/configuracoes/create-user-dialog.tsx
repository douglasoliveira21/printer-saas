"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCreateUser } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import { AccountForm, type AccountFormValue } from "./usuarios/account-form";

export function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const createUser = useCreateUser();

  async function handleSubmit(value: AccountFormValue) {
    try {
      await createUser.mutateAsync({ ...value, password: value.password ?? "" });
      toast.success("Conta criada");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar conta"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Nova conta
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova conta</DialogTitle>
        </DialogHeader>
        <AccountForm mode="create" onSubmit={handleSubmit} submitting={createUser.isPending} submitLabel="Criar conta" />
      </DialogContent>
    </Dialog>
  );
}
