"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Droplet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { cn } from "@/lib/utils";
import { getApiErrorMessage } from "@/lib/api-client";
import {
  useSupplyLevelFilters,
  useSupplyLevelFilterRows,
  useDeleteSupplyLevelFilter,
  type SupplyLevelRow,
} from "@/hooks/use-supply-level-filters";
import { CreateFilterDialog } from "./create-filter-dialog";

function levelBadgeVariant(level: number | null): "default" | "secondary" | "destructive" | "outline" {
  if (level === null) return "outline";
  if (level <= 10) return "destructive";
  if (level <= 20) return "secondary";
  return "default";
}

export default function SupplyLevelsPage() {
  const { data: filters, isLoading: loadingFilters } = useSupplyLevelFilters();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: filterRows, isLoading: loadingRows } = useSupplyLevelFilterRows(selectedId);
  const deleteFilter = useDeleteSupplyLevelFilter();

  async function handleDelete(id: string) {
    try {
      await deleteFilter.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast.success("Filtro removido");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover filtro"));
    }
  }

  const columns: DataTableColumn<SupplyLevelRow>[] = [
    { key: "manufacturer", header: "Fabricante", cell: (r) => r.manufacturer ?? "—" },
    { key: "model", header: "Modelo", cell: (r) => r.model ?? "—" },
    { key: "serial", header: "Nº de série", cell: (r) => r.serial ?? "—", hideOnMobile: true },
    { key: "ip", header: "IP", cell: (r) => r.ip ?? "—", hideOnMobile: true },
    { key: "customer", header: "Cliente", cell: (r) => r.customer },
    { key: "department", header: "Departamento", cell: (r) => r.department ?? "—", hideOnMobile: true },
    { key: "itemName", header: "Descrição do item", cell: (r) => r.itemName ?? "—" },
    { key: "type", header: "Tipo", cell: (r) => r.type, hideOnMobile: true },
    { key: "color", header: "Cor", cell: (r) => r.color ?? "—", hideOnMobile: true },
    { key: "itemSerial", header: "Nº série do suprimento", cell: (r) => r.itemSerial ?? "—", hideOnMobile: true },
    {
      key: "levelPercent",
      header: "Nível",
      cell: (r) => <Badge variant={levelBadgeVariant(r.levelPercent)}>{r.levelPercent === null ? "Não disponível" : `${r.levelPercent}%`}</Badge>,
    },
    {
      key: "collectedAt",
      header: "Última leitura",
      cell: (r) => new Date(r.collectedAt).toLocaleString("pt-BR"),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Níveis dos Suprimentos" />

      <div className="flex flex-wrap items-center gap-2">
        {loadingFilters ? (
          <p className="text-sm text-neutral-400">Carregando filtros...</p>
        ) : (
          filters?.map((f) => (
            <Card
              key={f.id}
              className={cn(
                "cursor-pointer transition-colors",
                selectedId === f.id ? "border-primary" : "hover:border-neutral-400",
              )}
              onClick={() => setSelectedId(f.id)}
            >
              <CardContent className="flex items-center gap-2 py-2 px-3">
                <span className="text-sm font-medium">{f.name}</span>
                <span className="text-xs text-neutral-400">({f.customer.tradeName || f.customer.legalName})</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(f.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardContent>
            </Card>
          ))
        )}
        <CreateFilterDialog onCreated={setSelectedId} />
      </div>

      {!selectedId ? (
        <p className="text-sm text-neutral-400">
          {filters && filters.length > 0 ? "Selecione um filtro acima para ver os níveis de suprimentos." : "Crie um filtro para começar."}
        </p>
      ) : (
        <ResponsiveDataTable
          columns={columns}
          data={filterRows?.rows}
          keyField={(r) => `${r.printerId}-${r.itemName ?? r.type}-${r.color ?? "default"}`}
          isLoading={loadingRows}
          emptyIcon={Droplet}
          emptyTitle="Nenhum suprimento reportado para este cliente ainda"
          cardTitle={(r) => `${r.manufacturer ?? ""} ${r.model ?? ""}`.trim() || "—"}
          cardMeta={(r) => <Badge variant={levelBadgeVariant(r.levelPercent)}>{r.levelPercent === null ? "Não disponível" : `${r.levelPercent}%`}</Badge>}
        />
      )}
    </div>
  );
}
