"use client";

import { useState } from "react";
import { AlertTriangle, Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useInventoryItems } from "@/hooks/use-inventory";
import type { InventoryItem } from "@/lib/types";
import { CreateItemDialog } from "./create-item-dialog";
import { MovementDialog } from "./movement-dialog";
import { ItemActionsMenu } from "./item-actions-menu";
import { inventoryTypeLabel } from "./inventory-types";

export default function EstoquePage() {
  const { data: items, isLoading } = useInventoryItems();
  const [moving, setMoving] = useState<InventoryItem | null>(null);

  function renderActions(item: InventoryItem) {
    return (
      <>
        <Button size="sm" variant="outline" onClick={() => setMoving(item)}>
          Movimentar
        </Button>
        <ItemActionsMenu item={item} />
      </>
    );
  }

  const columns: DataTableColumn<InventoryItem>[] = [
    { key: "name", header: "Item", cell: (i) => i.name, hideOnMobile: true },
    { key: "type", header: "Tipo", cell: (i) => inventoryTypeLabel(i.type) },
    {
      key: "quantity",
      header: "Estoque atual",
      cell: (i) => (
        <div className="flex items-center gap-2">
          {i.quantity}
          {i.quantity <= i.minQuantity && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Baixo
            </Badge>
          )}
        </div>
      ),
    },
    { key: "minQuantity", header: "Estoque mínimo", cell: (i) => i.minQuantity, hideOnMobile: true },
    { key: "actions", header: "", cell: (i) => <div className="flex justify-end gap-2">{renderActions(i)}</div>, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" actions={<CreateItemDialog />} />

      <ResponsiveDataTable
        columns={columns}
        data={items}
        keyField={(i) => i.id}
        isLoading={isLoading}
        emptyIcon={Boxes}
        emptyTitle="Nenhum item cadastrado ainda"
        cardTitle={(i) => i.name}
        cardMeta={(i) =>
          i.quantity <= i.minQuantity ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Baixo
            </Badge>
          ) : null
        }
        cardActions={renderActions}
      />

      {moving && <MovementDialog item={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}
