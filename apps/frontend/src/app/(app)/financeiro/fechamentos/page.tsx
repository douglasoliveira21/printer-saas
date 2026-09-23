"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ClosingMonthTab } from "../closing-month-tab";
import { ClosingHistoryTab } from "../closing-history-tab";

export default function FechamentosPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Fechamentos" description="Fechamentos mensais de faturamento por cliente." className="print:hidden" />

      <Tabs defaultValue="mes">
        <TabsList className="print:hidden">
          <TabsTrigger value="mes">Fechamento do mês</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="mes" className="mt-4">
          <ClosingMonthTab />
        </TabsContent>
        <TabsContent value="historico" className="mt-4 print:hidden">
          <ClosingHistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
