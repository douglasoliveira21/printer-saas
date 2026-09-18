"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateCustomer } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import { CustomerFormFields, customerFormToInput, EMPTY_CUSTOMER_FORM, type CustomerFormValue } from "./customer-form-fields";

export function CreateCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerFormValue>(EMPTY_CUSTOMER_FORM);
  const createCustomer = useCreateCustomer();

  function patch(update: Partial<CustomerFormValue>) {
    setForm((prev) => ({ ...prev, ...update }));
  }

  function reset() {
    setForm(EMPTY_CUSTOMER_FORM);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createCustomer.mutateAsync(customerFormToInput(form));
      toast.success("Cliente cadastrado com sucesso");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao cadastrar cliente"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo cliente
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Cadastre os dados cadastrais, de contato e endereço do cliente.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <CustomerFormFields value={form} onChange={patch} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createCustomer.isPending}>
              {createCustomer.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
