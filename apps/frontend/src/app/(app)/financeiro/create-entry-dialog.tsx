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
import { useCreateFinancialEntry } from "@/hooks/use-financial";
import { getApiErrorMessage } from "@/lib/api-client";
import type { FinancialEntryType } from "@/lib/types";

const TYPE_LABEL: Record<FinancialEntryType, string> = { RECEIVABLE: "Contas a receber", PAYABLE: "Contas a pagar" };

export function CreateEntryDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FinancialEntryType>("RECEIVABLE");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [customerId, setCustomerId] = useState("");

  const { data: customers } = useCustomers();
  const createEntry = useCreateFinancialEntry();

  function reset() {
    setType("RECEIVABLE");
    setCategory("");
    setDescription("");
    setAmount("");
    setDueDate(new Date().toISOString().slice(0, 10));
    setCustomerId("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createEntry.mutateAsync({
        type,
        category,
        description: description || undefined,
        amount: Number(amount),
        dueDate,
        customerId: customerId || undefined,
      });
      toast.success("Lançamento criado");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar lançamento"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo lançamento
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo lançamento financeiro</DialogTitle>
            <DialogDescription>Conta a receber ou a pagar.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType((v ?? "RECEIVABLE") as FinancialEntryType)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: FinancialEntryType) => TYPE_LABEL[value]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEIVABLE">{TYPE_LABEL.RECEIVABLE}</SelectItem>
                  <SelectItem value="PAYABLE">{TYPE_LABEL.PAYABLE}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Categoria *</Label>
              <Input id="category" required value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex.: Mensalidade, Aluguel, Fornecedor" />
            </div>

            {type === "RECEIVABLE" && (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={customerId} onValueChange={(v) => setCustomerId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione (opcional)" />
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
            )}

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
            <Button type="submit" disabled={!category || !amount || createEntry.isPending}>
              {createEntry.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
