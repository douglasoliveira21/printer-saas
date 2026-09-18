"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUpdateCustomer } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Customer } from "@/lib/types";
import { CustomerFormFields, customerFormToInput, type CustomerFormValue } from "../customer-form-fields";

function customerToFormValue(customer: Customer): CustomerFormValue {
  return {
    personType: customer.personType,
    legalName: customer.legalName,
    tradeName: customer.tradeName ?? "",
    document: customer.document ?? "",
    stateRegistration: customer.stateRegistration ?? "",
    municipalRegistration: customer.municipalRegistration ?? "",
    status: customer.status,
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    whatsapp: customer.whatsapp ?? "",
    financialEmail: customer.financialEmail ?? "",
    supportEmail: customer.supportEmail ?? "",
    contactName: customer.contactName ?? "",
    contactRole: customer.contactRole ?? "",
    zipCode: customer.zipCode ?? "",
    street: customer.street ?? "",
    number: customer.number ?? "",
    complement: customer.complement ?? "",
    neighborhood: customer.neighborhood ?? "",
    city: customer.city ?? "",
    state: customer.state ?? "",
    country: customer.country ?? "Brasil",
  };
}

export function EditCustomerDialog({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CustomerFormValue>(() => customerToFormValue(customer));
  const [slaHours, setSlaHours] = useState(customer.slaHours?.toString() ?? "");
  const updateCustomer = useUpdateCustomer();

  function patch(update: Partial<CustomerFormValue>) {
    setForm((prev) => ({ ...prev, ...update }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        ...customerFormToInput(form),
        status: form.status,
        slaHours: slaHours ? Number(slaHours) : undefined,
      });
      toast.success("Cliente atualizado");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar cliente"));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setForm(customerToFormValue(customer));
      }}
    >
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Atualize os dados cadastrais, de contato e endereço.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <CustomerFormFields value={form} onChange={patch} showStatus />
            <div className="space-y-2">
              <Label htmlFor="slaHours">SLA padrão (horas) — sobrescreve o do contrato</Label>
              <Input
                id="slaHours"
                type="number"
                min={0}
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="Herdado do contrato"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
