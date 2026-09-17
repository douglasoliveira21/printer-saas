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
import { useCreateInventoryItem } from "@/hooks/use-inventory";
import { getApiErrorMessage } from "@/lib/api-client";

export function CreateItemDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [minQuantity, setMinQuantity] = useState("0");
  const createItem = useCreateInventoryItem();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createItem.mutateAsync({ name, type, minQuantity: Number(minQuantity) || 0 });
      toast.success("Item cadastrado");
      setName("");
      setType("");
      setMinQuantity("0");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao cadastrar item"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo item
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo item de estoque</DialogTitle>
            <DialogDescription>Toner, cartucho, cilindro, peça, etc.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo *</Label>
              <Input id="type" required value={type} onChange={(e) => setType(e.target.value)} placeholder="Ex.: toner, cilindro, peça" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minQuantity">Estoque mínimo</Label>
              <Input id="minQuantity" type="number" min="0" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name || !type || createItem.isPending}>
              {createItem.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
