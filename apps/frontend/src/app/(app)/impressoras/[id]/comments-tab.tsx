"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/shared/empty-state";
import { useCreatePrinterComment, usePrinterComments } from "@/hooks/use-printers";
import { getApiErrorMessage } from "@/lib/api-client";

export function CommentsTab({ printerId }: { printerId: string }) {
  const { data: comments, isLoading } = usePrinterComments(printerId);
  const createComment = useCreatePrinterComment();
  const [body, setBody] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    try {
      await createComment.mutateAsync({ id: printerId, body: body.trim() });
      setBody("");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao adicionar comentário"));
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea placeholder="Adicionar um comentário..." value={body} onChange={(e) => setBody(e.target.value)} rows={3} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={!body.trim() || createComment.isPending}>
            {createComment.isPending ? "Enviando..." : "Comentar"}
          </Button>
        </div>
      </form>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      {!isLoading && (!comments || comments.length === 0) && (
        <Card>
          <EmptyState icon={MessageSquare} title="Nenhum comentário ainda" />
        </Card>
      )}
      <div className="space-y-3">
        {comments?.map((c) => (
          <Card key={c.id}>
            <CardContent className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{c.user?.name ?? "Usuário removido"}</span>
                <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString("pt-BR")}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
