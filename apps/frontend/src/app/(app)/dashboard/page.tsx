"use client";

import { Printer, AlertTriangle, FileText, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardSummary } from "@/hooks/use-dashboard";

function StatCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-neutral-500">{title}</CardTitle>
        <Icon className="h-4 w-4 text-neutral-400" />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data, isLoading } = useDashboardSummary();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Impressoras monitoradas" icon={Printer}>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <div className="text-2xl font-bold">{data?.printers.monitored ?? 0}</div>
              <p className="text-xs text-neutral-500">
                <span className="text-emerald-600 font-medium">{data?.printers.online ?? 0} online</span> ·{" "}
                <span className="text-red-600 font-medium">{data?.printers.offline ?? 0} offline</span> ·{" "}
                {data?.printers.onlinePercent ?? 0}%
              </p>
            </>
          )}
        </StatCard>

        <StatCard title="Alertas" icon={AlertTriangle}>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <div className="text-2xl font-bold">{(data?.alerts.critical ?? 0) + (data?.alerts.warning ?? 0)}</div>
              <p className="text-xs text-neutral-500">
                <span className="text-red-600 font-medium">{data?.alerts.critical ?? 0} críticos</span> ·{" "}
                <span className="text-amber-600 font-medium">{data?.alerts.warning ?? 0} avisos</span>
              </p>
            </>
          )}
        </StatCard>

        <StatCard title="Contratos ativos" icon={FileText}>
          {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{data?.contracts.active ?? 0}</div>}
        </StatCard>

        <StatCard title="Ordens de Serviço" icon={Wrench}>
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <>
              <div className="text-2xl font-bold">{data?.serviceOrders.open ?? 0}</div>
              <p className="text-xs text-neutral-500">
                <span className={data?.serviceOrders.late ? "text-red-600 font-medium" : ""}>
                  {data?.serviceOrders.late ?? 0} atrasadas
                </span>
              </p>
            </>
          )}
        </StatCard>
      </div>
    </div>
  );
}
