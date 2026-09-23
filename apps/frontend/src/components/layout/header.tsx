"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, FileText, KeyRound, LogOut, Menu, Shield, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { fetchLatestAgentRelease } from "@/hooks/use-my-account";
import { getApiErrorMessage } from "@/lib/api-client";
import { Sidebar } from "./sidebar";
import { MyProfileDialog } from "./my-profile-dialog";
import { ChangePasswordDialog } from "./change-password-dialog";

export function Header({ title, className }: { title?: string; className?: string }) {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  async function handleDownloadAgent() {
    try {
      const release = await fetchLatestAgentRelease();
      if (!release) {
        toast.error("Nenhuma versão do Agent publicada ainda");
        return;
      }
      window.open(release.downloadUrl, "_blank");
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Erro ao buscar o instalador do Agent"));
    }
  }

  return (
    <header className={cn("flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-6", className)}>
      <div className="flex items-center gap-3">
        <Sheet>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <Sidebar />
          </SheetContent>
        </Sheet>
        {title && <h1 className="text-lg font-semibold">{title}</h1>}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2" />}>
          <UserIcon className="h-4 w-4" />
          <span className="hidden sm:inline">{user?.name ?? "Usuário"}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setProfileOpen(true)}>
            <UserIcon className="mr-2 h-4 w-4" />
            Meu perfil
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setPasswordOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Alterar senha
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDownloadAgent}>
            <Download className="mr-2 h-4 w-4" />
            Baixar Agent (MSI)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.open("/termos", "_blank")}>
            <FileText className="mr-2 h-4 w-4" />
            Termos de uso
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.open("/privacidade", "_blank")}>
            <Shield className="mr-2 h-4 w-4" />
            Política de privacidade
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MyProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />
    </header>
  );
}
