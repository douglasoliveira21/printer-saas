"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Printer as PrinterIcon, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { getApiErrorMessage } from "@/lib/api-client";
import { useDeleteCatalogModel, usePrinterCatalog, type PrinterCatalogModel } from "@/hooks/use-printer-catalog";
import { CatalogModelDialog } from "./catalog-model-dialog";

const CONFIDENCE_CONFIG: Record<PrinterCatalogModel["confidence"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  ALTA: { label: "Alta", variant: "default" },
  MEDIA: { label: "Média", variant: "secondary" },
  BAIXA: { label: "Baixa", variant: "outline" },
};

const DEVICE_TYPE_LABEL: Record<PrinterCatalogModel["deviceType"], string> = {
  PRINTER: "Impressora",
  MFP: "Multifuncional",
  PLOTTER: "Plotter",
};

const STATUS_LABEL: Record<PrinterCatalogModel["status"], string> = {
  ATUAL: "Atual",
  DESCONTINUADO: "Descontinuado",
  ANTIGO: "Antigo",
  A_CONFIRMAR: "A confirmar",
};

export function PrinterCatalogTab() {
  const { data: models, isLoading } = usePrinterCatalog();
  const [editing, setEditing] = useState<PrinterCatalogModel | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PrinterCatalogModel | null>(null);
  const deleteModel = useDeleteCatalogModel();

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteModel.mutateAsync(deleteTarget.id);
      toast.success("Modelo removido do catálogo");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover modelo"));
    }
  }

  const columns: DataTableColumn<PrinterCatalogModel>[] = [
    { key: "manufacturer", header: "Fabricante", cell: (m) => m.manufacturer },
    { key: "model", header: "Modelo", cell: (m) => m.model },
    { key: "type", header: "Tipo", cell: (m) => DEVICE_TYPE_LABEL[m.deviceType], hideOnMobile: true },
    {
      key: "confidence",
      header: "Confiança",
      cell: (m) => <Badge variant={CONFIDENCE_CONFIG[m.confidence].variant}>{CONFIDENCE_CONFIG[m.confidence].label}</Badge>,
    },
    { key: "status", header: "Status", cell: (m) => STATUS_LABEL[m.status], hideOnMobile: true },
    {
      key: "actions",
      header: "",
      cell: (m) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
            Editar
          </Button>
          <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteTarget(m)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Base técnica pesquisada de modelos — só usada pra completar dados que a coleta ao vivo não conseguiu determinar
          (nunca sobrescreve o que a impressora já confirmou sozinha).
        </p>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Novo modelo
        </Button>
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={models}
        keyField={(m) => m.id}
        isLoading={isLoading}
        emptyIcon={PrinterIcon}
        emptyTitle="Nenhum modelo cadastrado no catálogo ainda"
        cardTitle={(m) => `${m.manufacturer} ${m.model}`}
        cardMeta={(m) => <Badge variant={CONFIDENCE_CONFIG[m.confidence].variant}>{CONFIDENCE_CONFIG[m.confidence].label}</Badge>}
        cardActions={(m) => (
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
              Editar
            </Button>
            <Button variant="ghost" size="icon" className="text-red-600" onClick={() => setDeleteTarget(m)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      />

      <CatalogModelDialog model={null} open={creating} onOpenChange={setCreating} />
      <CatalogModelDialog model={editing} open={!!editing} onOpenChange={(open) => !open && setEditing(null)} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover modelo do catálogo</DialogTitle>
            <DialogDescription>
              Tem certeza que quer remover &quot;{deleteTarget?.manufacturer} {deleteTarget?.model}&quot;? Impressoras já
              homologadas com esse modelo não perdem os dados já preenchidos, só param de receber atualizações do
              catálogo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteModel.isPending}>
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
