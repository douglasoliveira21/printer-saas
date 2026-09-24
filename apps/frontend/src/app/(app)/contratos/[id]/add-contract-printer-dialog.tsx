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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePrinters } from "@/hooks/use-printers";
import { useAddContractPrinter } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Contract } from "@/lib/types";

export function AddContractPrinterDialog({ contract }: { contract: Contract }) {
  const [open, setOpen] = useState(false);
  const [printerId, setPrinterId] = useState("");
  const [priceBw, setPriceBw] = useState("");
  const [priceColor, setPriceColor] = useState("");
  const [priceScan, setPriceScan] = useState("");
  const [fixedCost, setFixedCost] = useState("");

  const { data: printers } = usePrinters({ customerId: contract.customer?.id, status: "MONITORED" });
  const addPrinter = useAddContractPrinter();

  const linkedIds = new Set((contract.contractPrinters ?? []).map((cp) => cp.printerId));
  const availablePrinters = (printers?.data ?? []).filter((p) => !linkedIds.has(p.id));

  function reset() {
    setPrinterId("");
    setPriceBw("");
    setPriceColor("");
    setPriceScan("");
    setFixedCost("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await addPrinter.mutateAsync({
        contractId: contract.id,
        printerId,
        priceBw: priceBw ? Number(priceBw) : undefined,
        priceColor: priceColor ? Number(priceColor) : undefined,
        priceScan: priceScan ? Number(priceScan) : undefined,
        fixedCost: fixedCost ? Number(fixedCost) : undefined,
      });
      toast.success("Impressora vinculada ao contrato");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao vincular impressora"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar impressora
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Adicionar impressora ao contrato</DialogTitle>
            <DialogDescription>Preços em branco usam o custo padrão do contrato.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Impressora *</Label>
              <Select value={printerId} onValueChange={(v) => setPrinterId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a impressora">
                    {(v: string) => {
                      if (!v) return "Selecione a impressora";
                      const p = availablePrinters.find((printer) => printer.id === v);
                      return p ? `${p.manufacturer} ${p.model} (${p.ip})` : v;
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availablePrinters.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.manufacturer} {p.model} ({p.ip})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceBw">Custo P&B (R$/página)</Label>
                <Input id="priceBw" type="number" step="0.0001" min="0" value={priceBw} onChange={(e) => setPriceBw(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priceColor">Custo colorida (R$/página)</Label>
                <Input id="priceColor" type="number" step="0.0001" min="0" value={priceColor} onChange={(e) => setPriceColor(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priceScan">Custo digitalização (R$)</Label>
                <Input id="priceScan" type="number" step="0.0001" min="0" value={priceScan} onChange={(e) => setPriceScan(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fixedCost">Custo fixo (R$)</Label>
                <Input id="fixedCost" type="number" step="0.01" min="0" value={fixedCost} onChange={(e) => setFixedCost(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!printerId || addPrinter.isPending}>
              {addPrinter.isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
