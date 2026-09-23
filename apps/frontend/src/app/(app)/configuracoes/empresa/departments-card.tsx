"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Building2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { useCreateDepartment, useDeleteDepartment, useDepartments } from "@/hooks/use-departments";
import { getApiErrorMessage } from "@/lib/api-client";

export function DepartmentsCard() {
  const { data: departments, isLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const deleteDepartment = useDeleteDepartment();
  const [name, setName] = useState("");

  async function handleCreate() {
    if (!name.trim()) return;
    try {
      await createDepartment.mutateAsync(name.trim());
      setName("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao criar departamento"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDepartment.mutateAsync(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao excluir departamento"));
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Departamentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
        >
          <Input placeholder="Nome do departamento" value={name} onChange={(e) => setName(e.target.value)} />
          <Button type="submit" disabled={!name.trim() || createDepartment.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </form>

        {!isLoading && !departments?.length && <EmptyState icon={Building2} title="Nenhum departamento cadastrado" />}

        <div className="space-y-2">
          {departments?.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <span>
                {d.name}
                {(d._count?.printers ?? 0) > 0 && <span className="ml-2 text-xs text-muted-foreground">{d._count!.printers} impressora(s)</span>}
              </span>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(d.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
