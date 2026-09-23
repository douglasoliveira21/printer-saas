"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { uploadedFileUrl } from "@/lib/api-client";
import { useTenantInfo, useUpdateTenantInfo, useUploadTenantLogo } from "@/hooks/use-tenant-settings";
import { getApiErrorMessage } from "@/lib/api-client";

export function CompanyInfoCard() {
  const { data: tenant, isLoading } = useTenantInfo();
  const updateInfo = useUpdateTenantInfo();
  const uploadLogo = useUploadTenantLogo();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ name: "", legalName: "", document: "", email: "", phone: "", address: "" });

  useEffect(() => {
    if (!tenant) return;
    setForm({
      name: tenant.name ?? "",
      legalName: tenant.legalName ?? "",
      document: tenant.document ?? "",
      email: tenant.email ?? "",
      phone: tenant.phone ?? "",
      address: tenant.address ?? "",
    });
  }, [tenant]);

  async function handleSave() {
    try {
      await updateInfo.mutateAsync(form);
      toast.success("Dados da empresa salvos");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar dados da empresa"));
    }
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await uploadLogo.mutateAsync(file);
      toast.success("Logotipo atualizado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao enviar logotipo"));
    } finally {
      event.target.value = "";
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dados gerais da empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {tenant?.logoUrl && <AvatarImage src={uploadedFileUrl(tenant.logoUrl)} alt="Logotipo" />}
            <AvatarFallback>{(tenant?.name ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadLogo.isPending}>
              <Upload className="mr-2 h-4 w-4" />
              {uploadLogo.isPending ? "Enviando..." : "Trocar logotipo"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">Usado no menu lateral, relatórios, fechamentos e ordens de serviço.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Nome fantasia</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="legalName">Razão social</Label>
            <Input id="legalName" value={form.legalName} onChange={(e) => setForm((prev) => ({ ...prev, legalName: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="document">CNPJ</Label>
            <Input id="document" value={form.document} onChange={(e) => setForm((prev) => ({ ...prev, document: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input id="phone" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Endereço</Label>
            <Input id="address" value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateInfo.isPending}>
            {updateInfo.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
