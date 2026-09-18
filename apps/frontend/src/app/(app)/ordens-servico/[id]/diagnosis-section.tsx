"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder } from "@/lib/types";

const FIELDS: { key: keyof ServiceOrder; label: string; placeholder?: string }[] = [
  { key: "diagnosis", label: "Diagnóstico", placeholder: "Ex: unidade fusora apresentando desgaste." },
  { key: "causeIdentified", label: "Causa identificada", placeholder: "Ex: desgaste natural do fusor." },
  { key: "testsPerformed", label: "Testes realizados", placeholder: "Ex: realizada impressão de 20 páginas para confirmação." },
  { key: "defectiveParts", label: "Peças com problema" },
  { key: "suppliesUsed", label: "Suprimentos utilizados" },
  { key: "technicalNotes", label: "Observações técnicas" },
];

export function DiagnosisSection({ order }: { order: ServiceOrder }) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, (order[f.key] as string) ?? ""])),
  );
  const updateOrder = useUpdateServiceOrder();

  const dirty = FIELDS.some((f) => values[f.key] !== ((order[f.key] as string) ?? ""));

  async function handleSave() {
    try {
      await updateOrder.mutateAsync({ id: order.id, ...values });
      toast.success("Salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">3. Diagnóstico técnico</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-2">
            <Label htmlFor={f.key}>{f.label}</Label>
            <Textarea
              id={f.key}
              rows={2}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={!dirty || updateOrder.isPending}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
