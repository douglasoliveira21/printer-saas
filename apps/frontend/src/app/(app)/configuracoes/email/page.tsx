"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { NotificationsTab } from "./notifications-tab";
import { ReportDeliveriesTab } from "./report-deliveries-tab";
import { EmailConfigTab } from "./email-config-tab";

export default function EmailSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="E-mail" description="Notificações, envio de relatórios e configuração do provedor de e-mail." />

      <Tabs defaultValue="notifications">
        <TabsList>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="report-deliveries">Envio de relatórios</TabsTrigger>
          <TabsTrigger value="config">Configuração do e-mail</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="report-deliveries" className="mt-4">
          <ReportDeliveriesTab />
        </TabsContent>
        <TabsContent value="config" className="mt-4">
          <EmailConfigTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
