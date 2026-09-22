"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCustomer, useDeleteCustomer } from "@/hooks/use-customers";
import { getApiErrorMessage } from "@/lib/api-client";
import { CreateLocationDialog } from "./create-location-dialog";
import { EditCustomerDialog } from "./edit-customer-dialog";
import { LocationCard } from "./location-card";
import { HistoryTab } from "./history-tab";
import { SettingsTab } from "./settings-tab";

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: customer, isLoading } = useCustomer(id);
  const [deleting, setDeleting] = useState(false);
  const deleteCustomer = useDeleteCustomer();
  const router = useRouter();

  async function handleDelete() {
    try {
      await deleteCustomer.mutateAsync(id);
      toast.success("Cliente excluído");
      router.push("/clientes");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir cliente"));
      setDeleting(false);
    }
  }

  if (isLoading) {
    return <p className="text-neutral-400">Carregando...</p>;
  }

  if (!customer) {
    return <p className="text-neutral-400">Cliente não encontrado.</p>;
  }

  const primaryLocation = customer.locations?.find((l) => l.isPrimary);
  const otherLocations = customer.locations?.filter((l) => !l.isPrimary) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Building2 className="h-6 w-6 text-blue-600" />
        <div>
          <h1 className="text-2xl font-semibold">{customer.tradeName || customer.legalName}</h1>
          <p className="text-sm text-neutral-500">{customer.legalName}</p>
        </div>
        <Badge variant={customer.status === "ACTIVE" ? "default" : "secondary"} className="ml-2">
          {customer.status === "ACTIVE" ? "Ativo" : "Inativo"}
        </Badge>
        <div className="ml-auto flex gap-2">
          <EditCustomerDialog customer={customer} />
          <Button variant="outline" size="sm" className="text-red-600 hover:text-red-600" onClick={() => setDeleting(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4 space-y-6">
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
            <h2 className="text-lg font-semibold">Endereço principal</h2>
            {primaryLocation ? (
              <LocationCard location={primaryLocation} customerId={customer.id} />
            ) : (
              <p className="text-sm text-neutral-400">Nenhum endereço principal definido ainda.</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Outros endereços</h2>
              <CreateLocationDialog customerId={customer.id} />
            </div>

            {otherLocations.length === 0 ? (
              <p className="text-sm text-neutral-400">Nenhum outro endereço cadastrado.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {otherLocations.map((location) => (
                  <LocationCard key={location.id} location={location} customerId={customer.id} />
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="historico" className="mt-4">
          <HistoryTab customerId={customer.id} />
        </TabsContent>

        <TabsContent value="configuracoes" className="mt-4">
          <SettingsTab customer={customer} />
        </TabsContent>
      </Tabs>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir cliente</DialogTitle>
            <DialogDescription>
              Tem certeza que quer excluir &quot;{customer.tradeName || customer.legalName}&quot;? Locais são excluídos junto;
              não é possível se houver contratos ou ordens de serviço vinculados a ele (impressoras vinculadas apenas
              deixam de ter cliente).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteCustomer.isPending}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
