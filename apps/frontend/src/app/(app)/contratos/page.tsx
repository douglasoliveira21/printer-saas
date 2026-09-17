"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivateContract, useContracts } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ContractStatus } from "@/lib/types";
import { CreateContractDialog } from "./create-contract-dialog";
import { FranchiseUsage } from "./franchise-usage";

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "outline" },
  ACTIVE: { label: "Ativo", variant: "default" },
  SUSPENDED: { label: "Suspenso", variant: "secondary" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  EXPIRED: { label: "Vencido", variant: "destructive" },
};

export default function ContratosPage() {
  const { data, isLoading } = useContracts();
  const activateContract = useActivateContract();

  async function handleActivate(id: string) {
    try {
      await activateContract.mutateAsync(id);
      toast.success("Contrato ativado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao ativar contrato"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Contratos</h1>
        <CreateContractDialog />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Número</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Mensalidade</TableHead>
              <TableHead>Uso da franquia</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-400">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !data?.data.length && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-400">
                  Nenhum contrato cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((contract) => (
              <TableRow key={contract.id}>
                <TableCell className="font-medium">#{contract.number}</TableCell>
                <TableCell>{contract.customer?.tradeName || contract.customer?.legalName || "—"}</TableCell>
                <TableCell>
                  {Number(contract.monthlyFee).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </TableCell>
                <TableCell>
                  <FranchiseUsage contract={contract} />
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_CONFIG[contract.status].variant}>{STATUS_CONFIG[contract.status].label}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {contract.status === "DRAFT" && (
                    <Button size="sm" variant="outline" onClick={() => handleActivate(contract.id)}>
                      Ativar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
