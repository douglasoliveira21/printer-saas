"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useContract } from "@/hooks/use-contracts";
import type { ContractStatus } from "@/lib/types";
import { OverviewTab } from "./overview-tab";
import { EmailsTab } from "./emails-tab";
import { ReadjustmentsTab } from "./readjustments-tab";

const STATUS_CONFIG: Record<ContractStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  DRAFT: { label: "Rascunho", variant: "outline" },
  ACTIVE: { label: "Ativo", variant: "default" },
  SUSPENDED: { label: "Suspenso", variant: "secondary" },
  ENDED: { label: "Encerrado", variant: "secondary" },
  EXPIRED: { label: "Vencido", variant: "destructive" },
};

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: contract, isLoading } = useContract(id);

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!contract) {
    return <p className="text-muted-foreground">Contrato não encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/contratos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Contratos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Contrato #{contract.number}</h1>
          <p className="text-sm text-muted-foreground">{contract.customer?.tradeName || contract.customer?.legalName}</p>
        </div>
        <Badge variant={STATUS_CONFIG[contract.status].variant}>{STATUS_CONFIG[contract.status].label}</Badge>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão geral</TabsTrigger>
          <TabsTrigger value="emails">E-mail</TabsTrigger>
          <TabsTrigger value="readjustments">Reajuste</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab contract={contract} />
        </TabsContent>
        <TabsContent value="emails" className="mt-4">
          <EmailsTab contractId={contract.id} />
        </TabsContent>
        <TabsContent value="readjustments" className="mt-4">
          <ReadjustmentsTab contractId={contract.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
