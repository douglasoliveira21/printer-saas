"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useServiceOrder } from "@/hooks/use-service-orders";
import { STATUS_LABEL } from "./labels";
import { OpeningSection } from "./opening-section";
import { ProblemSection } from "./problem-section";
import { DiagnosisSection } from "./diagnosis-section";
import { PartsSection } from "./parts-section";
import { AttendanceSection } from "./attendance-section";
import { ResolutionSection } from "./resolution-section";
import { ApprovalSection } from "./approval-section";

export default function ServiceOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: order, isLoading } = useServiceOrder(id);

  if (isLoading) {
    return <p className="text-muted-foreground">Carregando...</p>;
  }

  if (!order) {
    return <p className="text-muted-foreground">Ordem de serviço não encontrada.</p>;
  }

  return (
    <div className="space-y-6">
      <Link href="/ordens-servico" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar para Ordens de Serviço
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">
            OS #{order.number}
            {order.title ? ` — ${order.title}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">{order.customer?.tradeName || order.customer?.legalName}</p>
        </div>
        <Badge variant={order.status === "DONE" ? "default" : order.status === "CANCELLED" ? "secondary" : "outline"}>
          {STATUS_LABEL[order.status]}
        </Badge>
      </div>

      <div className="space-y-6">
        <OpeningSection order={order} />
        <ProblemSection order={order} />
        <DiagnosisSection order={order} />
        <PartsSection order={order} />
        <AttendanceSection order={order} />
        <ResolutionSection order={order} />
        <ApprovalSection order={order} />
      </div>
    </div>
  );
}
