"use client";

import { useState, type FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, Printer, ShieldCheck, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-neutral-900 p-10 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white/10">
            <Image src="/logo.png" alt="Printer SaaS" width={40} height={40} className="object-contain" />
          </div>
          <span className="text-lg font-semibold">Printer SaaS</span>
        </div>

        <div className="space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            Gestão completa de impressoras, contratos e chamados em um só lugar.
          </h1>
          <div className="space-y-4 text-sm text-blue-100">
            <div className="flex items-center gap-3">
              <Printer className="h-5 w-5 shrink-0" />
              <span>Monitoramento em tempo real de níveis de suprimentos e contadores</span>
            </div>
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 shrink-0" />
              <span>Ordens de serviço, contratos e fechamentos financeiros integrados</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>Ambiente seguro e isolado para cada empresa</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-blue-200">© {new Date().getFullYear()} Printer SaaS. Todos os direitos reservados.</p>
      </div>

      <div className="flex w-full flex-1 items-center justify-center bg-neutral-50 p-4 dark:bg-neutral-900 lg:w-1/2">
        <Card className="w-full max-w-sm border-none shadow-lg lg:border lg:shadow-sm">
          <CardHeader className="items-center text-center lg:items-start lg:text-left">
            <div className="mb-2 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-blue-600 lg:hidden">
              <Image src="/logo.png" alt="Printer SaaS" width={56} height={56} className="object-cover" />
            </div>
            <CardTitle className="text-xl">Bem-vindo de volta</CardTitle>
            <CardDescription>Entre com sua conta para continuar</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@demo.local"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <Link href="/esqueci-senha" className="text-xs text-blue-600 hover:underline">
                    Esqueceu a senha?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    className="pr-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
