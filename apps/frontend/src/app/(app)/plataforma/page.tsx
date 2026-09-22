"use client";

import { toast } from "sonner";
import { Building2, Cpu, Printer, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api-client";
import { usePlatformStats, usePlatformTenants, useUpdateTenantStatus, type PlatformTenant } from "@/hooks/use-platform";
import { PrinterCatalogTab } from "./printer-catalog-tab";

const STATUS_LABEL: Record<PlatformTenant["status"], string> = { ACTIVE: "Ativo", SUSPENDED: "Suspenso", CANCELLED: "Cancelado" };

export default function PlataformaPage() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = usePlatformStats();
  const { data: tenants, isLoading: tenantsLoading } = usePlatformTenants();
  const updateStatus = useUpdateTenantStatus();

  async function handleStatusChange(id: string, status: PlatformTenant["status"]) {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success("Status do tenant atualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar tenant"));
    }
  }

  if (!user?.isSuperAdmin) {
    return <p className="text-muted-foreground">Acesso restrito ao Super Admin da plataforma.</p>;
  }

  const columns: DataTableColumn<PlatformTenant>[] = [
    {
      key: "name",
      header: "Tenant",
      cell: (t) => (
        <>
          {t.name}
          {t.isDemo && (
            <Badge variant="outline" className="ml-2">
              DEMO
            </Badge>
          )}
        </>
      ),
      hideOnMobile: true,
    },
    { key: "users", header: "Usuários", cell: (t) => t.usersCount },
    { key: "customers", header: "Clientes", cell: (t) => t.customersCount },
    { key: "printers", header: "Impressoras", cell: (t) => t.printersCount },
    { key: "agents", header: "Agents", cell: (t) => t.agentsCount },
    {
      key: "status",
      header: "Status",
      cell: (t) => (
        <Select value={t.status} onValueChange={(v) => v && handleStatusChange(t.id, v as PlatformTenant["status"])}>
          <SelectTrigger className="w-36">
            <SelectValue>{(value: PlatformTenant["status"]) => STATUS_LABEL[value]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ACTIVE">{STATUS_LABEL.ACTIVE}</SelectItem>
            <SelectItem value="SUSPENDED">{STATUS_LABEL.SUSPENDED}</SelectItem>
            <SelectItem value="CANCELLED">{STATUS_LABEL.CANCELLED}</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Plataforma
          </span>
        }
      />

      <Tabs defaultValue="tenants">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="printer-catalog">Catálogo de impressoras</TabsTrigger>
        </TabsList>

        <TabsContent value="tenants" className="mt-4 space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Tenants</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-7 w-16" /> : (
                  <div className="text-2xl font-bold">
                    {stats?.tenants} <span className="text-sm font-normal text-muted-foreground">({stats?.activeTenants} ativos)</span>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impressoras monitoradas</CardTitle>
                <Printer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>{statsLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats?.printers}</div>}</CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Agents</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {statsLoading ? <Skeleton className="h-7 w-16" /> : (
                  <div className="text-2xl font-bold">
                    {stats?.agents} <span className="text-sm font-normal text-muted-foreground">({stats?.onlineAgents} online)</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <ResponsiveDataTable
            columns={columns}
            data={tenants}
            keyField={(t) => t.id}
            isLoading={tenantsLoading}
            emptyIcon={Building2}
            emptyTitle="Nenhum tenant cadastrado ainda"
            cardTitle={(t) => t.name}
            cardMeta={(t) => (t.isDemo ? <Badge variant="outline">DEMO</Badge> : null)}
          />
        </TabsContent>

        <TabsContent value="printer-catalog" className="mt-4">
          <PrinterCatalogTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
