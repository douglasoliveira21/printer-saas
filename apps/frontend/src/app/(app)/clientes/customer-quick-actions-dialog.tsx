"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteCustomer, useUpdateCustomer } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Customer } from "@/lib/types";

/** Opened on a single click on a customer row/card (double click navigates straight to the detail page instead). */
export function CustomerQuickActionsDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const router = useRouter();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  function close() {
    setConfirmingDelete(false);
    onOpenChange(false);
  }

  async function handleDeactivate() {
    if (!customer) return;
    try {
      await updateCustomer.mutateAsync({ id: customer.id, status: customer.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast.success(customer.status === "ACTIVE" ? "Cliente desativado" : "Cliente ativado");
      close();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar cliente"));
    }
  }

  async function handleDelete() {
    if (!customer) return;
    try {
      await deleteCustomer.mutateAsync(customer.id);
      toast.success("Cliente excluído");
      close();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir cliente"));
      setConfirmingDelete(false);
    }
  }

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(next) : close())}>
      <DialogContent className="sm:max-w-sm">
        {!confirmingDelete ? (
          <>
            <DialogHeader>
              <DialogTitle>{customer.tradeName || customer.legalName}</DialogTitle>
              <DialogDescription>O que você quer fazer?</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 py-2">
              <Button variant="outline" className="justify-start" onClick={() => router.push(`/clientes/${customer.id}`)}>
                <Eye className="mr-2 h-4 w-4" />
                Ver detalhes
              </Button>
              <Button variant="outline" className="justify-start" onClick={handleDeactivate} disabled={updateCustomer.isPending}>
                <Ban className="mr-2 h-4 w-4" />
                {customer.status === "ACTIVE" ? "Desativar cliente" : "Ativar cliente"}
              </Button>
              <Button
                variant="outline"
                className="justify-start text-red-600 hover:text-red-600"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Excluir cliente
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Excluir cliente</DialogTitle>
              <DialogDescription>
                Tem certeza que quer excluir &quot;{customer.tradeName || customer.legalName}&quot;? Locais são excluídos junto;
                não é possível se houver contratos ou ordens de serviço vinculados a ele.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteCustomer.isPending}>
                Excluir
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
