"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useCreatePrinterErrorCode,
  useDeletePrinterErrorCode,
  usePrinterErrorCodes,
  type AlertSeverity,
} from "@/hooks/use-printer-error-codes";
import { getApiErrorMessage } from "@/lib/api-client";

const SEVERITY_LABEL: Record<AlertSeverity, string> = { INFO: "Informativo", WARNING: "Atenção", CRITICAL: "Crítico" };
const SEVERITY_VARIANT: Record<AlertSeverity, "default" | "secondary" | "destructive"> = { INFO: "secondary", WARNING: "default", CRITICAL: "destructive" };

export function ErrorCodesTab() {
  const { data: codes, isLoading } = usePrinterErrorCodes();
  const createCode = useCreatePrinterErrorCode();
  const deleteCode = useDeletePrinterErrorCode();

  const [manufacturer, setManufacturer] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<AlertSeverity>("WARNING");

  async function handleCreate() {
    if (!manufacturer.trim() || !code.trim() || !description.trim()) return;
    try {
      await createCode.mutateAsync({ manufacturer: manufacturer.trim(), code: code.trim(), description: description.trim(), severity });
      setManufacturer("");
      setCode("");
      setDescription("");
      setSeverity("WARNING");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao adicionar código"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteCode.mutateAsync(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir código"));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Catálogo de referência — o Agent ainda não reporta o código de erro bruto da impressora, então isso não
        dispara alerta sozinho ainda; serve de consulta manual para a equipe.
      </p>
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-40 space-y-2">
              <Input placeholder="Fabricante" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="w-32 space-y-2">
              <Input placeholder="Código" value={code} onChange={(e) => setCode(e.target.value)} />
            </div>
            <div className="min-w-[220px] flex-1 space-y-2">
              <Input placeholder="Descrição" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="w-40 space-y-2">
              <Select value={severity} onValueChange={(v) => v && setSeverity(v as AlertSeverity)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{() => SEVERITY_LABEL[severity]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SEVERITY_LABEL) as AlertSeverity[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {SEVERITY_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} disabled={createCode.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isLoading && !codes?.length && <EmptyState icon={AlertTriangle} title="Nenhum código cadastrado ainda" />}

      {(codes?.length ?? 0) > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            {codes!.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
                <div className="flex items-center gap-3">
                  <Badge variant={SEVERITY_VARIANT[c.severity]}>{SEVERITY_LABEL[c.severity]}</Badge>
                  <span className="font-medium">{c.manufacturer} — {c.code}</span>
                  <span className="text-muted-foreground">{c.description}</span>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
