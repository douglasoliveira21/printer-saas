"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCreateInventoryItem } from "@/hooks/use-inventory";
import { getApiErrorMessage } from "@/lib/api-client";
import { TYPE_OPTIONS } from "./inventory-types";

const MANUFACTURER_OPTIONS = [
  "HP", "Brother", "Epson", "Canon", "Ricoh", "Kyocera", "Xerox", "Lexmark",
  "Samsung", "Konica Minolta", "OKI", "Sharp", "Toshiba", "Panasonic", "Outra",
];

export function CreateItemDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("");
  const [code, setCode] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [manufacturerOther, setManufacturerOther] = useState("");
  const [model, setModel] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [color, setColor] = useState("");
  const [standardLifespanPages, setStandardLifespanPages] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");
  const createItem = useCreateInventoryItem();

  function reset() {
    setType("");
    setCode("");
    setManufacturer("");
    setManufacturerOther("");
    setModel("");
    setQuantity("0");
    setColor("");
    setStandardLifespanPages("");
    setCostPrice("");
    setSalePrice("");
    setNotes("");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const resolvedManufacturer = manufacturer === "Outra" ? manufacturerOther.trim() : manufacturer;
    const typeLabel = TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type;
    const name = [resolvedManufacturer, model].filter(Boolean).join(" ") || `${typeLabel} ${model}`;

    try {
      await createItem.mutateAsync({
        name,
        type,
        code: code || undefined,
        manufacturer: resolvedManufacturer || undefined,
        model,
        color: color || undefined,
        standardLifespanPages: standardLifespanPages ? Number(standardLifespanPages) : undefined,
        costPrice: costPrice ? Number(costPrice) : undefined,
        salePrice: salePrice ? Number(salePrice) : undefined,
        notes: notes || undefined,
        quantity: Number(quantity) || 0,
      });
      toast.success("Item cadastrado");
      reset();
      setOpen(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao cadastrar item"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger render={<Button />}>
        <Plus className="mr-2 h-4 w-4" />
        Novo item
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Novo item de estoque</DialogTitle>
            <DialogDescription>Toner, cartucho, cilindro, peça, etc.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select value={type} onValueChange={(v) => v && setType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione o tipo de suprimento/peça" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Código do suprimento</Label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Marca</Label>
              <Select value={manufacturer} onValueChange={(v) => v && setManufacturer(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione a marca do suprimento/peça" />
                </SelectTrigger>
                <SelectContent>
                  {MANUFACTURER_OPTIONS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {manufacturer === "Outra" && (
                <Input
                  placeholder="Digite a marca"
                  value={manufacturerOther}
                  onChange={(e) => setManufacturerOther(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Modelo do suprimento *</Label>
              <Input id="model" required placeholder="Ex.: TN650" value={model} onChange={(e) => setModel(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade no estoque da sua empresa</Label>
              <Input id="quantity" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Cor</Label>
              <Input id="color" placeholder="Ex.: preto, ciano, magenta, amarelo" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="standardLifespanPages">Vida útil padrão (páginas)</Label>
              <Input
                id="standardLifespanPages"
                type="number"
                min="0"
                value={standardLifespanPages}
                onChange={(e) => setStandardLifespanPages(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="costPrice">Preço de custo (R$)</Label>
                <Input id="costPrice" type="number" step="0.01" min="0" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Preço de venda (R$)</Label>
                <Input id="salePrice" type="number" step="0.01" min="0" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observação</Label>
              <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={!type || !model || createItem.isPending}>
              {createItem.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
