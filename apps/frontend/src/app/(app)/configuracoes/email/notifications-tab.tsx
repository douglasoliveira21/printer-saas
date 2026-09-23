"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomers } from "@/hooks/use-customers";
import { useNotificationSettings, useUpdateNotificationSetting, type NotificationType } from "@/hooks/use-notification-settings";
import { getApiErrorMessage } from "@/lib/api-client";

const TYPE_LABEL: Record<NotificationType, string> = {
  TICKET_ASSIGNED: "Chamado atribuído a um colaborador",
  TICKET_SLA_EXPIRING: "Chamado próximo do prazo limite de SLA",
  TICKET_SLA_BREACHED: "Chamado com prazo limite de SLA esgotado",
  TICKET_CLOSED: "Chamado encerrado",
  TICKET_COMMENTED: "Novo comentário em chamado",
};

export function NotificationsTab() {
  const { data: settings, isLoading } = useNotificationSettings();
  const { data: customers } = useCustomers();
  const updateSetting = useUpdateNotificationSetting();

  async function handleChange(type: NotificationType, allCustomers: boolean, customerIds: string[]) {
    try {
      await updateSetting.mutateAsync({ type, allCustomers, customerIds });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar notificação"));
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Ativa qual notificação vale para todos os clientes ou só alguns específicos — funciona junto com o que cada
        colaborador/cliente já marcou no perfil da própria conta.
      </p>
      {settings?.map((setting) => (
        <Card key={setting.type}>
          <CardHeader>
            <CardTitle className="text-base">{TYPE_LABEL[setting.type]}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={setting.allCustomers}
                onCheckedChange={(v) => handleChange(setting.type, v === true, setting.customers.map((c) => c.id))}
              />
              Ativo para todos os clientes
            </label>
            {!setting.allCustomers && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-md border border-border p-3">
                {customers?.data.map((c) => {
                  const checked = setting.customers.some((sc) => sc.id === c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => {
                          const ids = setting.customers.map((sc) => sc.id);
                          const next = v === true ? [...ids, c.id] : ids.filter((id) => id !== c.id);
                          handleChange(setting.type, false, next);
                        }}
                      />
                      {c.tradeName || c.legalName}
                    </label>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
