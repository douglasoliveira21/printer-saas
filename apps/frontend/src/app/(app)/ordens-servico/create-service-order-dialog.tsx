"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { usePrinters } from "@/hooks/use-printers";
import { useCreateServiceOrder, useAddServiceOrderPart } from "@/hooks/use-service-orders";
import { useServiceOrderTypes } from "@/hooks/use-service-order-types";
import { useTenantUsers } from "@/hooks/use-users";
import { useAlerts } from "@/hooks/use-alerts";
import { useInventoryItems } from "@/hooks/use-inventory";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrderPriority } from "@/lib/types";
import { PRIORITY_LABEL, STATUS_LABEL } from "./[id]/labels";

const PRIORITY_OPTIONS: ServiceOrderPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const CREATE_STATUS_OPTIONS: ("OPEN" | "SCHEDULED")[] = ["OPEN", "SCHEDULED"];

interface LineItem {
  key: string;
  inventoryItemId: string;
  name: string;
  quantity: string;
  unitValue: string;
}

function emptyLine(): LineItem {
  return { key: crypto.randomUUID(), inventoryItemId: "", name: "", quantity: "1", unitValue: "" };
}

export function CreateServiceOrderDialog() {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [serviceOrderTypeCatalogId, setServiceOrderTypeCatalogId] = useState("");
  const [technicianId, setTechnicianId] = useState("");
  const [status, setStatus] = useState<"OPEN" | "SCHEDULED">("OPEN");
  const [priority, setPriority] = useState<ServiceOrderPriority>("MEDIUM");
  const [arrivedAt, setArrivedAt] = useState("");
  const [departedAt, setDepartedAt] = useState("");
  const [description, setDescription] = useState("");
  const [alertId, setAlertId] = useState("");
  const [laborCost, setLaborCost] = useState("");
  const [travelCost, setTravelCost] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);

  const { data: customers } = useCustomers();
  const { data: customer } = useCustomer(customerId || undefined);
  const { data: printers } = usePrinters({ customerId: customerId || undefined });
  const { data: types } = useServiceOrderTypes();
  const { data: users } = useTenantUsers();
  const { data: printerAlerts } = useAlerts("OPEN", printerId || undefined);
  const { data: inventoryItems } = useInventoryItems();
  const createServiceOrder = useCreateServiceOrder();
  const addPart = useAddServiceOrderPart();

  function reset() {
    setTitle("");
    setCustomerId("");
    setLocationId("");
    setPrinterId("");
    setServiceOrderTypeCatalogId("");
    setTechnicianId("");
    setStatus("OPEN");
    setPriority("MEDIUM");
    setArrivedAt("");
    setDepartedAt("");
    setDescription("");
    setAlertId("");
    setLaborCost("");
    setTravelCost("");
    setLines([]);
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function updateLine(key: string, patch: Partial<LineItem>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.inventoryItemId !== undefined) {
          const item = inventoryItems?.find((i) => i.id === patch.inventoryItemId);
          if (item) {
            next.name = item.name;
            next.unitValue = item.salePrice !== null ? String(item.salePrice) : next.unitValue;
          }
        }
        return next;
      }),
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      const order = await createServiceOrder.mutateAsync({
        title,
        customerId,
        locationId: locationId || undefined,
        printerId: printerId || undefined,
        technicianId: technicianId || undefined,
        serviceOrderTypeCatalogId: serviceOrderTypeCatalogId || undefined,
        status,
        priority,
        arrivedAt: arrivedAt ? new Date(arrivedAt).toISOString() : undefined,
        departedAt: departedAt ? new Date(departedAt).toISOString() : undefined,
        description: description || undefined,
        alertId: alertId || undefined,
        laborCost: laborCost ? Number(laborCost) : undefined,
        travelCost: travelCost ? Number(travelCost) : undefined,
      });

      for (const line of lines) {
        if (!line.name.trim() || !line.unitValue) continue;
        await addPart.mutateAsync({
          serviceOrderId: order.id,
          name: line.name.trim(),
          quantity: Number(line.quantity) || 1,
          unitValue: Number(line.unitValue),
          inventoryItemId: line.inventoryItemId || undefined,
        });
      }

      toast.success("Ordem de serviço criada");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar ordem de serviço"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) reset(); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Nova OS
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova ordem de serviço</DialogTitle>
            <DialogDescription>Registre um chamado técnico para um cliente.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[70vh] gap-4 overflow-y-auto py-4 pr-1">
            <div className="space-y-2">
              <Label htmlFor="title">Título do chamado *</Label>
              <Input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Impressora atolando papel no setor Financeiro" />
            </div>

            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v ?? ""); setLocationId(""); setPrinterId(""); }}>
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

            {customer && customer.locations.length > 0 && (
              <div className="space-y-2">
                <Label>Local</Label>
                <Select value={locationId} onValueChange={(v) => setLocationId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione (opcional)">
                      {(v: string) => (v ? customer.locations.find((l) => l.id === v)?.name || v : "Selecione (opcional)")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {customer.locations.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de chamado</Label>
              <Select value={serviceOrderTypeCatalogId} onValueChange={(v) => setServiceOrderTypeCatalogId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo de chamado">
                    {(v: string) => (v ? types?.find((t) => t.id === v)?.name || v : "Selecione o tipo de chamado")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {types?.filter((t) => t.active).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {customerId && printers && printers.data.length > 0 && (
              <div className="space-y-2">
                <Label>Impressora</Label>
                <Select value={printerId} onValueChange={(v) => { setPrinterId(v ?? ""); setAlertId(""); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione (opcional) — caso seja manutenção em uma impressora específica">
                      {(v: string) => {
                        if (!v) return "Selecione (opcional) — caso seja manutenção em uma impressora específica";
                        const p = printers?.data.find((printer) => printer.id === v);
                        return p ? `${p.manufacturer} ${p.model} (${p.ip})` : v;
                      }}
                    </SelectValue>
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

            {printerId && printerAlerts && printerAlerts.length > 0 && (
              <div className="space-y-2">
                <Label>Alerta relacionado</Label>
                <Select value={alertId} onValueChange={(v) => setAlertId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Vincular um alerta em aberto desta impressora (opcional)">
                      {(v: string) => (v ? printerAlerts?.find((a) => a.id === v)?.message || v : "Vincular um alerta em aberto desta impressora (opcional)")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {printerAlerts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.message}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Técnico responsável</Label>
                <Select value={technicianId} onValueChange={(v) => setTechnicianId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Não atribuído">
                      {(v: string) => (v ? users?.find((u) => u.id === v)?.name || v : "Não atribuído")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Situação do chamado</Label>
                <Select value={status} onValueChange={(v) => setStatus((v ?? "OPEN") as "OPEN" | "SCHEDULED")}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: "OPEN" | "SCHEDULED") => STATUS_LABEL[v]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CREATE_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority((v ?? "MEDIUM") as ServiceOrderPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(v: ServiceOrderPriority) => PRIORITY_LABEL[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="arrivedAt">Início do atendimento</Label>
                <Input id="arrivedAt" type="datetime-local" value={arrivedAt} onChange={(e) => setArrivedAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="departedAt">Fim do atendimento</Label>
                <Input id="departedAt" type="datetime-local" value={departedAt} onChange={(e) => setDepartedAt(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição do atendimento</Label>
              <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Serviços e itens de estoque</Label>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item de estoque</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Qtd.</TableHead>
                    <TableHead>Valor unit.</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lines.map((line) => (
                    <TableRow key={line.key}>
                      <TableCell>
                        <Select value={line.inventoryItemId} onValueChange={(v) => updateLine(line.key, { inventoryItemId: v ?? "" })}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Serviço avulso">
                              {(v: string) => (v ? inventoryItems?.find((item) => item.id === v)?.name || v : "Serviço avulso")}
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
                        <Input placeholder="Descrição" value={line.name} onChange={(e) => updateLine(line.key, { name: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input className="w-20" type="number" min="1" value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input className="w-28" type="number" step="0.01" min="0" value={line.unitValue} onChange={(e) => updateLine(line.key, { unitValue: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => removeLine(line.key)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Button type="button" size="sm" variant="outline" onClick={addLine}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar serviço/item
              </Button>
            </div>

            <div className="space-y-2">
              <Label>Custos adicionais</Label>
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" step="0.01" min="0" placeholder="Mão de obra (R$)" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} />
                <Input type="number" step="0.01" min="0" placeholder="Deslocamento (R$)" value={travelCost} onChange={(e) => setTravelCost(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!title.trim() || !customerId || createServiceOrder.isPending}>
              {createServiceOrder.isPending ? "Salvando..." : "Criar OS"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
