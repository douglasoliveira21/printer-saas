"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useCreateServiceOrderType,
  useDeleteServiceOrderType,
  useServiceOrderTypes,
  useUpdateServiceOrderType,
} from "@/hooks/use-service-order-types";
import { getApiErrorMessage } from "@/lib/api-client";

export default function ChamadosSettingsPage() {
  const { data: types, isLoading } = useServiceOrderTypes();
  const createType = useCreateServiceOrderType();
  const updateType = useUpdateServiceOrderType();
  const deleteType = useDeleteServiceOrderType();

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [blankLines, setBlankLines] = useState("0");

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createType.mutateAsync({ name: name.trim(), defaultPrice: price ? Number(price) : undefined, blankLinesOnPrint: Number(blankLines) || 0 });
      setName("");
      setPrice("");
      setBlankLines("0");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar tipo de chamado"));
    }
  }

  async function handleToggleActive(id: string, active: boolean) {
    try {
      await updateType.mutateAsync({ id, active });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao atualizar tipo de chamado"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteType.mutateAsync(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir tipo de chamado"));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Chamados" description="Tipos de chamado, serviço/valor e linhas em branco na impressão." />

      <Card>
        <CardContent className="space-y-3 py-4">
          <p className="text-sm text-muted-foreground">
            O número de linhas configurado aqui é exibido por padrão ao marcar a opção "Exibir linhas adicionais em
            branco nos itens do chamado" na impressão de um chamado desse tipo.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-2">
              <Input placeholder="Nome do tipo de chamado" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="w-36 space-y-2">
              <Input type="number" step="0.01" min="0" placeholder="Valor do serviço (R$)" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="w-44 space-y-2">
              <Input type="number" min="0" placeholder="Linhas em branco" value={blankLines} onChange={(e) => setBlankLines(e.target.value)} />
            </div>
            <Button onClick={handleCreate} disabled={!name.trim() || createType.isPending}>
              <Plus className="mr-2 h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isLoading && !types?.length && <EmptyState icon={Wrench} title="Nenhum tipo de chamado cadastrado ainda" />}

      {(types?.length ?? 0) > 0 && (
        <Card>
          <CardContent className="space-y-2 py-4">
            {types!.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
                <div className="flex items-center gap-3">
                  <Badge variant={t.active ? "default" : "secondary"}>{t.active ? "Ativo" : "Inativo"}</Badge>
                  <span className="font-medium">{t.name}</span>
                  <span className="text-muted-foreground">
                    {t.defaultPrice ? Number(t.defaultPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Sem valor padrão"}
                    {" · "}
                    {t.blankLinesOnPrint} linha(s) em branco
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleToggleActive(t.id, !t.active)}>
                    {t.active ? "Desativar" : "Ativar"}
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(t.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
