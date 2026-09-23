import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Termos de Uso — Printer SaaS" };

export default function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <Link href="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">
          Texto padrão (placeholder) — ainda não revisado juridicamente. Substitua por um termo de uso real antes de
          publicar em produção.
        </p>

        <section className="space-y-2 text-sm leading-relaxed text-foreground">
          <h2 className="text-lg font-medium">1. Aceitação dos termos</h2>
          <p>
            Ao acessar e usar esta plataforma, você concorda em cumprir estes Termos de Uso e todas as leis e
            regulamentos aplicáveis. Se você não concordar com algum destes termos, está proibido de usar ou acessar
            este serviço.
          </p>

          <h2 className="text-lg font-medium">2. Uso da plataforma</h2>
          <p>
            Esta plataforma é fornecida para gestão de parque de impressoras, chamados técnicos, contratos e
            faturamento entre a sua empresa e seus clientes. O uso indevido, incluindo tentativas de acesso não
            autorizado a dados de outros tenants, é expressamente proibido.
          </p>

          <h2 className="text-lg font-medium">3. Contas de usuário</h2>
          <p>
            Você é responsável por manter a confidencialidade de sua senha e por todas as atividades realizadas com
            sua conta. Notifique imediatamente qualquer uso não autorizado.
          </p>

          <h2 className="text-lg font-medium">4. Disponibilidade do serviço</h2>
          <p>
            Envidamos esforços para manter a plataforma disponível, mas não garantimos operação ininterrupta ou livre
            de erros.
          </p>

          <h2 className="text-lg font-medium">5. Alterações</h2>
          <p>Estes termos podem ser atualizados periodicamente. O uso continuado da plataforma constitui aceitação das alterações.</p>

          <h2 className="text-lg font-medium">6. Contato</h2>
          <p>Dúvidas sobre estes termos devem ser encaminhadas à administração da sua empresa.</p>
        </section>
      </div>
    </div>
  );
}
