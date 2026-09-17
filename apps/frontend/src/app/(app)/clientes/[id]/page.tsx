"use client";

import { use } from "react";
import { MapPin, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCustomer } from "@/hooks/use-customers";
import { CreateLocationDialog } from "./create-location-dialog";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: customer, isLoading } = useCustomer(id);

  if (isLoading) {
    return <p className="text-neutral-400">Carregando...</p>;
  }

  if (!customer) {
    return <p className="text-neutral-400">Cliente não encontrado.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Building2 className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold">{customer.tradeName || customer.legalName}</h1>
          <p className="text-sm text-neutral-500">{customer.legalName}</p>
        </div>
        <Badge variant={customer.status === "ACTIVE" ? "default" : "secondary"} className="ml-2">
          {customer.status === "ACTIVE" ? "Ativo" : "Inativo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">CNPJ</CardTitle>
          </CardHeader>
          <CardContent>{customer.document || "Não disponível"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">E-mail</CardTitle>
          </CardHeader>
          <CardContent>{customer.email || "Não disponível"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-neutral-500">Telefone</CardTitle>
          </CardHeader>
          <CardContent>{customer.phone || "Não disponível"}</CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Locais</h2>
          <CreateLocationDialog customerId={customer.id} />
        </div>

        {customer.locations.length === 0 ? (
          <p className="text-sm text-neutral-400">Nenhum local cadastrado ainda.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customer.locations.map((location) => (
              <Card key={location.id}>
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <MapPin className="h-4 w-4 text-neutral-400" />
                  <CardTitle className="text-base">{location.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm text-neutral-500">
                  <p>{location.address || "Endereço não informado"}</p>
                  {location.contactName && <p>Responsável: {location.contactName}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
