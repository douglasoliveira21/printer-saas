"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCustomers } from "@/hooks/use-customers";
import { useCreateSupplyLevelFilter } from "@/hooks/use-supply-level-filters";
import { getApiErrorMessage } from "@/lib/api-client";

export function CreateFilterDialog({ onCreated }: { onCreated?: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const { data: customers } = useCustomers();
  const createFilter = useCreateSupplyLevelFilter();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim() || !customerId) return;
    try {
      const created = await createFilter.mutateAsync({ name: name.trim(), customerId });
      toast.success("Filtro criado");
      setOpen(false);
      setName("");
      setCustomerId("");
      onCreated?.(created.id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar filtro"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo filtro
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo filtro de controle de níveis de suprimentos</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome do filtro *</Label>
              <Input required placeholder="Ex.: Cliente XYZ" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {customers?.data.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.tradeName || c.legalName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || !customerId || createFilter.isPending}>
              {createFilter.isPending ? "Criando..." : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
