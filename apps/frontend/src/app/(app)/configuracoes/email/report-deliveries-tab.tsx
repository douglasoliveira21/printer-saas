"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomers } from "@/hooks/use-customers";
import { useReportDeliveries, useUpdateReportDelivery, type CustomerEmailField, type ReportType } from "@/hooks/use-report-deliveries";
import { getApiErrorMessage } from "@/lib/api-client";

const TYPE_LABEL: Record<ReportType, string> = {
  PRINTER_USAGE: "Digitação por impressora",
  CLOSING_DIGEST: "Resumo diário de fechamentos",
  PRINTER_USAGE_WITH_COPIES: "Digitação e cópias por impressora",
};

const EMAIL_FIELD_LABEL: Record<CustomerEmailField, string> = {
  EMAIL: "E-mail principal",
  FINANCIAL_EMAIL: "E-mail financeiro",
  SUPPORT_EMAIL: "E-mail para suporte",
};

export function ReportDeliveriesTab() {
  const { data: deliveries, isLoading } = useReportDeliveries();
  const { data: customers } = useCustomers();
  const updateDelivery = useUpdateReportDelivery();

  async function handleChange(
    reportType: ReportType,
    allCustomers: boolean,
    emailField: CustomerEmailField,
    customerIds: string[],
  ) {
    try {
      await updateDelivery.mutateAsync({ reportType, allCustomers, emailField, customerIds });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar envio de relatório"));
    }
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Escolha, por tipo de relatório, se ele vai para todos os clientes ou só alguns, e qual e-mail cadastrado no
        cliente será usado.
      </p>
      {deliveries?.map((delivery) => {
        const customerIds = delivery.customers.map((c) => c.id);
        return (
          <Card key={delivery.reportType}>
            <CardHeader>
              <CardTitle className="text-base">{TYPE_LABEL[delivery.reportType]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={delivery.allCustomers}
                    onCheckedChange={(v) => handleChange(delivery.reportType, v === true, delivery.emailField, customerIds)}
                  />
                  Enviar para todos os clientes
                </label>
                <div className="flex items-center gap-2">
                  <Label className="text-sm text-muted-foreground">E-mail usado</Label>
                  <Select
                    value={delivery.emailField}
                    onValueChange={(v) => v && handleChange(delivery.reportType, delivery.allCustomers, v as CustomerEmailField, customerIds)}
                  >
                    <SelectTrigger className="w-52">
                      <SelectValue>{() => EMAIL_FIELD_LABEL[delivery.emailField]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(EMAIL_FIELD_LABEL) as CustomerEmailField[]).map((field) => (
                        <SelectItem key={field} value={field}>
                          {EMAIL_FIELD_LABEL[field]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {!delivery.allCustomers && (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-md border border-border p-3">
                  {customers?.data.map((c) => {
                    const checked = customerIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const next = v === true ? [...customerIds, c.id] : customerIds.filter((id) => id !== c.id);
                            handleChange(delivery.reportType, false, delivery.emailField, next);
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
        );
      })}
    </div>
  );
}
