"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div>
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ocorreu um erro inesperado ao carregar esta página.</p>
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
