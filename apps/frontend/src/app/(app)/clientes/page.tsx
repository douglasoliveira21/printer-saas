"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { useCustomers } from "@/hooks/use-customers";
import type { Customer, CustomerStatus } from "@/lib/types";
import { CreateCustomerDialog } from "./create-customer-dialog";

const STATUS_CONFIG: Record<CustomerStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  ACTIVE: { label: "Ativo", variant: "default" },
  INACTIVE: { label: "Inativo", variant: "secondary" },
  BLOCKED: { label: "Bloqueado", variant: "destructive" },
};

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCustomers(search);

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "name",
      header: "Nome",
      cell: (c) => (
        <Link href={`/clientes/${c.id}`} className="font-medium hover:underline">
          {c.tradeName || c.legalName}
        </Link>
      ),
      hideOnMobile: true,
    },
    { key: "document", header: "CPF/CNPJ", cell: (c) => c.document || "—" },
    { key: "contact", header: "Contato", cell: (c) => c.email || c.phone || "—" },
    {
      key: "status",
      header: "Status",
      cell: (c) => <Badge variant={STATUS_CONFIG[c.status].variant}>{STATUS_CONFIG[c.status].label}</Badge>,
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Clientes" actions={<CreateCustomerDialog />} />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou CNPJ..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <ResponsiveDataTable
        columns={columns}
        data={data?.data}
        keyField={(c) => c.id}
        isLoading={isLoading}
        emptyIcon={Users}
        emptyTitle="Nenhum cliente cadastrado ainda"
        cardTitle={(c) => (
          <Link href={`/clientes/${c.id}`} className="hover:underline">
            {c.tradeName || c.legalName}
          </Link>
        )}
        cardMeta={(c) => <Badge variant={STATUS_CONFIG[c.status].variant}>{STATUS_CONFIG[c.status].label}</Badge>}
      />
    </div>
  );
}
