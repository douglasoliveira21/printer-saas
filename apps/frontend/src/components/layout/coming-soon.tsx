import { Construction } from "lucide-react";

export function ComingSoon({ title }: { title?: string }) {
  return (
    <div className="space-y-6">
      {title && <h1 className="text-2xl font-semibold">{title}</h1>}
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-16 text-center text-neutral-400">
        <Construction className="h-8 w-8" />
        <p className="font-medium">Em desenvolvimento</p>
        <p className="max-w-sm text-sm">Este módulo ainda não foi implementado nesta versão do sistema.</p>
      </div>
    </div>
  );
}
