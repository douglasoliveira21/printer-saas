"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmailSettings, useUpdateEmailSettings, type EmailProvider, type UpdateEmailSettingsInput } from "@/hooks/use-email-settings";
import { getApiErrorMessage } from "@/lib/api-client";

export function EmailConfigTab() {
  const { data: settings, isLoading } = useEmailSettings();
  const updateSettings = useUpdateEmailSettings();
  const [form, setForm] = useState<UpdateEmailSettingsInput & { provider: EmailProvider }>({ provider: "SMTP" });

  useEffect(() => {
    if (!settings) return;
    setForm({
      provider: settings.provider,
      smtpHost: settings.smtpHost ?? undefined,
      smtpPort: settings.smtpPort ?? undefined,
      smtpUser: settings.smtpUser ?? undefined,
      smtpFrom: settings.smtpFrom ?? undefined,
      m365TenantId: settings.m365TenantId ?? undefined,
      m365ClientId: settings.m365ClientId ?? undefined,
      m365SenderUpn: settings.m365SenderUpn ?? undefined,
    });
  }, [settings]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync(form);
      toast.success("Configuração de e-mail salva");
      setForm((prev) => ({ ...prev, smtpPassword: undefined, m365ClientSecret: undefined }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar configuração de e-mail"));
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" checked={form.provider === "SMTP"} onChange={() => setForm((prev) => ({ ...prev, provider: "SMTP" }))} />
          SMTP
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" checked={form.provider === "MICROSOFT365"} onChange={() => setForm((prev) => ({ ...prev, provider: "MICROSOFT365" }))} />
          Microsoft 365
        </label>
      </div>

      {form.provider === "SMTP" && (
        <Card>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 py-4">
            <div className="space-y-2">
              <Label htmlFor="smtpHost">Servidor SMTP</Label>
              <Input id="smtpHost" value={form.smtpHost ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, smtpHost: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPort">Porta</Label>
              <Input id="smtpPort" type="number" value={form.smtpPort ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, smtpPort: Number(e.target.value) || undefined }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpUser">Usuário</Label>
              <Input id="smtpUser" value={form.smtpUser ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, smtpUser: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtpPassword">{settings?.hasSmtpPassword ? "Senha (configurada — deixe em branco para manter)" : "Senha"}</Label>
              <Input id="smtpPassword" type="password" value={form.smtpPassword ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, smtpPassword: e.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="smtpFrom">E-mail remetente</Label>
              <Input id="smtpFrom" type="email" value={form.smtpFrom ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, smtpFrom: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
      )}

      {form.provider === "MICROSOFT365" && (
        <Card>
          <CardContent className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Requer um App Registration no Azure AD do tenant do Microsoft 365, com a permissão de aplicativo
              "Mail.Send" consentida por um administrador. Cole aqui as credenciais desse aplicativo.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="m365TenantId">Directory (tenant) ID</Label>
                <Input id="m365TenantId" value={form.m365TenantId ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, m365TenantId: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m365ClientId">Application (client) ID</Label>
                <Input id="m365ClientId" value={form.m365ClientId ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, m365ClientId: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m365ClientSecret">
                  {settings?.hasM365ClientSecret ? "Client secret (configurado — deixe em branco para manter)" : "Client secret"}
                </Label>
                <Input id="m365ClientSecret" type="password" value={form.m365ClientSecret ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, m365ClientSecret: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m365SenderUpn">Caixa de e-mail remetente</Label>
                <Input id="m365SenderUpn" type="email" value={form.m365SenderUpn ?? ""} onChange={(e) => setForm((prev) => ({ ...prev, m365SenderUpn: e.target.value }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={updateSettings.isPending}>
          {updateSettings.isPending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
