import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <FileQuestion className="h-7 w-7 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="mt-1 text-sm text-muted-foreground">O endereço que você acessou não existe ou foi movido.</p>
      </div>
      <Button render={<Link href="/painel" />}>Voltar ao início</Button>
    </div>
  );
}
