"use client";

import { toast } from "sonner";
import { MoreHorizontal, Pause, Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUpdateContractStatus } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Contract } from "@/lib/types";

export function ContractActionsMenu({ contract }: { contract: Contract }) {
  const updateStatus = useUpdateContractStatus();

  async function handleStatusChange(status: Contract["status"]) {
    try {
      await updateStatus.mutateAsync({ id: contract.id, status });
      toast.success("Status do contrato atualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar status"));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
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
          <DropdownMenuItem onClick={() => handleStatusChange("ENDED")} className="text-destructive focus:text-destructive">
            <Square className="mr-2 h-4 w-4" />
            Encerrar
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
