import {
  LayoutDashboard,
  Printer,
  Users,
  Wrench,
  Wallet,
  Boxes,
  Droplet,
  BarChart3,
  Cpu,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavChild {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional sub-items rendered as a collapsible group in the sidebar. */
  children?: NavChild[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Painel", href: "/painel", icon: LayoutDashboard },
  {
    label: "Impressoras",
    href: "/impressoras",
    icon: Printer,
    children: [
      { label: "Parque Completo", href: "/impressoras" },
      { label: "Impressoras por Cliente", href: "/impressoras/por-cliente" },
      { label: "Novas Impressoras", href: "/impressoras/novas" },
      { label: "Monitoramentos Duplicados", href: "/impressoras/duplicados" },
    ],
  },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Ordens de Serviço", href: "/ordens-servico", icon: Wrench },
  {
    label: "Financeiro",
    href: "/financeiro",
    icon: Wallet,
    children: [
      { label: "Fechamentos", href: "/financeiro/fechamentos" },
      { label: "Contratos", href: "/contratos" },
    ],
  },
  { label: "Estoque", href: "/estoque", icon: Boxes },
  {
    label: "Suprimentos",
    href: "/suprimentos",
    icon: Droplet,
    children: [
      { label: "Reposição e Trocas", href: "/suprimentos" },
      { label: "Níveis dos Suprimentos", href: "/suprimentos/niveis" },
    ],
  },
  { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
  { label: "Agents", href: "/agents", icon: Cpu },
  {
    label: "Configurações",
    href: "/configuracoes",
    icon: Settings,
    children: [
      { label: "Geral", href: "/configuracoes" },
      { label: "E-mail", href: "/configuracoes/email" },
      { label: "Alertas", href: "/configuracoes/alertas" },
      { label: "Chamados", href: "/configuracoes/chamados" },
      { label: "Informações da empresa", href: "/configuracoes/empresa" },
    ],
  },
];
