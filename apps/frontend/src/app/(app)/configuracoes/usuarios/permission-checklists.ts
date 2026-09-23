// Checkbox → chave(s) de permissão real, ver o plano em
// "Contas de usuário" — reaproveita as chaves que já gateiam os
// controllers existentes sempre que possível, só cria chave nova pros
// conceitos que ainda não existem em lugar nenhum.

export interface PermissionChecklistItem {
  label: string;
  keys: string[];
}

export const STAFF_PERMISSIONS: PermissionChecklistItem[] = [
  { label: "Gerenciar outras contas", keys: ["settings.manage"] },
  { label: "Gerenciar impressoras", keys: ["printers.create", "printers.edit", "printers.delete"] },
  { label: "Gerenciar dispositivos", keys: ["agents.create"] },
  { label: "Visualizar dispositivos", keys: ["agents.view"] },
  { label: "Gerenciar clientes", keys: ["customers.create", "customers.edit", "customers.delete"] },
  { label: "Editar configurações gerais da sua empresa", keys: ["company_settings.edit"] },
  { label: "Visualizar gráficos e relatórios com quantidade de páginas impressas", keys: ["reports.view"] },
  { label: "Visualizar custos", keys: ["costs.view"] },
  { label: "Editar configurações de contratos e custos", keys: ["contracts.edit"] },
  { label: "Mover itens de estoque", keys: ["inventory.move"] },
  { label: "Adicionar, Alterar e Excluir itens de estoque", keys: ["inventory.create", "inventory.edit", "inventory.delete"] },
  { label: "Gerenciamento financeiro", keys: ["financial.create", "financial.edit"] },
  { label: "Encerrar chamados", keys: ["service_orders.close"] },
  { label: "Editar a data e hora de início e fim de atendimento dos chamados", keys: ["service_orders.edit_schedule"] },
  { label: "Habilitar e desabilitar os módulos do sistema por cliente", keys: ["customers.toggle_modules"] },
  { label: "Permitir programar reposição", keys: ["restock.schedule"] },
  { label: "Permitir confirmar reposição", keys: ["restock.confirm"] },
  { label: "Gerenciar monitoramento de conexões", keys: ["connections.manage"] },
];

export const CUSTOMER_PERMISSIONS: PermissionChecklistItem[] = [
  { label: "Gerenciar outras contas", keys: ["settings.manage"] },
  { label: "Gerenciar impressoras", keys: ["printers.create", "printers.edit", "printers.delete"] },
  { label: "Gerenciar dispositivos", keys: ["agents.create"] },
  { label: "Visualizar dispositivos", keys: ["agents.view"] },
  { label: "Gerenciar configurações do cliente", keys: ["customer_settings.manage"] },
  { label: "Visualizar gráficos e relatórios com quantidade de páginas impressas", keys: ["reports.view"] },
  { label: "Visualizar custos", keys: ["costs.view"] },
  { label: "Visualizar alertas criados por impressoras", keys: ["alerts.view"] },
  { label: "Visualizar chamados criados por outros usuários", keys: ["service_orders.view"] },
  { label: "Fazer download do instalador do sistema Client", keys: ["agent_installer.download"] },
  { label: "Permitir receber suprimentos", keys: ["supplies.receive"] },
  { label: "Visualizar estoque", keys: ["inventory.view"] },
  { label: "Visualizar níveis de suprimentos", keys: ["supply_levels.view"] },
];

export function allStaffKeys(): string[] {
  return [...new Set(STAFF_PERMISSIONS.flatMap((item) => item.keys))];
}

export interface NotificationChecklistItem {
  label: string;
  field: "notifyTicketAssigned" | "notifyTicketSlaExpiring" | "notifyTicketSlaBreached" | "notifyTicketClosed" | "notifyTicketCommented";
}

export const STAFF_NOTIFICATIONS: NotificationChecklistItem[] = [
  { label: "Chamados forem passados para esta conta", field: "notifyTicketAssigned" },
  { label: "Chamados que esta conta é responsável estiverem próximos do prazo limite para atendimento", field: "notifyTicketSlaExpiring" },
  { label: "Chamados que esta conta é responsável esgotarem o prazo limite para atendimento", field: "notifyTicketSlaBreached" },
];

export const CUSTOMER_NOTIFICATIONS: NotificationChecklistItem[] = [
  { label: "Chamados que esta conta criou forem encerrados", field: "notifyTicketClosed" },
  { label: "Outra pessoa adicionar um comentário a um chamado criado por esta conta", field: "notifyTicketCommented" },
];
