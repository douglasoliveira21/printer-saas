"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useAddContractFixedCost,
  useRemoveContractFixedCost,
  useRemoveContractPrinter,
  useUpdateContract,
  useUpdateContractPrinter,
} from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Contract } from "@/lib/types";
import { AddContractPrinterDialog } from "./add-contract-printer-dialog";

interface PrinterPriceForm {
  priceBw: string;
  priceColor: string;
  priceScan: string;
  fixedCost: string;
}

function toFormValue(value: string | null) {
  return value ?? "";
}

export function OverviewTab({ contract }: { contract: Contract }) {
  const [monthlyFee, setMonthlyFee] = useState(contract.monthlyFee);
  const [defaultPriceBw, setDefaultPriceBw] = useState(toFormValue(contract.defaultPriceBw));
  const [defaultPriceColor, setDefaultPriceColor] = useState(toFormValue(contract.defaultPriceColor));
  const [defaultPriceScan, setDefaultPriceScan] = useState(toFormValue(contract.defaultPriceScan));
  const [printerPrices, setPrinterPrices] = useState<Record<string, PrinterPriceForm>>({});
  const [newCostLabel, setNewCostLabel] = useState("");
  const [newCostAmount, setNewCostAmount] = useState("");

  const updateContract = useUpdateContract();
  const updateContractPrinter = useUpdateContractPrinter();
  const removeContractPrinter = useRemoveContractPrinter();
  const addFixedCost = useAddContractFixedCost();
  const removeFixedCost = useRemoveContractFixedCost();

  const [prevContract, setPrevContract] = useState(contract);

  function resetFromServer() {
    setMonthlyFee(contract.monthlyFee);
    setDefaultPriceBw(toFormValue(contract.defaultPriceBw));
    setDefaultPriceColor(toFormValue(contract.defaultPriceColor));
    setDefaultPriceScan(toFormValue(contract.defaultPriceScan));
    setPrinterPrices(
      Object.fromEntries(
        (contract.contractPrinters ?? []).map((cp) => [
          cp.id,
          { priceBw: toFormValue(cp.priceBw), priceColor: toFormValue(cp.priceColor), priceScan: toFormValue(cp.priceScan), fixedCost: cp.fixedCost },
        ]),
      ),
    );
  }

  if (contract !== prevContract) {
    setPrevContract(contract);
    resetFromServer();
  }

  const dirty =
    monthlyFee !== contract.monthlyFee ||
    defaultPriceBw !== toFormValue(contract.defaultPriceBw) ||
    defaultPriceColor !== toFormValue(contract.defaultPriceColor) ||
    defaultPriceScan !== toFormValue(contract.defaultPriceScan) ||
    (contract.contractPrinters ?? []).some((cp) => {
      const form = printerPrices[cp.id];
      if (!form) return false;
      return (
        form.priceBw !== toFormValue(cp.priceBw) ||
        form.priceColor !== toFormValue(cp.priceColor) ||
        form.priceScan !== toFormValue(cp.priceScan) ||
        form.fixedCost !== cp.fixedCost
      );
    });

  async function handleSave() {
    try {
      await updateContract.mutateAsync({
        id: contract.id,
        monthlyFee: Number(monthlyFee),
        defaultPriceBw: defaultPriceBw ? Number(defaultPriceBw) : undefined,
        defaultPriceColor: defaultPriceColor ? Number(defaultPriceColor) : undefined,
        defaultPriceScan: defaultPriceScan ? Number(defaultPriceScan) : undefined,
      });

      for (const cp of contract.contractPrinters ?? []) {
        const form = printerPrices[cp.id];
        if (!form) continue;
        const changed =
          form.priceBw !== toFormValue(cp.priceBw) ||
          form.priceColor !== toFormValue(cp.priceColor) ||
          form.priceScan !== toFormValue(cp.priceScan) ||
          form.fixedCost !== cp.fixedCost;
        if (!changed) continue;
        await updateContractPrinter.mutateAsync({
          contractId: contract.id,
          contractPrinterId: cp.id,
          priceBw: form.priceBw ? Number(form.priceBw) : undefined,
          priceColor: form.priceColor ? Number(form.priceColor) : undefined,
          priceScan: form.priceScan ? Number(form.priceScan) : undefined,
          fixedCost: form.fixedCost ? Number(form.fixedCost) : undefined,
        });
      }

      toast.success("Contrato salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar contrato"));
    }
  }

  async function handleRemovePrinter(contractPrinterId: string) {
    try {
      await removeContractPrinter.mutateAsync({ contractId: contract.id, contractPrinterId });
      toast.success("Impressora removida do contrato");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover impressora"));
    }
  }

  async function handleAddFixedCost() {
    if (!newCostLabel.trim() || !newCostAmount) return;
    try {
      await addFixedCost.mutateAsync({ contractId: contract.id, label: newCostLabel.trim(), amount: Number(newCostAmount) });
      setNewCostLabel("");
      setNewCostAmount("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao adicionar custo fixo"));
    }
  }

  async function handleRemoveFixedCost(costId: string) {
    try {
      await removeFixedCost.mutateAsync({ contractId: contract.id, costId });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover custo fixo"));
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custo por página</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="monthlyFee">Mensalidade (R$)</Label>
            <Input id="monthlyFee" type="number" step="0.01" min="0" value={monthlyFee} onChange={(e) => setMonthlyFee(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPriceBw">Custo padrão P&B (R$/página)</Label>
            <Input id="defaultPriceBw" type="number" step="0.0001" min="0" value={defaultPriceBw} onChange={(e) => setDefaultPriceBw(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPriceColor">Custo padrão colorida (R$/página)</Label>
            <Input id="defaultPriceColor" type="number" step="0.0001" min="0" value={defaultPriceColor} onChange={(e) => setDefaultPriceColor(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="defaultPriceScan">Custo padrão digitalização (R$)</Label>
            <Input id="defaultPriceScan" type="number" step="0.0001" min="0" value={defaultPriceScan} onChange={(e) => setDefaultPriceScan(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Impressoras vinculadas</h3>
          <AddContractPrinterDialog contract={contract} />
        </div>
        <Card className="overflow-hidden py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fabricante</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Número de série</TableHead>
                <TableHead>Custo P&B</TableHead>
                <TableHead>Custo colorida</TableHead>
                <TableHead>Custo digitação</TableHead>
                <TableHead>Custo fixo</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(contract.contractPrinters ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Nenhuma impressora vinculada ainda.
                  </TableCell>
                </TableRow>
              )}
              {(contract.contractPrinters ?? []).map((cp) => {
                const form = printerPrices[cp.id] ?? { priceBw: "", priceColor: "", priceScan: "", fixedCost: "0" };
                return (
                  <TableRow key={cp.id}>
                    <TableCell>{cp.printer.manufacturer || "—"}</TableCell>
                    <TableCell>{cp.printer.model || "—"}</TableCell>
                    <TableCell>{cp.printer.serial || "—"}</TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="Padrão"
                        value={form.priceBw}
                        onChange={(e) => setPrinterPrices((prev) => ({ ...prev, [cp.id]: { ...form, priceBw: e.target.value } }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="Padrão"
                        value={form.priceColor}
                        onChange={(e) => setPrinterPrices((prev) => ({ ...prev, [cp.id]: { ...form, priceColor: e.target.value } }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.0001"
                        min="0"
                        placeholder="Padrão"
                        value={form.priceScan}
                        onChange={(e) => setPrinterPrices((prev) => ({ ...prev, [cp.id]: { ...form, priceScan: e.target.value } }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        className="w-24"
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.fixedCost}
                        onChange={(e) => setPrinterPrices((prev) => ({ ...prev, [cp.id]: { ...form, fixedCost: e.target.value } }))}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemovePrinter(cp.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold">Custos fixos adicionais</h3>
        <Card>
          <CardContent className="space-y-3 py-4">
            {(contract.fixedCosts ?? []).map((fc) => (
              <div key={fc.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
                <span>{fc.label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium">{Number(fc.amount).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveFixedCost(fc.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[160px] flex-1 space-y-2">
                <Label htmlFor="newCostLabel">Descrição</Label>
                <Input id="newCostLabel" value={newCostLabel} onChange={(e) => setNewCostLabel(e.target.value)} placeholder="Ex: Taxa de instalação" />
              </div>
              <div className="w-32 space-y-2">
                <Label htmlFor="newCostAmount">Valor (R$)</Label>
                <Input id="newCostAmount" type="number" step="0.01" min="0" value={newCostAmount} onChange={(e) => setNewCostAmount(e.target.value)} />
              </div>
              <Button variant="outline" onClick={handleAddFixedCost} disabled={!newCostLabel.trim() || !newCostAmount}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={resetFromServer} disabled={!dirty}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={!dirty || updateContract.isPending}>
          {updateContract.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
