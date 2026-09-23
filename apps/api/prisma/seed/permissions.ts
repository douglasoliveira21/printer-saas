export const PERMISSIONS: { key: string; description: string }[] = [
  { key: 'dashboard.view', description: 'Visualizar dashboard' },

  { key: 'printers.view', description: 'Visualizar impressoras' },
  { key: 'printers.create', description: 'Cadastrar impressoras' },
  { key: 'printers.edit', description: 'Editar impressoras' },
  { key: 'printers.delete', description: 'Excluir impressoras' },

  { key: 'customers.view', description: 'Visualizar clientes' },
  { key: 'customers.create', description: 'Cadastrar clientes' },
  { key: 'customers.edit', description: 'Editar clientes' },
  { key: 'customers.delete', description: 'Excluir clientes' },

  { key: 'contracts.view', description: 'Visualizar contratos' },
  { key: 'contracts.create', description: 'Cadastrar contratos' },
  { key: 'contracts.edit', description: 'Editar contratos' },

  { key: 'service_orders.view', description: 'Visualizar ordens de serviço' },
  { key: 'service_orders.create', description: 'Criar ordens de serviço' },
  { key: 'service_orders.edit', description: 'Editar ordens de serviço' },

  { key: 'financial.view', description: 'Visualizar financeiro' },
  { key: 'financial.create', description: 'Lançar financeiro' },
  { key: 'financial.edit', description: 'Editar/baixar lançamentos financeiros' },

  { key: 'inventory.view', description: 'Visualizar estoque' },
  { key: 'inventory.create', description: 'Cadastrar itens e movimentar estoque' },
  { key: 'inventory.edit', description: 'Editar itens de estoque' },
  { key: 'inventory.delete', description: 'Excluir itens de estoque' },
  { key: 'inventory.move', description: 'Mover itens de estoque' },

  { key: 'reports.view', description: 'Visualizar relatórios' },

  { key: 'agents.view', description: 'Visualizar agents' },
  { key: 'agents.create', description: 'Gerar/cadastrar agents' },

  { key: 'settings.manage', description: 'Gerenciar configurações e usuários' },
  { key: 'company_settings.edit', description: 'Editar configurações gerais da empresa' },

  // Chaves novas do checklist de contas — algumas ainda sem retrofit em
  // controllers existentes (features que não existem ainda), ver plano.
  { key: 'costs.view', description: 'Visualizar custos' },
  { key: 'service_orders.close', description: 'Encerrar chamados' },
  { key: 'service_orders.edit_schedule', description: 'Editar data/hora de atendimento dos chamados' },
  { key: 'customers.toggle_modules', description: 'Habilitar/desabilitar módulos do sistema por cliente' },
  { key: 'restock.schedule', description: 'Programar reposição de suprimentos' },
  { key: 'restock.confirm', description: 'Confirmar reposição de suprimentos' },
  { key: 'connections.manage', description: 'Gerenciar monitoramento de conexões' },
  { key: 'customer_settings.manage', description: 'Gerenciar configurações do próprio cliente (portal)' },
  { key: 'alerts.view', description: 'Visualizar alertas criados por impressoras' },
  { key: 'agent_installer.download', description: 'Baixar o instalador do Agent' },
  { key: 'supplies.receive', description: 'Confirmar recebimento de suprimentos' },
  { key: 'supply_levels.view', description: 'Visualizar níveis de suprimentos' },
];
