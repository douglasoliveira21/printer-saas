"use client";

import { Menu, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth-context";
import { Sidebar } from "./sidebar";

export function Header({ title, className }: { title?: string; className?: string }) {
  const { user, logout } = useAuth();

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
          <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
