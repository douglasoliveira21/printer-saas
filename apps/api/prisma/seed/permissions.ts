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

  { key: 'reports.view', description: 'Visualizar relatórios' },

  { key: 'agents.view', description: 'Visualizar agents' },
  { key: 'agents.create', description: 'Gerar/cadastrar agents' },

  { key: 'settings.manage', description: 'Gerenciar configurações e usuários' },
];
