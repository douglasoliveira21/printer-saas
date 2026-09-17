"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Ban, MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCancelFinancialEntry, useUpdateFinancialEntry } from "@/hooks/use-financial";
import { getApiErrorMessage } from "@/lib/api-client";
import type { FinancialEntry } from "@/lib/types";

export function EntryActionsMenu({ entry }: { entry: FinancialEntry }) {
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [category, setCategory] = useState(entry.category);
  const [description, setDescription] = useState(entry.description ?? "");
  const [amount, setAmount] = useState(entry.amount);
  const [dueDate, setDueDate] = useState(entry.dueDate.slice(0, 10));

  const updateEntry = useUpdateFinancialEntry();
  const cancelEntry = useCancelFinancialEntry();

  if (entry.status !== "PENDING") {
    return null;
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updateEntry.mutateAsync({ id: entry.id, category, description: description || undefined, amount: Number(amount), dueDate });
      toast.success("Lançamento atualizado");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar lançamento"));
    }
  }

  async function handleCancel() {
    try {
      await cancelEntry.mutateAsync(entry.id);
      toast.success("Lançamento cancelado");
      setCancelling(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao cancelar lançamento"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setCancelling(true)} className="text-red-600 focus:text-red-600">
            <Ban className="mr-2 h-4 w-4" />
            Cancelar
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Editar lançamento</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Input id="category" required value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Valor (R$) *</Label>
                  <Input id="amount" type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dueDate">Vencimento *</Label>
                  <Input id="dueDate" type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateEntry.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelling} onOpenChange={setCancelling}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar lançamento</DialogTitle>
            <DialogDescription>Isso marca &quot;{entry.category}&quot; como cancelado. Não pode ser desfeito.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelEntry.isPending}>
              Cancelar lançamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
