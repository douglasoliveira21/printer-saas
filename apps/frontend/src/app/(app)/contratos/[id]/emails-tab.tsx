"use client";

import Link from "next/link";
import { Mail, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useReportEmailRecipients } from "@/hooks/use-report-email-recipients";

/**
 * Read-only display — recipients are managed centrally in Configurações,
 * not per contract (they receive the daily closing digest for the whole
 * company, not just this one contract's summaries).
 */
export function EmailsTab() {
  const { data: recipients, isLoading } = useReportEmailRecipients();

  return (
    <Card>
      <CardContent className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">
          Nesta área são exibidos os destinatários da sua empresa que receberão por e-mail os resumos diários de
          fechamentos.
        </p>
        <p className="text-sm text-muted-foreground">
          Os resumos diários de fechamentos mostram os fechamentos que encerraram no dia anterior, e foram
          congelados ou se tornaram pendentes.
        </p>
        <p className="text-sm text-muted-foreground">
          Para inserir novos e-mails ou editar esta lista acesse as suas configurações gerais de Envio de relatórios
          por e-mail.
        </p>

        <Button variant="outline" size="sm" render={<Link href="/configuracoes">
          <Settings className="mr-2 h-4 w-4" />
          Ir para Configurações
        </Link>} />

        {isLoading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && !recipients?.length && <EmptyState icon={Mail} title="Nenhum e-mail cadastrado ainda" />}

        <div className="space-y-2">
          {recipients?.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-2 text-sm">
              <span>{r.email}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
