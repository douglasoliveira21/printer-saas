"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
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
import { useUpdatePrinter } from "@/hooks/use-printers";
import { useSnmpCredentials } from "@/hooks/use-snmp-credentials";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Printer } from "@/lib/types";

const NO_CREDENTIAL = "__none__";

export function EditPrinterDialog({ printer }: { printer: Printer }) {
  const [open, setOpen] = useState(false);
  const [manufacturer, setManufacturer] = useState(printer.manufacturer ?? "");
  const [model, setModel] = useState(printer.model ?? "");
  const [slaHours, setSlaHours] = useState(printer.slaHours?.toString() ?? "");
  const [collectionMethod, setCollectionMethod] = useState<"SNMP" | "MANUAL">(printer.collectionMethod);
  const [snmpV3CredentialId, setSnmpV3CredentialId] = useState(printer.snmpV3CredentialId ?? NO_CREDENTIAL);
  const updatePrinter = useUpdatePrinter();
  const { data: credentials } = useSnmpCredentials();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updatePrinter.mutateAsync({
        id: printer.id,
        manufacturer: manufacturer || undefined,
        model: model || undefined,
        slaHours: slaHours ? Number(slaHours) : undefined,
        collectionMethod,
        snmpV3CredentialId: snmpV3CredentialId === NO_CREDENTIAL ? null : snmpV3CredentialId,
      });
      toast.success("Impressora atualizada");
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar impressora"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <Pencil className="mr-2 h-4 w-4" />
        Editar
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>Editar impressora</DialogTitle>
            <DialogDescription>Corrija fabricante/modelo se o que o SNMP reportou não estiver correto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Fabricante</Label>
              <Input id="manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Modelo</Label>
              <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slaHours">SLA (horas) — sobrescreve o padrão do cliente/contrato</Label>
              <Input
                id="slaHours"
                type="number"
                min={0}
                value={slaHours}
                onChange={(e) => setSlaHours(e.target.value)}
                placeholder="Herdado do cliente/contrato"
              />
            </div>
            <div className="space-y-2">
              <Label>Origem da coleta</Label>
              <Select value={collectionMethod} onValueChange={(v) => setCollectionMethod((v ?? "SNMP") as "SNMP" | "MANUAL")}>
                <SelectTrigger className="w-full">
                  <SelectValue>{(value: "SNMP" | "MANUAL") => (value === "SNMP" ? "SNMP (automática)" : "Manual")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SNMP">SNMP (automática)</SelectItem>
                  <SelectItem value="MANUAL">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Credencial SNMP v3</Label>
              <Select value={snmpV3CredentialId} onValueChange={(v) => v && setSnmpV3CredentialId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) => (value === NO_CREDENTIAL ? "Sem override (usa v1/v2c ou padrão do Agent)" : credentials?.find((c) => c.id === value)?.name)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CREDENTIAL}>Sem override (usa v1/v2c ou padrão do Agent)</SelectItem>
                  {credentials?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={updatePrinter.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
