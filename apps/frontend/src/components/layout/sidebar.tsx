"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className={cn("flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-6">
        <Image src="/logo.png" alt="Printer SaaS" width={28} height={28} className="rounded" />
        <span className="font-semibold text-lg tracking-tight">Printer SaaS</span>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {user?.isSuperAdmin && (
          <Link
            href="/plataforma"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/plataforma")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Plataforma
          </Link>
        )}
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
