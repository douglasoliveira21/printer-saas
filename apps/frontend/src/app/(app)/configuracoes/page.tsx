"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useTenantUsers, type TenantUser } from "@/hooks/use-users";
import { ComingSoon } from "@/components/layout/coming-soon";
import { CreateUserDialog } from "./create-user-dialog";
import { UserActionsMenu } from "./user-actions-menu";

export default function ConfiguracoesPage() {
  const { data: users, isLoading } = useTenantUsers();

  const columns: DataTableColumn<TenantUser>[] = [
    { key: "name", header: "Nome", cell: (u) => u.name, hideOnMobile: true },
    { key: "email", header: "E-mail", cell: (u) => u.email },
    { key: "role", header: "Perfil", cell: (u) => u.role?.name || "—" },
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
    { key: "actions", header: "", cell: (u) => <UserActionsMenu user={u} />, className: "text-right" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" />

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
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
            emptyTitle="Nenhum usuário cadastrado ainda"
            cardTitle={(u) => u.name}
            cardMeta={(u) => <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"}>{u.status === "ACTIVE" ? "Ativo" : "Inativo"}</Badge>}
            cardActions={(u) => <UserActionsMenu user={u} />}
          />
        </TabsContent>

        <TabsContent value="empresa" className="mt-4">
          <ComingSoon />
        </TabsContent>
      </Tabs>
    </div>
  );
}
