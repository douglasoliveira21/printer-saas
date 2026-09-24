"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAddServiceOrderPart, useRemoveServiceOrderPart, useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { useInventoryItems } from "@/hooks/use-inventory";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder, ServiceOrderBillingType } from "@/lib/types";
import { BILLING_TYPE_LABEL } from "./labels";

function currency(value: number | string | null) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function PartsSection({ order }: { order: ServiceOrder }) {
  const [inventoryItemId, setInventoryItemId] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitValue, setUnitValue] = useState("");
  const [laborCost, setLaborCost] = useState(order.laborCost ?? "");
  const [travelCost, setTravelCost] = useState(order.travelCost ?? "");
  const [billingType, setBillingType] = useState<ServiceOrderBillingType | "">(order.billingType ?? "");

  const addPart = useAddServiceOrderPart();
  const removePart = useRemoveServiceOrderPart();
  const updateOrder = useUpdateServiceOrder();
  const { data: inventoryItems } = useInventoryItems();

  const parts = order.parts ?? [];
  const materialsTotal = parts.reduce((sum, p) => sum + p.quantity * Number(p.unitValue), 0);
  const total = materialsTotal + Number(laborCost || 0) + Number(travelCost || 0);
  const costsDirty = String(laborCost) !== (order.laborCost ?? "") || String(travelCost) !== (order.travelCost ?? "") || billingType !== (order.billingType ?? "");

  // Selecionar um item do estoque prefila nome e valor unitário com o preço
  // de venda cadastrado (Estoque > Novo item) — o técnico ainda pode ajustar
  // antes de adicionar, e uma linha sem item selecionado continua sendo um
  // serviço avulso digitado na hora, como antes.
  function handleSelectInventoryItem(id: string) {
    setInventoryItemId(id);
    const item = inventoryItems?.find((i) => i.id === id);
    if (item) {
      setName(item.name);
      setUnitValue(item.salePrice !== null ? String(item.salePrice) : "");
    }
  }

  async function handleAddPart() {
    if (!name.trim() || !unitValue) return;
    try {
      await addPart.mutateAsync({
        serviceOrderId: order.id,
        name: name.trim(),
        quantity: Number(quantity),
        unitValue: Number(unitValue),
        inventoryItemId: inventoryItemId || undefined,
      });
      setInventoryItemId("");
      setName("");
      setQuantity("1");
      setUnitValue("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao adicionar peça"));
    }
  }

  async function handleRemovePart(partId: string) {
    try {
      await removePart.mutateAsync({ serviceOrderId: order.id, partId });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover peça"));
    }
  }

  async function handleSaveCosts() {
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        laborCost: laborCost ? Number(laborCost) : undefined,
        travelCost: travelCost ? Number(travelCost) : undefined,
        billingType: billingType || undefined,
      });
      toast.success("Salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">4. Peças e materiais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item de estoque</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Quantidade</TableHead>
              <TableHead>Valor unit.</TableHead>
              <TableHead>Total</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {parts.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="text-muted-foreground">{p.inventoryItemId ? "Estoque" : "Avulso"}</TableCell>
                <TableCell>{p.name}</TableCell>
                <TableCell>{p.quantity}</TableCell>
                <TableCell>{currency(p.unitValue)}</TableCell>
                <TableCell className="font-medium">{currency(p.quantity * Number(p.unitValue))}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemovePart(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            <TableRow>
              <TableCell>
                <Select value={inventoryItemId} onValueChange={(v) => handleSelectInventoryItem(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Serviço avulso">
                      {(v: string) => (v ? inventoryItems?.find((i) => i.id === v)?.name || v : "Serviço avulso")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {inventoryItems?.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name} ({item.quantity} em estoque)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Input placeholder="Descrição" value={name} onChange={(e) => setName(e.target.value)} />
              </TableCell>
              <TableCell>
                <Input className="w-20" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </TableCell>
              <TableCell>
                <Input className="w-28" type="number" step="0.01" min="0" value={unitValue} onChange={(e) => setUnitValue(e.target.value)} />
              </TableCell>
              <TableCell colSpan={2}>
                <Button size="sm" variant="outline" onClick={handleAddPart} disabled={!name.trim() || !unitValue || addPart.isPending}>
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="laborCost">Mão de obra (R$)</Label>
            <Input id="laborCost" type="number" step="0.01" min="0" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="travelCost">Deslocamento (R$)</Label>
            <Input id="travelCost" type="number" step="0.01" min="0" value={travelCost} onChange={(e) => setTravelCost(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1 rounded-md border border-border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Materiais</span>
            <span>{currency(materialsTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mão de obra</span>
            <span>{currency(laborCost)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deslocamento</span>
            <span>{currency(travelCost)}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 font-semibold">
            <span>Total</span>
            <span>{currency(total)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Cobrança</Label>
          <Select value={billingType} onValueChange={(v) => setBillingType((v ?? "") as ServiceOrderBillingType)}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Selecione">{(v: ServiceOrderBillingType) => BILLING_TYPE_LABEL[v]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BILLING_TYPE_LABEL) as ServiceOrderBillingType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {BILLING_TYPE_LABEL[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSaveCosts} disabled={!costsDirty || updateOrder.isPending}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
