"use client";

import { toast } from "sonner";
import { Building2, Cpu, Printer, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import { getApiErrorMessage } from "@/lib/api-client";
import { usePlatformStats, usePlatformTenants, useUpdateTenantStatus, type PlatformTenant } from "@/hooks/use-platform";

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
    return <p className="text-neutral-400">Acesso restrito ao Super Admin da plataforma.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-6 w-6 text-purple-600" />
        <h1 className="text-2xl font-semibold">Plataforma</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Tenants</CardTitle>
            <Building2 className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-16" /> : (
              <div className="text-2xl font-bold">
                {stats?.tenants} <span className="text-sm font-normal text-neutral-400">({stats?.activeTenants} ativos)</span>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Impressoras monitoradas</CardTitle>
            <Printer className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>{statsLoading ? <Skeleton className="h-7 w-16" /> : <div className="text-2xl font-bold">{stats?.printers}</div>}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Agents</CardTitle>
            <Cpu className="h-4 w-4 text-neutral-400" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-16" /> : (
              <div className="text-2xl font-bold">
                {stats?.agents} <span className="text-sm font-normal text-neutral-400">({stats?.onlineAgents} online)</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Clientes</TableHead>
              <TableHead>Impressoras</TableHead>
              <TableHead>Agents</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantsLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-neutral-400">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {tenants?.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">
                  {tenant.name}
                  {tenant.isDemo && (
                    <Badge variant="outline" className="ml-2">
                      DEMO
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{tenant.usersCount}</TableCell>
                <TableCell>{tenant.customersCount}</TableCell>
                <TableCell>{tenant.printersCount}</TableCell>
                <TableCell>{tenant.agentsCount}</TableCell>
                <TableCell>
                  <Select value={tenant.status} onValueChange={(v) => v && handleStatusChange(tenant.id, v as PlatformTenant["status"])}>
                    <SelectTrigger className="w-36">
                      <SelectValue>{(value: PlatformTenant["status"]) => STATUS_LABEL[value]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">{STATUS_LABEL.ACTIVE}</SelectItem>
                      <SelectItem value="SUSPENDED">{STATUS_LABEL.SUSPENDED}</SelectItem>
                      <SelectItem value="CANCELLED">{STATUS_LABEL.CANCELLED}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
