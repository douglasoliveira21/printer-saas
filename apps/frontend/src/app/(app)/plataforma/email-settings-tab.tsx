"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePlatformEmailSettings, useUpdatePlatformEmailSettings } from "@/hooks/use-platform-email-settings";
import { getApiErrorMessage } from "@/lib/api-client";

export function EmailSettingsTab() {
  const { data: settings, isLoading } = usePlatformEmailSettings();
  const updateSettings = useUpdatePlatformEmailSettings();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");

  useEffect(() => {
    if (settings) setClientId(settings.m365ClientId ?? "");
  }, [settings]);

  async function handleSave() {
    try {
      await updateSettings.mutateAsync({ m365ClientId: clientId, m365ClientSecret: clientSecret || undefined });
      toast.success("Configuração salva");
      setClientSecret("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  function copyRedirectUri() {
    if (!settings?.redirectUri) return;
    navigator.clipboard.writeText(settings.redirectUri);
    toast.success("Redirect URI copiado");
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" />
          Microsoft 365 — App Registration
        </CardTitle>
        <CardDescription>
          App Registration único, multi-tenant, usado por todos os clientes da plataforma quando conectam a conta
          Microsoft em Configurações &gt; E-mail. Cadastrado uma vez aqui — nenhum tenant final vê nem edita isso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Redirect URI (cadastrar no Azure/Entra)</Label>
          <div className="flex gap-2">
            <Input readOnly value={settings?.redirectUri ?? ""} className="font-mono text-xs" />
            <Button type="button" variant="outline" size="icon" onClick={copyRedirectUri}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="m365ClientId">Application (client) ID</Label>
          <Input id="m365ClientId" value={clientId} onChange={(e) => setClientId(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="m365ClientSecret">
            {settings?.hasM365ClientSecret ? "Client secret (configurado — deixe em branco para manter)" : "Client secret"}
          </Label>
          <Input id="m365ClientSecret" type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!clientId.trim() || updateSettings.isPending}>
            {updateSettings.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
