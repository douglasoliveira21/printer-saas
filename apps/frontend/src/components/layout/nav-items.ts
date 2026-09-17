import {
  LayoutDashboard,
  Printer,
  Users,
  FileText,
  Wrench,
  Wallet,
  Boxes,
  Droplet,
  BarChart3,
  Bell,
  Cpu,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Impressoras", href: "/impressoras", icon: Printer },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Contratos", href: "/contratos", icon: FileText },
  { label: "Ordens de Serviço", href: "/ordens-servico", icon: Wrench },
  { label: "Financeiro", href: "/financeiro", icon: Wallet },
  { label: "Estoque", href: "/estoque", icon: Boxes },
  { label: "Suprimentos", href: "/suprimentos", icon: Droplet },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Alertas", href: "/alertas", icon: Bell },
  { label: "Agents", href: "/agents", icon: Cpu },
  { label: "Configurações", href: "/configuracoes", icon: Settings },
];
