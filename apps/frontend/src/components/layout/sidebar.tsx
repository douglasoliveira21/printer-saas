"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Printer, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav className={cn("flex h-full w-64 flex-col border-r bg-white dark:bg-neutral-950", className)}>
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <Printer className="h-6 w-6 text-blue-600" />
        <span className="font-semibold text-lg tracking-tight">Printer SaaS</span>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {user?.isSuperAdmin && (
          <Link
            href="/plataforma"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/plataforma")
                ? "bg-purple-600 text-white"
                : "text-purple-700 hover:bg-purple-50 dark:text-purple-300 dark:hover:bg-purple-950/40",
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
                  ? "bg-blue-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900",
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
