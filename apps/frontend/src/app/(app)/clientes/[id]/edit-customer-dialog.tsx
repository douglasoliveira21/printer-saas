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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateCustomer } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Customer } from "@/lib/types";

export function EditCustomerDialog({ customer }: { customer: Customer }) {
  const [open, setOpen] = useState(false);
  const [legalName, setLegalName] = useState(customer.legalName);
  const [tradeName, setTradeName] = useState(customer.tradeName ?? "");
  const [document, setDocument] = useState(customer.document ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [status, setStatus] = useState<Customer["status"]>(customer.status);
  const [slaHours, setSlaHours] = useState(customer.slaHours?.toString() ?? "");
  const updateCustomer = useUpdateCustomer();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await updateCustomer.mutateAsync({
        id: customer.id,
        legalName,
        tradeName: tradeName || undefined,
        document: document || undefined,
        email: email || undefined,
        phone: phone || undefined,
        status,
        slaHours: slaHours ? Number(slaHours) : undefined,
      });
      toast.success("Cliente atualizado");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar cliente"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
            <DialogDescription>Atualize os dados cadastrais.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="legalName">Razão social *</Label>
              <Input id="legalName" required value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradeName">Nome fantasia</Label>
              <Input id="tradeName" value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document">CNPJ</Label>
              <Input id="document" value={document} onChange={(e) => setDocument(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus((v ?? "ACTIVE") as Customer["status"])}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: Customer["status"]) => (value === "ACTIVE" ? "Ativo" : "Inativo")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="INACTIVE">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
