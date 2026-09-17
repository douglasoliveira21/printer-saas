"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { useCreateServiceOrder } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrderPriority } from "@/lib/types";

const PRIORITY_OPTIONS: { value: ServiceOrderPriority; label: string }[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

export function CreateServiceOrderDialog() {
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [priority, setPriority] = useState<ServiceOrderPriority>("MEDIUM");
  const [description, setDescription] = useState("");

  const { data: customers } = useCustomers();
  const { data: customer } = useCustomer(customerId || undefined);
  const { data: printers } = usePrinters({ customerId: customerId || undefined, status: "MONITORED" });
  const createServiceOrder = useCreateServiceOrder();

  function reset() {
    setCustomerId("");
    setLocationId("");
    setPrinterId("");
    setPriority("MEDIUM");
    setDescription("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createServiceOrder.mutateAsync({
        customerId,
        locationId: locationId || undefined,
        printerId: printerId || undefined,
        priority,
        description: description || undefined,
      });
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
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova ordem de serviço</DialogTitle>
            <DialogDescription>Registre um chamado técnico para um cliente.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Select value={customerId} onValueChange={(v) => { setCustomerId(v ?? ""); setLocationId(""); setPrinterId(""); }}>
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

            {customer && customer.locations.length > 0 && (
              <div className="space-y-2">
                <Label>Local</Label>
                <Select value={locationId} onValueChange={(v) => setLocationId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione (opcional)" />
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

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority((v ?? "MEDIUM") as ServiceOrderPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: ServiceOrderPriority) => PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição do problema</Label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!customerId || createServiceOrder.isPending}>
              {createServiceOrder.isPending ? "Salvando..." : "Criar OS"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
