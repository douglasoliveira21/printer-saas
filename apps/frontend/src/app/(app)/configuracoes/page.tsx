"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useTenantUsers, type TenantUser } from "@/hooks/use-users";
import { CreateUserDialog } from "./create-user-dialog";
import { CompanyWorkingHoursCard } from "./company-working-hours-card";
import { SnmpCredentialsTab } from "./snmp-credentials-tab";
import { ReportEmailRecipientsTab } from "./report-email-recipients-tab";

const ACCOUNT_TYPE_LABEL: Record<TenantUser["accountType"], string> = { STAFF: "Colaborador", CUSTOMER: "Cliente" };

export default function ConfiguracoesPage() {
  const { data: users, isLoading } = useTenantUsers();

  const columns: DataTableColumn<TenantUser>[] = [
    {
      key: "name",
      header: "Nome",
      cell: (u) => (
        <Link href={`/configuracoes/usuarios/${u.id}`} className="hover:underline">
          {u.name}
        </Link>
      ),
      hideOnMobile: true,
    },
    { key: "email", header: "E-mail", cell: (u) => u.email },
    { key: "accountType", header: "Tipo", cell: (u) => ACCOUNT_TYPE_LABEL[u.accountType], hideOnMobile: true },
    {
      key: "status",
      header: "Status",
      cell: (u) => <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"}>{u.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>,
      hideOnMobile: true,
    },
    {
      key: "lastLoginAt",
      header: "Último acesso",
      cell: (u) => (u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-BR") : "Nunca"),
    },
    {
      key: "actions",
      header: "",
      cell: (u) => <Button size="sm" variant="ghost" render={<Link href={`/configuracoes/usuarios/${u.id}`}>Detalhes</Link>} />,
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" />

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="snmp">Credenciais SNMP v3</TabsTrigger>
          <TabsTrigger value="report-emails">Envio de relatórios por e-mail</TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <CreateUserDialog />
          </div>
          <ResponsiveDataTable
            columns={columns}
            data={users}
            keyField={(u) => u.id}
            isLoading={isLoading}
            emptyIcon={Users}
            emptyTitle="Nenhuma conta cadastrada ainda"
            cardTitle={(u) => (
              <Link href={`/configuracoes/usuarios/${u.id}`} className="hover:underline">
                {u.name}
              </Link>
            )}
            cardMeta={(u) => <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"}>{u.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>}
          />
        </TabsContent>

        <TabsContent value="empresa" className="mt-4">
          <CompanyWorkingHoursCard />
        </TabsContent>

        <TabsContent value="snmp" className="mt-4">
          <SnmpCredentialsTab />
        </TabsContent>

        <TabsContent value="report-emails" className="mt-4">
          <ReportEmailRecipientsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
