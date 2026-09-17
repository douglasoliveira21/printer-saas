"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
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
import { useDeleteInventoryItem, useUpdateInventoryItem } from "@/hooks/use-inventory";
import { getApiErrorMessage } from "@/lib/api-client";
import type { InventoryItem } from "@/lib/types";

export function ItemActionsMenu({ item }: { item: InventoryItem }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(item.name);
  const [type, setType] = useState(item.type);
  const [minQuantity, setMinQuantity] = useState(String(item.minQuantity));

  const updateItem = useUpdateInventoryItem();
  const deleteItem = useDeleteInventoryItem();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updateItem.mutateAsync({ id: item.id, name, type, minQuantity: Number(minQuantity) || 0 });
      toast.success("Item atualizado");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar item"));
    }
  }

  async function handleDelete() {
    try {
      await deleteItem.mutateAsync(item.id);
      toast.success("Item excluído");
      setDeleting(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir item"));
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
          <DropdownMenuItem onClick={() => setDeleting(true)} className="text-red-600 focus:text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Editar item</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo *</Label>
                <Input id="type" required value={type} onChange={(e) => setType(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minQuantity">Estoque mínimo</Label>
                <Input id="minQuantity" type="number" min="0" value={minQuantity} onChange={(e) => setMinQuantity(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateItem.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir item</DialogTitle>
            <DialogDescription>
              Tem certeza que quer excluir &quot;{item.name}&quot;? O histórico de movimentações dele também será removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
