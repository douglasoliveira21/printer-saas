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
import { useCreateLocation } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";

export function CreateLocationDialog({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const createLocation = useCreateLocation();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createLocation.mutateAsync({
        customerId,
        name,
        address: address || undefined,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
      });
      toast.success("Local cadastrado com sucesso");
      setName("");
      setAddress("");
      setContactName("");
      setContactPhone("");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao cadastrar local"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo local
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo local</DialogTitle>
            <DialogDescription>Ex.: Matriz, Filial Belo Horizonte.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço</Label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactName">Responsável</Label>
                <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Telefone</Label>
                <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createLocation.isPending}>
              {createLocation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
