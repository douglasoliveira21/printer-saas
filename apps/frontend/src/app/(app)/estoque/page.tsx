"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInventoryItems } from "@/hooks/use-inventory";
import type { InventoryItem } from "@/lib/types";
import { CreateItemDialog } from "./create-item-dialog";
import { MovementDialog } from "./movement-dialog";
import { ItemActionsMenu } from "./item-actions-menu";

export default function EstoquePage() {
  const { data: items, isLoading } = useInventoryItems();
  const [moving, setMoving] = useState<InventoryItem | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Estoque</h1>
        <CreateItemDialog />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estoque atual</TableHead>
              <TableHead>Estoque mínimo</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-400">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !items?.length && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-neutral-400">
                  Nenhum item cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {items?.map((item) => {
              const low = item.quantity <= item.minQuantity;
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.type}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.quantity}
                      {low && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Baixo
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.minQuantity}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setMoving(item)}>
                        Movimentar
                      </Button>
                      <ItemActionsMenu item={item} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {moving && <MovementDialog item={moving} onClose={() => setMoving(null)} />}
    </div>
  );
}
