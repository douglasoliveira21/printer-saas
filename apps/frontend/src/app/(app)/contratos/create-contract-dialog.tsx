"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useAddContractFixedCost, useAddContractPricingTier, useAddContractPrinter, useCreateContract } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface FixedCostRow {
  label: string;
  amount: string;
}

interface TierRow {
  fromPage: string;
  toPage: string;
  pricePerPage: string;
}

export function CreateContractDialog() {
  const now = new Date();
  const [open, setOpen] = useState(false);

  // Dados do contrato
  const [customerId, setCustomerId] = useState("");
  const [billingDay, setBillingDay] = useState("1");
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [startYear, setStartYear] = useState(now.getFullYear());
  const [indeterminate, setIndeterminate] = useState(true);
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear() + 1);

  // Custos
  const [monthlyFee, setMonthlyFee] = useState("");
  const [defaultPriceBw, setDefaultPriceBw] = useState("");
  const [defaultPriceColor, setDefaultPriceColor] = useState("");
  const [defaultPriceScan, setDefaultPriceScan] = useState("");
  const [franchisePages, setFranchisePages] = useState("");
  const [overagePriceBw, setOveragePriceBw] = useState("");
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [newTierFrom, setNewTierFrom] = useState("");
  const [newTierTo, setNewTierTo] = useState("");
  const [newTierPrice, setNewTierPrice] = useState("");

  // Impressoras
  const [selectedPrinterIds, setSelectedPrinterIds] = useState<string[]>([]);

  // Custos fixos adicionais
  const [fixedCosts, setFixedCosts] = useState<FixedCostRow[]>([]);
  const [newCostLabel, setNewCostLabel] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");

  const { data: customers } = useCustomers();
  const { data: printers } = usePrinters({ customerId: customerId || undefined, status: "MONITORED" });
  const createContract = useCreateContract();
  const addPrinter = useAddContractPrinter();
  const addFixedCost = useAddContractFixedCost();
  const addPricingTier = useAddContractPricingTier();

  function reset() {
    setCustomerId("");
    setBillingDay("1");
    setStartMonth(now.getMonth() + 1);
    setStartYear(now.getFullYear());
    setIndeterminate(true);
    setEndMonth(now.getMonth() + 1);
    setEndYear(now.getFullYear() + 1);
    setMonthlyFee("");
    setDefaultPriceBw("");
    setDefaultPriceColor("");
    setDefaultPriceScan("");
    setFranchisePages("");
    setOveragePriceBw("");
    setTiers([]);
    setNewTierFrom("");
    setNewTierTo("");
    setNewTierPrice("");
    setSelectedPrinterIds([]);
    setFixedCosts([]);
    setNewCostLabel("");
    setNewCostAmount("");
  }

  function handleAddTierRow() {
    if (!newTierFrom || !newTierPrice) return;
    setTiers((prev) => [...prev, { fromPage: newTierFrom, toPage: newTierTo, pricePerPage: newTierPrice }]);
    setNewTierFrom("");
    setNewTierTo("");
    setNewTierPrice("");
  }

  function handleAddCostRow() {
    if (!newCostLabel.trim() || !newCostAmount) return;
    setFixedCosts((prev) => [...prev, { label: newCostLabel.trim(), amount: newCostAmount }]);
    setNewCostLabel("");
    setNewCostAmount("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const contract = await createContract.mutateAsync({
        customerId,
        billingDay: Number(billingDay),
        startDate: new Date(startYear, startMonth - 1, 1).toISOString(),
        endDate: indeterminate ? null : new Date(endYear, endMonth - 1, 1).toISOString(),
        monthlyFee: Number(monthlyFee),
        defaultPriceBw: defaultPriceBw ? Number(defaultPriceBw) : undefined,
        defaultPriceColor: defaultPriceColor ? Number(defaultPriceColor) : undefined,
        defaultPriceScan: defaultPriceScan ? Number(defaultPriceScan) : undefined,
        franchisePages: franchisePages ? Number(franchisePages) : undefined,
        overagePriceBw: overagePriceBw ? Number(overagePriceBw) : undefined,
      });

      for (const printerId of selectedPrinterIds) {
        await addPrinter.mutateAsync({ contractId: contract.id, printerId });
      }
      for (const cost of fixedCosts) {
        await addFixedCost.mutateAsync({ contractId: contract.id, label: cost.label, amount: Number(cost.amount) });
      }
      for (const tier of tiers) {
        await addPricingTier.mutateAsync({
          contractId: contract.id,
          fromPage: Number(tier.fromPage),
          toPage: tier.toPage ? Number(tier.toPage) : undefined,
          pricePerPage: Number(tier.pricePerPage),
        });
      }

      toast.success("Contrato criado como rascunho");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar contrato"));
    }
  }

  const saving = createContract.isPending || addPrinter.isPending || addFixedCost.isPending || addPricingTier.isPending;

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo contrato
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo contrato</DialogTitle>
            <DialogDescription>Criado como rascunho — ative quando estiver pronto para cobrar.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Dados do contrato</h3>
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={customerId} onValueChange={(v) => { setCustomerId(v ?? ""); setSelectedPrinterIds([]); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o cliente">
                      {(v: string) => (v ? customers?.data.find((c) => c.id === v)?.tradeName || customers?.data.find((c) => c.id === v)?.legalName || v : "Selecione o cliente")}
                    </SelectValue>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="billingDay">Dia de início de faturamento *</Label>
                  <Input id="billingDay" type="number" min="1" max="28" required value={billingDay} onChange={(e) => setBillingDay(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Início do contrato *</Label>
                  <div className="flex gap-2">
                    <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v ?? startMonth))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue>{() => MONTH_NAMES[startMonth - 1]}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {MONTH_NAMES.map((name, i) => (
                          <SelectItem key={name} value={String(i + 1)}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="w-20" type="number" value={startYear} onChange={(e) => setStartYear(Number(e.target.value) || startYear)} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Fim do contrato</Label>
                <div className="flex flex-wrap items-center gap-2">
                  <Select disabled={indeterminate} value={String(endMonth)} onValueChange={(v) => setEndMonth(Number(v ?? endMonth))}>
                    <SelectTrigger className="w-40">
                      <SelectValue>{() => MONTH_NAMES[endMonth - 1]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {MONTH_NAMES.map((name, i) => (
                        <SelectItem key={name} value={String(i + 1)}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input className="w-24" type="number" disabled={indeterminate} value={endYear} onChange={(e) => setEndYear(Number(e.target.value) || endYear)} />
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Checkbox checked={indeterminate} onCheckedChange={(v) => setIndeterminate(v === true)} />
                    Contrato por tempo indeterminado
                  </label>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Custos</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="monthlyFee">Mensalidade (R$) *</Label>
                  <Input id="monthlyFee" type="number" step="0.01" min="0" required value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Custo por página</Label>
                <div className="grid grid-cols-3 gap-4">
                  <Input type="number" step="0.0001" min="0" placeholder="P&B" value={defaultPriceBw} onChange={(e) => setDefaultPriceBw(e.target.value)} />
                  <Input type="number" step="0.0001" min="0" placeholder="Colorida" value={defaultPriceColor} onChange={(e) => setDefaultPriceColor(e.target.value)} />
                  <Input type="number" step="0.0001" min="0" placeholder="Digitalização" value={defaultPriceScan} onChange={(e) => setDefaultPriceScan(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Franquia</Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input type="number" min="0" placeholder="Páginas na franquia" value={franchisePages} onChange={(e) => setFranchisePages(e.target.value)} />
                  <Input type="number" step="0.0001" min="0" placeholder="Valor excedente (R$/página)" value={overagePriceBw} onChange={(e) => setOveragePriceBw(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground">Tabela de faixas de páginas</Label>
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
                    <span>
                      {tier.fromPage} – {tier.toPage || "sem limite"} páginas × R$ {tier.pricePerPage}
                    </span>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="flex flex-wrap items-end gap-2">
                  <Input className="w-24" type="number" min="0" placeholder="De" value={newTierFrom} onChange={(e) => setNewTierFrom(e.target.value)} />
                  <Input className="w-24" type="number" min="0" placeholder="Até (opcional)" value={newTierTo} onChange={(e) => setNewTierTo(e.target.value)} />
                  <Input className="w-28" type="number" step="0.0001" min="0" placeholder="R$/página" value={newTierPrice} onChange={(e) => setNewTierPrice(e.target.value)} />
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTierRow} disabled={!newTierFrom || !newTierPrice}>
                    <Plus className="mr-1 h-4 w-4" />
                    Adicionar faixa
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Impressoras</h3>
              {!customerId && <p className="text-sm text-muted-foreground">Selecione um cliente para ver as impressoras disponíveis.</p>}
              {customerId && (printers?.data.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">Nenhuma impressora monitorada para este cliente.</p>}
              <div className="space-y-2">
                {printers?.data.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedPrinterIds.includes(p.id)}
                      onCheckedChange={(v) =>
                        setSelectedPrinterIds((prev) => (v === true ? [...prev, p.id] : prev.filter((id) => id !== p.id)))
                      }
                    />
                    {p.manufacturer} {p.model} ({p.ip})
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Custos fixos adicionais</h3>
              {fixedCosts.map((cost, i) => (
                <div key={i} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
                  <span>{cost.label}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">R$ {cost.amount}</span>
                    <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => setFixedCosts((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-2">
                <Input className="flex-1 min-w-[160px]" placeholder="Descrição" value={newCostLabel} onChange={(e) => setNewCostLabel(e.target.value)} />
                <Input className="w-32" type="number" step="0.01" min="0" placeholder="Valor (R$)" value={newCostAmount} onChange={(e) => setNewCostAmount(e.target.value)} />
                <Button type="button" variant="outline" size="sm" onClick={handleAddCostRow} disabled={!newCostLabel.trim() || !newCostAmount}>
                  <Plus className="mr-1 h-4 w-4" />
                  Adicionar
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={!customerId || !monthlyFee || saving}>
              {saving ? "Salvando..." : "Criar contrato"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
