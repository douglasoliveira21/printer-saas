"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { EmpresaTab } from "./empresa-tab";
import { ReportSettingsTab } from "./report-settings-tab";

export default function EmpresaSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Informações da empresa" description="Dados gerais, logotipo, departamentos e configurações de relatório." />

      <Tabs defaultValue="empresa">
        <TabsList>
          <TabsTrigger value="empresa">Empresa</TabsTrigger>
          <TabsTrigger value="report-settings">Configurações de relatório</TabsTrigger>
        </TabsList>

        <TabsContent value="empresa" className="mt-4">
          <EmpresaTab />
        </TabsContent>
        <TabsContent value="report-settings" className="mt-4">
          <ReportSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
