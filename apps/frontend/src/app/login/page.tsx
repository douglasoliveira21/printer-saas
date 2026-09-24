"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BarChart3, Droplet, Eye, EyeOff, Lock, Mail, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";

const HIGHLIGHTS = [
  { icon: MonitorSmartphone, title: "Monitore", description: "Impressoras em tempo real, em qualquer lugar." },
  { icon: Droplet, title: "Gerencie", description: "Suprimentos e evite paradas inesperadas." },
  { icon: ShieldCheck, title: "Economize", description: "Mais controle, menos custos." },
  { icon: BarChart3, title: "Tenha insights", description: "Relatórios completos e personalizáveis." },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Painel de marca — só em telas grandes */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-950 via-blue-900 to-neutral-950 p-10 text-white xl:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative flex items-center gap-3">
          <div className="rounded-lg bg-white/95 px-3 py-2">
            <Image src="/logo.png" alt="Vgon" width={140} height={58} className="h-8 w-auto object-contain" />
          </div>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold leading-tight">Gestão inteligente para o seu parque de impressoras e suprimentos.</h1>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {HIGHLIGHTS.map(({ icon: Icon, title, description }) => (
              <div key={title} className="space-y-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon className="h-5 w-5 text-sky-300" />
                </div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="text-xs leading-relaxed text-blue-200/80">{description}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-blue-300/70">© {new Date().getFullYear()} Vgon Soluções em Informática. Todos os direitos reservados.</p>
      </div>

      {/* Formulário */}
      <div className="flex w-full flex-1 flex-col items-center justify-center bg-white p-4 dark:bg-neutral-950 xl:w-1/2">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center text-center">
            <Image src="/logo.png" alt="Vgon" width={220} height={90} className="mb-4 h-14 w-auto object-contain" />
            <p className="text-sm text-muted-foreground">Acesso à sua conta</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="pl-8"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="exemplo@empresa.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="px-8"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
                Lembrar de mim
              </label>
              <Link href="/esqueci-senha" className="text-sm text-blue-600 hover:underline">
                Esqueceu sua senha?
              </Link>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                "Entrando..."
              ) : (
                <>
                  Entrar
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Vgon Printer · © {new Date().getFullYear()} Vgon. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
