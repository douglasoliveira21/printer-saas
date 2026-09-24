"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useConnectMicrosoft365,
  useDisconnectMicrosoft365,
  useEmailSettings,
  useUpdateEmailSettings,
  type EmailProvider,
  type UpdateEmailSettingsInput,
} from "@/hooks/use-email-settings";
import { getApiErrorMessage } from "@/lib/api-client";

export function EmailConfigTab() {
  const { data: settings, isLoading } = useEmailSettings();
  const updateSettings = useUpdateEmailSettings();
  const connectM365 = useConnectMicrosoft365();
  const disconnectM365 = useDisconnectMicrosoft365();
  const [form, setForm] = useState<UpdateEmailSettingsInput & { provider: EmailProvider }>({ provider: "SMTP" });
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!settings) return;
    setForm({
      provider: settings.provider,
      smtpHost: settings.smtpHost ?? undefined,
      smtpPort: settings.smtpPort ?? undefined,
      smtpUser: settings.smtpUser ?? undefined,
      smtpFrom: settings.smtpFrom ?? undefined,
    });
  }, [settings]);

  useEffect(() => {
    const m365 = searchParams.get("m365");
    if (m365 === "connected") toast.success("Microsoft 365 conectado com sucesso");
    if (m365 === "error") toast.error("Não foi possível conectar com a Microsoft — tente novamente");
  }, [searchParams]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync(form);
      toast.success("Configuração de e-mail salva");
      setForm((prev) => ({ ...prev, smtpPassword: undefined }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar configuração de e-mail"));
    }
  }

  async function handleConnect() {
    try {
      const { url } = await connectM365.mutateAsync();
      window.location.href = url;
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao iniciar conexão com a Microsoft"));
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectM365.mutateAsync();
      toast.success("Microsoft 365 desconectado");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao desconectar"));
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
            {settings?.m365Connected ? (
              <>
                <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                  <div className="text-sm">
                    <p className="font-medium">Conectado como {settings.m365ConnectedEmail ?? "conta Microsoft"}</p>
                    {settings.m365ConnectedAt && (
                      <p className="text-xs text-muted-foreground">
                        Conectado em {new Date(settings.m365ConnectedAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <Badge className="ml-auto">Ativo</Badge>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleConnect} disabled={connectM365.isPending}>
                    Trocar conta
                  </Button>
                  <Button variant="destructive" onClick={handleDisconnect} disabled={disconnectM365.isPending}>
                    Desconectar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">
                  Conecte a caixa de e-mail que vai enviar relatórios e notificações — basta entrar com a conta Microsoft
                  e autorizar o envio. Nenhum dado técnico do Azure precisa ser cadastrado aqui.
                </p>
                <Button onClick={handleConnect} disabled={connectM365.isPending}>
                  <ExternalLink className="mr-2 h-4 w-4" />
                  {connectM365.isPending ? "Conectando..." : "Conectar com Microsoft"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {form.provider === "SMTP" && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={updateSettings.isPending}>
            {updateSettings.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      )}
    </div>
  );
}
