"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Users, Printer as PrinterIcon, ChevronRight, ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveDataTable, type DataTableColumn } from "@/components/shared/responsive-data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { OnlineBadge, connectionLabel, formatDateTime } from "@/components/shared/printer-badges";
import { useCustomers } from "@/hooks/use-customers";
import { usePrinters } from "@/hooks/use-printers";
import type { Customer, Printer } from "@/lib/types";

export default function ImpressorasPorClientePage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Customer | null>(null);
  const { data: customersData, isLoading: loadingCustomers } = useCustomers(search || undefined);

  if (selected) {
    return <CustomerPrinters customer={selected} onBack={() => setSelected(null)} />;
  }

  const customers = customersData?.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Impressoras por Cliente" description="Selecione um cliente para ver as impressoras vinculadas a ele." />

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar cliente..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loadingCustomers ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-20 animate-pulse bg-muted" />
          ))}
        </div>
      ) : customers.length === 0 ? (
        <Card>
          <EmptyState icon={Users} title="Nenhum cliente encontrado" description="Cadastre clientes para vincular impressoras a eles." />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {customers.map((customer) => (
            <button
              key={customer.id}
              type="button"
              onClick={() => setSelected(customer)}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{customer.tradeName || customer.legalName}</div>
                <div className="truncate text-xs text-muted-foreground">{customer.document || customer.city || "—"}</div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CustomerPrinters({ customer, onBack }: { customer: Customer; onBack: () => void }) {
  const { data, isLoading } = usePrinters({ customerId: customer.id });
  const printers = data?.data ?? [];

  const columns: DataTableColumn<Printer>[] = [
    { key: "online", header: "Comunicação", cell: (p) => <OnlineBadge status={p.onlineStatus} /> },
    { key: "manufacturer", header: "Fabricante", cell: (p) => p.manufacturer || "—" },
    {
      key: "model",
      header: "Modelo",
      cell: (p) => (
        <Link href={`/impressoras/${p.id}`} className="hover:underline">
          {p.model || "—"}
        </Link>
      ),
    },
    { key: "location", header: "Localização", cell: (p) => p.location?.name || "—", hideOnMobile: true },
    { key: "department", header: "Departamento", cell: (p) => p.location?.department || "—", hideOnMobile: true },
    { key: "ip", header: "Endereço IP", cell: (p) => p.ip || "—" },
    { key: "serial", header: "Nº de série", cell: (p) => p.serial || "—", hideOnMobile: true },
    { key: "connection", header: "Conexão", cell: (p) => connectionLabel(p.collectionMethod), hideOnMobile: true },
    {
      key: "lastSeen",
      header: "Última comunicação",
      cell: (p) => formatDateTime(p.lastSeenAt),
    },
    {
      key: "actions",
      header: "",
      cell: (p) => (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" render={<Link href={`/impressoras/${p.id}`}>Ver detalhes</Link>} />
        </div>
      ),
      className: "text-right",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1">
          <ArrowLeft className="h-4 w-4" /> Clientes
        </Button>
      </div>
      <PageHeader
        title={customer.tradeName || customer.legalName}
        description={`${printers.length} impressora(s) vinculada(s) a este cliente.`}
      />

      <ResponsiveDataTable
        columns={columns}
        data={printers}
        keyField={(p) => p.id}
        isLoading={isLoading}
        emptyIcon={PrinterIcon}
        emptyTitle="Nenhuma impressora vinculada"
        emptyDescription="Este cliente ainda não possui impressoras vinculadas."
        cardTitle={(p) => (
          <Link href={`/impressoras/${p.id}`} className="hover:underline">
            {p.manufacturer || "Fabricante não disponível"} {p.model || ""}
          </Link>
        )}
        cardMeta={(p) => <OnlineBadge status={p.onlineStatus} />}
        cardActions={(p) => (
          <Button size="sm" variant="outline" render={<Link href={`/impressoras/${p.id}`}>Ver detalhes</Link>} />
        )}
      />
    </div>
  );
}
