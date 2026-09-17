"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useContracts } from "@/hooks/use-contracts";
import type { ContractStatus } from "@/lib/types";
import { CreateContractDialog } from "./create-contract-dialog";
import { FranchiseUsage } from "./franchise-usage";
import { ContractActionsMenu } from "./contract-actions-menu";

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "outline" },
  ACTIVE: { label: "Ativo", variant: "default" },
  SUSPENDED: { label: "Suspenso", variant: "secondary" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  EXPIRED: { label: "Vencido", variant: "destructive" },
};

export default function ContratosPage() {
  const { data, isLoading } = useContracts();

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
                  <ContractActionsMenu contract={contract} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
