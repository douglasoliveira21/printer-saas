"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteLocation, useUpdateLocation } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Location } from "@/lib/types";

export function LocationCard({ location, customerId }: { location: Location; customerId: string }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [name, setName] = useState(location.name);
  const [address, setAddress] = useState(location.address ?? "");
  const [contactName, setContactName] = useState(location.contactName ?? "");
  const [contactPhone, setContactPhone] = useState(location.contactPhone ?? "");
  const [slaHours, setSlaHours] = useState(location.slaHours?.toString() ?? "");

  const updateLocation = useUpdateLocation();
  const deleteLocation = useDeleteLocation();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updateLocation.mutateAsync({
        id: location.id,
        customerId,
        name,
        address: address || undefined,
        contactName: contactName || undefined,
        contactPhone: contactPhone || undefined,
        slaHours: slaHours ? Number(slaHours) : undefined,
      });
      toast.success("Local atualizado");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar local"));
    }
  }

  async function handleDelete() {
    try {
      await deleteLocation.mutateAsync({ id: location.id, customerId });
      toast.success("Local excluído");
      setDeleting(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir local"));
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <MapPin className="h-4 w-4 text-neutral-400" />
          <CardTitle className="flex-1 text-base">{location.name}</CardTitle>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600" onClick={() => setDeleting(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-neutral-500">
          <p>{location.address || "Endereço não informado"}</p>
          {location.contactName && <p>Responsável: {location.contactName}</p>}
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Editar local</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Endereço</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Responsável</Label>
                  <Input id="contactName" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Telefone</Label>
                  <Input id="contactPhone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="slaHours">SLA (horas) — sobrescreve o do cliente</Label>
                <Input
                  id="slaHours"
                  type="number"
                  min={0}
                  value={slaHours}
                  onChange={(e) => setSlaHours(e.target.value)}
                  placeholder="Herdado do cliente"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateLocation.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir local</DialogTitle>
            <DialogDescription>Tem certeza que quer excluir &quot;{location.name}&quot;?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteLocation.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
