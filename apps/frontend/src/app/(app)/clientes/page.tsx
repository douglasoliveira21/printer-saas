"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCustomers } from "@/hooks/use-customers";
import { CreateCustomerDialog } from "./create-customer-dialog";

export default function ClientesPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCustomers(search);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <CreateCustomerDialog />
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <Input placeholder="Buscar por nome ou CNPJ..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="overflow-hidden py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-neutral-400">
                  Carregando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !data?.data.length && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-neutral-400">
                  Nenhum cliente cadastrado ainda.
                </TableCell>
              </TableRow>
            )}
            {data?.data.map((customer) => (
              <TableRow key={customer.id} className="cursor-pointer">
                <TableCell className="font-medium">
                  <Link href={`/clientes/${customer.id}`} className="hover:underline">
                    {customer.tradeName || customer.legalName}
                  </Link>
                </TableCell>
                <TableCell>{customer.document || "—"}</TableCell>
                <TableCell>{customer.email || customer.phone || "—"}</TableCell>
                <TableCell>
                  <Badge variant={customer.status === "ACTIVE" ? "default" : "secondary"}>
                    {customer.status === "ACTIVE" ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
