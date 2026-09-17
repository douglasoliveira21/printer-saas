"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { useCreateCustomer } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";

export function CreateCustomerDialog() {
  const [open, setOpen] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [tradeName, setTradeName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const createCustomer = useCreateCustomer();

  function reset() {
    setLegalName("");
    setTradeName("");
    setDocument("");
    setEmail("");
    setPhone("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createCustomer.mutateAsync({
        legalName,
        tradeName: tradeName || undefined,
        document: document || undefined,
        email: email || undefined,
        phone: phone || undefined,
      });
      toast.success("Cliente cadastrado com sucesso");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao cadastrar cliente"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo cliente
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
            <DialogDescription>Cadastre a razão social e os dados de contato do cliente.</DialogDescription>
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
