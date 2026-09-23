import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = { title: "Política de Privacidade — Printer SaaS" };

export default function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 md:p-10">
      <Link href="/painel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Texto padrão (placeholder) — ainda não revisado juridicamente (LGPD). Substitua por uma política de
          privacidade real antes de publicar em produção.
        </p>

        <section className="space-y-2 text-sm leading-relaxed text-foreground">
          <h2 className="text-lg font-medium">1. Dados coletados</h2>
          <p>
            Coletamos dados cadastrais (nome, e-mail, telefone), dados operacionais de impressoras (contadores,
            níveis de suprimento, status de conexão) e dados de uso da plataforma necessários para o funcionamento
            do serviço.
          </p>

          <h2 className="text-lg font-medium">2. Uso dos dados</h2>
          <p>
            Os dados são usados exclusivamente para prestação do serviço de gestão de parque de impressoras,
            faturamento e suporte técnico entre a sua empresa e seus clientes.
          </p>

          <h2 className="text-lg font-medium">3. Isolamento entre empresas</h2>
          <p>
            Cada empresa (tenant) tem seus dados isolados dos demais — nenhuma outra empresa usuária da plataforma
            tem acesso aos seus dados.
          </p>

          <h2 className="text-lg font-medium">4. Compartilhamento</h2>
          <p>Não compartilhamos dados pessoais com terceiros, exceto quando exigido por lei ou com seu consentimento explícito.</p>

          <h2 className="text-lg font-medium">5. Segurança</h2>
          <p>Adotamos medidas técnicas e organizacionais razoáveis para proteger os dados contra acesso não autorizado.</p>

          <h2 className="text-lg font-medium">6. Seus direitos</h2>
          <p>
            Nos termos da LGPD (Lei nº 13.709/2018), você pode solicitar acesso, correção ou exclusão dos seus dados
            pessoais entrando em contato com a administração da sua empresa.
          </p>
        </section>
      </div>
    </div>
  );
}
