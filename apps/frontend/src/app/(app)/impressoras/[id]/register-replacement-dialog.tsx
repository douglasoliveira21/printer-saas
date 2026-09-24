"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
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
import { useCreateReplacement } from "@/hooks/use-consumables";
import { useInventoryItems } from "@/hooks/use-inventory";
import { getApiErrorMessage } from "@/lib/api-client";

export function RegisterReplacementDialog({ printerId, type, color }: { printerId: string; type: string; color: string | null }) {
  const [open, setOpen] = useState(false);
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [notes, setNotes] = useState("");

  const { data: items } = useInventoryItems();
  const createReplacement = useCreateReplacement();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createReplacement.mutateAsync({
        printerId,
        type,
        color: color ?? undefined,
        notes: notes || undefined,
        inventoryItemId: inventoryItemId || undefined,
      });
      toast.success("Troca registrada");
      setInventoryItemId("");
      setNotes("");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao registrar troca"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Wrench className="mr-2 h-4 w-4" />
        Registrar troca
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Registrar troca de suprimento</DialogTitle>
            <DialogDescription>
              {type}
              {color ? ` (${color})` : ""} — confirma que este item foi trocado fisicamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {items && items.length > 0 && (
              <div className="space-y-2">
                <Label>Baixar do estoque (opcional)</Label>
                <Select value={inventoryItemId} onValueChange={(v) => setInventoryItemId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Nenhum item de estoque vinculado">
                      {(v: string) => (v ? items?.find((item) => item.id === v)?.name || v : "Nenhum item de estoque vinculado")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.quantity} em estoque)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="replacement-notes">Observação</Label>
              <Input id="replacement-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createReplacement.isPending}>
              {createReplacement.isPending ? "Salvando..." : "Confirmar troca"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
