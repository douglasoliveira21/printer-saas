"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MoreHorizontal, Pause, Pencil, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUpdateContract, useUpdateContractStatus } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Contract } from "@/lib/types";

export function ContractActionsMenu({ contract }: { contract: Contract }) {
  const [editing, setEditing] = useState(false);
  const [monthlyFee, setMonthlyFee] = useState(contract.monthlyFee);
  const [franchisePages, setFranchisePages] = useState(String(contract.franchisePages));
  const [overagePriceBw, setOveragePriceBw] = useState(contract.overagePriceBw);

  const updateContract = useUpdateContract();
  const updateStatus = useUpdateContractStatus();

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    try {
      await updateContract.mutateAsync({
        id: contract.id,
        monthlyFee: Number(monthlyFee),
        franchisePages: Number(franchisePages),
        overagePriceBw: Number(overagePriceBw),
      });
      toast.success("Contrato atualizado");
      setEditing(false);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar contrato"));
    }
  }

  async function handleStatusChange(status: Contract["status"]) {
    try {
      await updateStatus.mutateAsync({ id: contract.id, status });
      toast.success("Status do contrato atualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar status"));
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Editar valores
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {contract.status === "DRAFT" && (
            <DropdownMenuItem onClick={() => handleStatusChange("ACTIVE")}>
              <Play className="mr-2 h-4 w-4" />
              Ativar
            </DropdownMenuItem>
          )}
          {contract.status === "ACTIVE" && (
            <DropdownMenuItem onClick={() => handleStatusChange("SUSPENDED")}>
              <Pause className="mr-2 h-4 w-4" />
              Suspender
            </DropdownMenuItem>
          )}
          {contract.status === "SUSPENDED" && (
            <DropdownMenuItem onClick={() => handleStatusChange("ACTIVE")}>
              <Play className="mr-2 h-4 w-4" />
              Reativar
            </DropdownMenuItem>
          )}
          {(contract.status === "ACTIVE" || contract.status === "SUSPENDED") && (
            <DropdownMenuItem onClick={() => handleStatusChange("ENDED")} className="text-red-600 focus:text-red-600">
              <Square className="mr-2 h-4 w-4" />
              Encerrar
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>Editar contrato #{contract.number}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="monthlyFee">Mensalidade (R$) *</Label>
                <Input
                  id="monthlyFee"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={monthlyFee}
                  onChange={(e) => setMonthlyFee(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="franchisePages">Franquia (páginas)</Label>
                  <Input id="franchisePages" type="number" min="0" value={franchisePages} onChange={(e) => setFranchisePages(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overagePriceBw">Valor excedente P&B (R$)</Label>
                  <Input
                    id="overagePriceBw"
                    type="number"
                    step="0.0001"
                    min="0"
                    value={overagePriceBw}
                    onChange={(e) => setOveragePriceBw(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={updateContract.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
