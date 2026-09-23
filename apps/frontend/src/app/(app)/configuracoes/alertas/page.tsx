"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { CommunicationThresholdsTab } from "./communication-thresholds-tab";
import { PreventiveMaintenanceTab } from "./preventive-maintenance-tab";
import { ErrorCodesTab } from "./error-codes-tab";

export default function AlertasSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Alertas" description="Limiar de falha de comunicação, manutenção preventiva e códigos de erro." />

      <Tabs defaultValue="communication">
        <TabsList>
          <TabsTrigger value="communication">Falha de comunicação</TabsTrigger>
          <TabsTrigger value="preventive">Manutenção preventiva</TabsTrigger>
          <TabsTrigger value="error-codes">Códigos de erro</TabsTrigger>
        </TabsList>

        <TabsContent value="communication" className="mt-4">
          <CommunicationThresholdsTab />
        </TabsContent>
        <TabsContent value="preventive" className="mt-4">
          <PreventiveMaintenanceTab />
        </TabsContent>
        <TabsContent value="error-codes" className="mt-4">
          <ErrorCodesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
