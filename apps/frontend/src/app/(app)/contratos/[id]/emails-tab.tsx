"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { useAddContractEmail, useContractEmails, useRemoveContractEmail } from "@/hooks/use-contracts";
import { getApiErrorMessage } from "@/lib/api-client";

export function EmailsTab({ contractId }: { contractId: string }) {
  const { data: emails, isLoading } = useContractEmails(contractId);
  const addEmail = useAddContractEmail();
  const removeEmail = useRemoveContractEmail();
  const [email, setEmail] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    try {
      await addEmail.mutateAsync({ contractId, email: email.trim() });
      setEmail("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao adicionar e-mail"));
    }
  }

  async function handleRemove(emailId: string) {
    try {
      await removeEmail.mutateAsync({ contractId, emailId });
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover e-mail"));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">E-mails que receberão os relatórios deste contrato.</p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input type="email" placeholder="nome@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" disabled={!email.trim() || addEmail.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </form>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && !emails?.length && <EmptyState icon={Mail} title="Nenhum e-mail cadastrado ainda" />}

        <div className="space-y-2">
          {emails?.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <span>{e.email}</span>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemove(e.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
