"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import { uploadedFileUrl } from "@/lib/api-client";
import { useTenantInfo } from "@/hooks/use-tenant-settings";
import { NAV_ITEMS, type NavItem } from "./nav-items";

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { data: tenant } = useTenantInfo();

  return (
    <nav className={cn("flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground", className)}>
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
        {tenant?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- tenant logo is an arbitrary uploaded file, not a build-time-known asset
          <img src={uploadedFileUrl(tenant.logoUrl)} alt={tenant.name} className="h-full max-w-full object-contain py-2" />
        ) : (
          <Image src="/logo.png" alt="Printer SaaS" width={160} height={48} className="h-full w-auto object-contain py-2" />
        )}
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
        {NAV_ITEMS.map((item) =>
          item.children?.length ? (
            <NavGroup key={item.href} item={item} pathname={pathname} />
          ) : (
            <NavLink key={item.href} item={item} active={isActive(pathname, item.href)} />
          ),
        )}
      </div>
    </nav>
  );
}

/** A child route is active on exact match, or when the current path is nested
 * under it — except "/" -level parents like /impressoras that are also a
 * child href, which must match exactly so "Parque Completo" doesn't stay lit
 * on every sub-route. */
function isActive(pathname: string, href: string, exact = false) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
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
}

function NavGroup({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  // Checked against every child, not just item.href — a child like
  // "Contratos" under "Financeiro" lives at /contratos, not nested under
  // /financeiro/*, so matching only the parent's own href would leave the
  // group collapsed/unlit while the user is actually inside it.
  const groupActive =
    isActive(pathname, item.href) || (item.children?.some((child) => isActive(pathname, child.href, child.href === item.href)) ?? false);
  const [open, setOpen] = useState(groupActive);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          groupActive
            ? "bg-sidebar-primary/10 text-sidebar-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open ? "rotate-180" : "")} />
      </button>
      {open && (
        <div className="mt-1 space-y-1 border-l border-sidebar-border pl-3 ml-4">
          {item.children!.map((child) => {
            // The parent href (e.g. /impressoras) doubles as the first child,
            // so it must match exactly; deeper children match by prefix.
            const exact = child.href === item.href;
            const active = isActive(pathname, child.href, exact);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "block rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
