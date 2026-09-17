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
import { useCustomers } from "@/hooks/use-customers";
import { usePrinters } from "@/hooks/use-printers";
import { useCreateContract } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";

export function CreateContractDialog() {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [monthlyFee, setMonthlyFee] = useState("");
  const [franchisePages, setFranchisePages] = useState("");
  const [overagePriceBw, setOveragePriceBw] = useState("");

  const { data: customers } = useCustomers();
  const { data: printers } = usePrinters({ customerId: customerId || undefined, status: "MONITORED" });
  const createContract = useCreateContract();

  function reset() {
    setCustomerId("");
    setPrinterId("");
    setStartDate(new Date().toISOString().slice(0, 10));
    setMonthlyFee("");
    setFranchisePages("");
    setOveragePriceBw("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createContract.mutateAsync({
        customerId,
        printerId: printerId || undefined,
        startDate,
        monthlyFee: Number(monthlyFee),
        franchisePages: franchisePages ? Number(franchisePages) : undefined,
        overagePriceBw: overagePriceBw ? Number(overagePriceBw) : undefined,
      });
      toast.success("Contrato criado como rascunho");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar contrato"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo contrato
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
            <DialogDescription>Criado como rascunho — ative quando estiver pronto para cobrar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v ?? ""); setPrinterId(""); }}>
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

            {customerId && printers && printers.data.length > 0 && (
              <div className="space-y-2">
                <Label>Impressora</Label>
                <Select value={printerId} onValueChange={(v) => setPrinterId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.data.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.manufacturer} {p.model} ({p.ip})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Início *</Label>
                <Input id="startDate" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monthlyFee">Mensalidade (R$) *</Label>
                <Input id="monthlyFee" type="number" step="0.01" min="0" required value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="franchisePages">Franquia (páginas)</Label>
                <Input id="franchisePages" type="number" min="0" value={franchisePages} onChange={(e) => setFranchisePages(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="overagePriceBw">Valor excedente P&B (R$)</Label>
                <Input id="overagePriceBw" type="number" step="0.0001" min="0" value={overagePriceBw} onChange={(e) => setOveragePriceBw(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!customerId || !monthlyFee || createContract.isPending}>
              {createContract.isPending ? "Salvando..." : "Criar contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
