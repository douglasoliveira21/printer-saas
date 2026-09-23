"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateContract } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";
import type { Contract } from "@/lib/types";

export function NotesTab({ contract }: { contract: Contract }) {
  const [notes, setNotes] = useState(contract.notes ?? "");
  const [printOnClosing, setPrintOnClosing] = useState(contract.printNotesOnClosing);
  const updateContract = useUpdateContract();

  useEffect(() => {
    setNotes(contract.notes ?? "");
    setPrintOnClosing(contract.printNotesOnClosing);
  }, [contract]);

  const dirty = notes !== (contract.notes ?? "") || printOnClosing !== contract.printNotesOnClosing;

  async function handleSave() {
    try {
      await updateContract.mutateAsync({ id: contract.id, notes, printNotesOnClosing: printOnClosing });
      toast.success("Observação salva");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao salvar observação"));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="notes">Observação</Label>
          <Textarea id="notes" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações internas sobre este contrato..." />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <Checkbox checked={printOnClosing} onCheckedChange={(v) => setPrintOnClosing(v === true)} />
          Imprimir esta observação nos fechamentos
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setNotes(contract.notes ?? ""); setPrintOnClosing(contract.printNotesOnClosing); }} disabled={!dirty}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!dirty || updateContract.isPending}>
            {updateContract.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
