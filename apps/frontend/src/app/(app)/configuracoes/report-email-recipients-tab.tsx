"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { useAddReportEmailRecipient, useReportEmailRecipients, useRemoveReportEmailRecipient } from "@/hooks/use-report-email-recipients";
import { getApiErrorMessage } from "@/lib/api-client";

export function ReportEmailRecipientsTab() {
  const { data: recipients, isLoading } = useReportEmailRecipients();
  const addRecipient = useAddReportEmailRecipient();
  const removeRecipient = useRemoveReportEmailRecipient();
  const [email, setEmail] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    try {
      await addRecipient.mutateAsync(email.trim());
      setEmail("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao adicionar e-mail"));
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeRecipient.mutateAsync(id);
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao remover e-mail"));
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          E-mails da sua empresa que receberão os resumos diários de fechamentos (fechamentos que encerraram no dia
          anterior, congelados ou pendentes).
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input type="email" placeholder="nome@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" disabled={!email.trim() || addRecipient.isPending}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar
          </Button>
        </form>

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && !recipients?.length && <EmptyState icon={Mail} title="Nenhum e-mail cadastrado ainda" />}

        <div className="space-y-2">
          {recipients?.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <span>{r.email}</span>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemove(r.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
