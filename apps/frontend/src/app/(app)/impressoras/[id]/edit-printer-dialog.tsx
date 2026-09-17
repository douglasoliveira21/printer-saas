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
import { useUpdatePrinter } from "@/hooks/use-printers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Printer } from "@/lib/types";

export function EditPrinterDialog({ printer }: { printer: Printer }) {
  const [open, setOpen] = useState(false);
  const [manufacturer, setManufacturer] = useState(printer.manufacturer ?? "");
  const [model, setModel] = useState(printer.model ?? "");
  const [slaHours, setSlaHours] = useState(printer.slaHours?.toString() ?? "");
  const updatePrinter = useUpdatePrinter();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updatePrinter.mutateAsync({
        id: printer.id,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        slaHours: slaHours ? Number(slaHours) : undefined,
      });
      toast.success("Impressora atualizada");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar impressora"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Editar impressora</DialogTitle>
            <DialogDescription>Corrija fabricante/modelo se o que o SNMP reportou não estiver correto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input id="manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slaHours">SLA (horas) — sobrescreve o padrão do cliente/contrato</Label>
              <Input
                id="slaHours"
                type="number"
                min={0}
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="Herdado do cliente/contrato"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updatePrinter.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
