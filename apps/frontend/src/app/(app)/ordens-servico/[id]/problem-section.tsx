"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateServiceOrder } from "@/hooks/use-service-orders";
import { getApiErrorMessage } from "@/lib/api-client";
import type { ServiceOrder } from "@/lib/types";
import { SYMPTOM_OPTIONS } from "./labels";
import { cn } from "@/lib/utils";

export function ProblemSection({ order }: { order: ServiceOrder }) {
  const [description, setDescription] = useState(order.description ?? "");
  const [symptoms, setSymptoms] = useState<string[]>(order.symptoms ?? []);
  const updateOrder = useUpdateServiceOrder();

  const dirty = description !== (order.description ?? "") || JSON.stringify(symptoms) !== JSON.stringify(order.symptoms ?? []);

  function toggleSymptom(symptom: string) {
    setSymptoms((prev) => (prev.includes(symptom) ? prev.filter((s) => s !== symptom) : [...prev, symptom]));
  }

  async function handleSave() {
    try {
      await updateOrder.mutateAsync({ id: order.id, description, symptoms });
      toast.success("Salvo");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">2. Problema / Solicitação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="description">Descrição do problema</Label>
          <Textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Sintomas</Label>
          <div className="flex flex-wrap gap-2">
            {SYMPTOM_OPTIONS.map((symptom) => (
              <Badge
                key={symptom}
                variant={symptoms.includes(symptom) ? "default" : "outline"}
                className={cn("cursor-pointer select-none", !symptoms.includes(symptom) && "text-muted-foreground")}
                onClick={() => toggleSymptom(symptom)}
              >
                {symptom}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground">Contador atual</Label>
          <p className="text-sm font-medium">
            {order.counterAtOpening !== null ? `${order.counterAtOpening.toLocaleString("pt-BR")} páginas` : "Não disponível"}
          </p>
        </div>

        <div className="flex justify-end">
          <Button size="sm" onClick={handleSave} disabled={!dirty || updateOrder.isPending}>
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
