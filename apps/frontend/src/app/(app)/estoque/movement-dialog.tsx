"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMovement } from "@/hooks/use-inventory";
import { getApiErrorMessage } from "@/lib/api-client";
import type { InventoryItem, InventoryMovementType } from "@/lib/types";

const TYPE_LABEL: Record<InventoryMovementType, string> = { IN: "Entrada", OUT: "Saída", ADJUSTMENT: "Ajuste (contagem)" };

export function MovementDialog({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const [type, setType] = useState<InventoryMovementType>("IN");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const createMovement = useCreateMovement();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createMovement.mutateAsync({ itemId: item.id, type, quantity: Number(quantity), reason: reason || undefined });
      toast.success("Movimentação registrada");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao movimentar estoque"));
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Movimentar estoque — {item.name}</DialogTitle>
            <DialogDescription>Estoque atual: {item.quantity}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType((v ?? "IN") as InventoryMovementType)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: InventoryMovementType) => TYPE_LABEL[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">{TYPE_LABEL.IN}</SelectItem>
                  <SelectItem value="OUT">{TYPE_LABEL.OUT}</SelectItem>
                  <SelectItem value="ADJUSTMENT">{TYPE_LABEL.ADJUSTMENT}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">{type === "ADJUSTMENT" ? "Quantidade correta (contagem)" : "Quantidade"}</Label>
              <Input id="quantity" type="number" min="1" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createMovement.isPending}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              {createMovement.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
