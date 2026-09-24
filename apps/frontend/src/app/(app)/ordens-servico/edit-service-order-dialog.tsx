"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { useTenantUsers } from "@/hooks/use-users";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder } from "@/lib/types";

export function EditServiceOrderDialog({ order }: { order: ServiceOrder }) {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(order.description ?? "");
  const [diagnosis, setDiagnosis] = useState(order.diagnosis ?? "");
  const [solution, setSolution] = useState(order.solution ?? "");
  const [technicianId, setTechnicianId] = useState(order.technician?.id ?? "");

  const { data: users } = useTenantUsers();
  const updateOrder = useUpdateServiceOrder();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updateOrder.mutateAsync({
        id: order.id,
        description: description || undefined,
        diagnosis: diagnosis || undefined,
        solution: solution || undefined,
        technicianId: technicianId || undefined,
      });
      toast.success("Ordem de serviço atualizada");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar OS"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="icon" />}>
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Editar OS #{order.number}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Técnico responsável</Label>
              <Select value={technicianId} onValueChange={(v) => setTechnicianId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Não atribuído">
                  {(v: string) => (v ? users?.find((u) => u.id === v)?.name || v : "Não atribuído")}
                </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição do problema</Label>
              <Textarea id="description" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Diagnóstico</Label>
              <Textarea id="diagnosis" rows={2} value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="solution">Solução</Label>
              <Textarea id="solution" rows={2} value={solution} onChange={(e) => setSolution(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updateOrder.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
