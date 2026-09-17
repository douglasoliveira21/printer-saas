"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCustomer, useCustomers } from "@/hooks/use-customers";
import { useClaimPrinter } from "@/hooks/use-printers";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Printer } from "@/lib/types";

export function ClaimPrinterDialog({ printer, onClose }: { printer: Printer; onClose: () => void }) {
  const [customerId, setCustomerId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const { data: customers } = useCustomers();
  const { data: customer } = useCustomer(customerId || undefined);
  const claimPrinter = useClaimPrinter();

  async function handleConfirm() {
    if (!customerId) return;
    try {
      await claimPrinter.mutateAsync({ id: printer.id, customerId, locationId: locationId || undefined });
      toast.success("Impressora adicionada ao cliente");
      onClose();
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao vincular impressora"));
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar às minhas impressoras</DialogTitle>
          <DialogDescription>
            {printer.manufacturer} {printer.model} — {printer.ip || printer.serial}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Cliente *</Label>
            <Select
              value={customerId}
              onValueChange={(value) => {
                setCustomerId(value ?? "");
                setLocationId("");
              }}
            >
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
              <Select value={locationId} onValueChange={(value) => setLocationId(value ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o local (opcional)" />
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
        </div>

        <DialogFooter>
          <Button onClick={handleConfirm} disabled={!customerId || claimPrinter.isPending}>
            {claimPrinter.isPending ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
