"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
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
import { useCreateServiceOrder } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Alert, ServiceOrderPriority } from "@/lib/types";

const PRIORITY_OPTIONS: { value: ServiceOrderPriority; label: string }[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

function defaultPriorityForLevel(level: Alert["level"]): ServiceOrderPriority {
  if (level === "CRITICAL") return "URGENT";
  if (level === "WARNING") return "MEDIUM";
  return "LOW";
}

export function CreateServiceOrderFromAlertDialog({ alert }: { alert: Alert }) {
  const [open, setOpen] = useState(false);
  const [priority, setPriority] = useState<ServiceOrderPriority>(defaultPriorityForLevel(alert.level));
  const [description, setDescription] = useState(alert.message);
  const createServiceOrder = useCreateServiceOrder();

  const customerId = alert.printer?.customer?.id;
  if (!customerId) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      await createServiceOrder.mutateAsync({
        customerId: customerId!,
        printerId: alert.printer?.id,
        priority,
        description,
      });
      toast.success("Chamado criado");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar chamado"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Wrench className="mr-2 h-4 w-4" />
        Gerar chamado
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Gerar chamado a partir do alerta</DialogTitle>
            <DialogDescription>Cria uma ordem de serviço para {alert.printer?.customer?.legalName}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={(v) => setPriority((v ?? "MEDIUM") as ServiceOrderPriority)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: ServiceOrderPriority) => PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value}</SelectValue>
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
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={createServiceOrder.isPending}>
              {createServiceOrder.isPending ? "Criando..." : "Criar chamado"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
