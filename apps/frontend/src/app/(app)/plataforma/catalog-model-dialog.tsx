"use client";

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  useCreateCatalogModel,
  useUpdateCatalogModel,
  type CatalogModelInput,
  type CatalogTriState,
  type PrinterCatalogModel,
} from "@/hooks/use-printer-catalog";

const CAPABILITY_LABEL: Record<keyof PrinterCatalogModel["capabilities"], string> = {
  color: "Colorida",
  duplex: "Duplex de impressão",
  a3: "A3",
  copy: "Cópia",
  scan: "Scanner",
  fax: "Fax",
};

const TRISTATE_LABEL: Record<string, string> = { true: "Sim", false: "Não", null: "A confirmar" };

function TriStateSelect({ value, onChange }: { value: CatalogTriState; onChange: (v: CatalogTriState) => void }) {
  const asString = value === null || value === undefined ? "null" : String(value);
  return (
    <Select value={asString} onValueChange={(v) => onChange(v === "null" ? null : v === "true")}>
      <SelectTrigger className="w-full">
        <SelectValue>{(v: string) => TRISTATE_LABEL[v]}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="true">Sim</SelectItem>
        <SelectItem value="false">Não</SelectItem>
        <SelectItem value="null">A confirmar</SelectItem>
      </SelectContent>
    </Select>
  );
}

const EMPTY: CatalogModelInput = {
  manufacturer: "",
  model: "",
  family: null,
  deviceType: "PRINTER",
  capabilities: { color: null, duplex: null, a3: null, copy: null, scan: null, fax: null },
  confidence: "BAIXA",
  status: "A_CONFIRMAR",
  sourcePrimary: null,
  sourcesSecondary: null,
  notes: null,
};

export function CatalogModelDialog({
  model,
  open,
  onOpenChange,
}: {
  model: PrinterCatalogModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [form, setForm] = useState<CatalogModelInput>(EMPTY);
  const createModel = useCreateCatalogModel();
  const updateModel = useUpdateCatalogModel();
  const isEditing = !!model;
  const pending = createModel.isPending || updateModel.isPending;

  useEffect(() => {
    if (open) {
      setForm(model ? { ...model } : EMPTY);
    }
  }, [open, model]);

  function patch(update: Partial<CatalogModelInput>) {
    setForm((prev) => ({ ...prev, ...update }));
  }

  function patchCapability(key: keyof PrinterCatalogModel["capabilities"], value: CatalogTriState) {
    setForm((prev) => ({ ...prev, capabilities: { ...prev.capabilities, [key]: value } }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    try {
      if (isEditing) {
        await updateModel.mutateAsync({ id: model!.id, ...form });
        toast.success("Modelo atualizado");
      } else {
        await createModel.mutateAsync(form);
        toast.success("Modelo cadastrado no catálogo");
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar modelo"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar modelo" : "Novo modelo no catálogo"}</DialogTitle>
            <DialogDescription>
              Só marque Sim/Não quando houver confirmação (documentação do fabricante, teste real). Sem certeza, deixe
              &quot;A confirmar&quot;.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fabricante *</Label>
                <Input required value={form.manufacturer} onChange={(e) => patch({ manufacturer: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Modelo *</Label>
                <Input required value={form.model} onChange={(e) => patch({ model: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Família</Label>
                <Input value={form.family ?? ""} onChange={(e) => patch({ family: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.deviceType} onValueChange={(v) => v && patch({ deviceType: v as CatalogModelInput["deviceType"] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => ({ PRINTER: "Impressora", MFP: "Multifuncional", PLOTTER: "Plotter" })[v]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRINTER">Impressora</SelectItem>
                    <SelectItem value="MFP">Multifuncional</SelectItem>
                    <SelectItem value="PLOTTER">Plotter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Confiança</Label>
                <Select value={form.confidence} onValueChange={(v) => v && patch({ confidence: v as CatalogModelInput["confidence"] })}>
                  <SelectTrigger className="w-full">
                    <SelectValue>{(v: string) => ({ ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" })[v]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold">Capacidades</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {(Object.keys(CAPABILITY_LABEL) as (keyof PrinterCatalogModel["capabilities"])[]).map((key) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{CAPABILITY_LABEL[key]}</Label>
                    <TriStateSelect value={form.capabilities[key] ?? null} onChange={(v) => patchCapability(key, v)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fonte principal (URL)</Label>
                <Input value={form.sourcePrimary ?? ""} onChange={(e) => patch({ sourcePrimary: e.target.value || null })} />
              </div>
              <div className="space-y-2">
                <Label>Fontes secundárias</Label>
                <Input value={form.sourcesSecondary ?? ""} onChange={(e) => patch({ sourcesSecondary: e.target.value || null })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes ?? ""} onChange={(e) => patch({ notes: e.target.value || null })} />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
