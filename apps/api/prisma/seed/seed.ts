import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { PERMISSIONS } from './permissions';

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }
  console.log(`Seeded ${PERMISSIONS.length} permissions`);
}

/**
 * Demo tenant per spec §62. Everything here is clearly marked isDemo=true
 * so it can be identified/excluded from real usage/reports later.
 */
async function seedDemoTenant() {
  const existing = await prisma.tenant.findFirst({ where: { name: 'Empresa Demonstração' } });
  if (existing) {
    console.log('Demo tenant already exists, skipping');
    return;
  }

  const allPermissions = await prisma.permission.findMany();

  const tenant = await prisma.tenant.create({
    data: { name: 'Empresa Demonstração', isDemo: true, email: 'demo@printer-saas.local' },
  });

  const adminRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin',
      isSystem: true,
      permissions: { create: allPermissions.map((p) => ({ permissionId: p.id })) },
    },
  });

  const technicianRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: 'Técnico',
      isSystem: true,
      permissions: {
        create: allPermissions
          .filter((p) => ['printers.view', 'service_orders.view', 'service_orders.edit', 'customers.view', 'dashboard.view'].includes(p.key))
          .map((p) => ({ permissionId: p.id })),
      },
    },
  });

  const financeRole = await prisma.role.create({
    data: {
      tenantId: tenant.id,
      name: 'Financeiro',
      isSystem: true,
      permissions: {
        create: allPermissions
          .filter((p) => ['financial.view', 'financial.create', 'contracts.view', 'customers.view', 'dashboard.view'].includes(p.key))
          .map((p) => ({ permissionId: p.id })),
      },
    },
  });

  const passwordHash = await argon2.hash('Demo@1234');
  await prisma.user.createMany({
    data: [
      { tenantId: tenant.id, name: 'Admin Demo', email: 'admin@demo.local', passwordHash, roleId: adminRole.id },
      { tenantId: tenant.id, name: 'Técnico Demo', email: 'tecnico@demo.local', passwordHash, roleId: technicianRole.id },
      { tenantId: tenant.id, name: 'Financeiro Demo', email: 'financeiro@demo.local', passwordHash, roleId: financeRole.id },
    ],
  });

  const customerA = await prisma.customer.create({
    data: { tenantId: tenant.id, legalName: 'Empresa ABC Ltda', tradeName: 'Empresa ABC', document: '11.111.111/0001-11' },
  });
  const customerB = await prisma.customer.create({
    data: { tenantId: tenant.id, legalName: 'Empresa DEF Ltda', tradeName: 'Empresa DEF', document: '22.222.222/0001-22' },
  });

  const locationA = await prisma.location.create({
    data: { tenantId: tenant.id, customerId: customerA.id, name: 'Matriz' },
  });

  const agent = await prisma.agent.create({
    data: {
      tenantId: tenant.id,
      locationId: locationA.id,
      name: 'Agent Matriz - Empresa ABC',
      status: 'ONLINE',
      hostname: 'DEMO-PDC01',
      localIp: '192.168.1.10',
      agentVersion: '1.0.0-demo',
      lastHeartbeatAt: new Date(),
    },
  });

  const printer = await prisma.printer.create({
    data: {
      tenantId: tenant.id,
      agentId: agent.id,
      customerId: customerA.id,
      locationId: locationA.id,
      status: 'MONITORED',
      onlineStatus: 'ONLINE',
      ip: '192.168.1.50',
      serial: 'DEMO-SERIAL-0001',
      manufacturer: 'Ricoh',
      model: 'MP C3004',
      fingerprint: 'serial:DEMO-SERIAL-0001',
      lastSeenAt: new Date(),
      lastCollectedAt: new Date(),
    },
  });

  await prisma.counterReading.create({
    data: { printerId: printer.id, total: 164238, blackWhite: 112808, color: 51430, copies: 12340 },
  });
  await prisma.consumableReading.createMany({
    data: [
      { printerId: printer.id, type: 'toner', color: 'black', levelPercent: 45, name: 'Toner Preto' },
      { printerId: printer.id, type: 'toner', color: 'cyan', levelPercent: 18, name: 'Toner Ciano' },
    ],
  });

  const contract = await prisma.contract.create({
    data: {
      tenantId: tenant.id,
      number: 1,
      customerId: customerA.id,
      printerId: printer.id,
      startDate: new Date(),
      monthlyFee: 350,
      franchisePages: 10000,
      overagePriceBw: 0.08,
      overagePriceColor: 0.35,
      status: 'ACTIVE',
    },
  });

  await prisma.serviceOrder.create({
    data: {
      tenantId: tenant.id,
      number: 1,
      customerId: customerA.id,
      locationId: locationA.id,
      printerId: printer.id,
      priority: 'MEDIUM',
      status: 'OPEN',
      description: 'Impressão com falhas de qualidade (riscos verticais)',
    },
  });

  await prisma.alert.create({
    data: {
      tenantId: tenant.id,
      printerId: printer.id,
      type: 'TONER_LOW',
      level: 'WARNING',
      message: 'Toner ciano baixo (18%) na impressora Ricoh MP C3004.',
    },
  });

  // Untouched second customer/tenant footprint used only to sanity-check
  // that the demo tenant's UI has more than one customer to switch between.
  await prisma.customer.update({ where: { id: customerB.id }, data: { notes: 'Cliente sem impressoras cadastradas ainda' } });

  await prisma.financialEntry.create({
    data: {
      tenantId: tenant.id,
      type: 'RECEIVABLE',
      category: 'Mensalidade',
      description: 'Mensalidade contrato #1',
      amount: 350,
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 10),
      customerId: customerA.id,
      contractId: contract.id,
    },
  });

  await prisma.financialEntry.create({
    data: {
      tenantId: tenant.id,
      type: 'PAYABLE',
      category: 'Fornecedor de toner',
      description: 'Reposição de estoque',
      amount: 890,
      dueDate: new Date(new Date().getFullYear(), new Date().getMonth(), 20),
    },
  });

  const inventoryItem = await prisma.inventoryItem.create({
    data: { tenantId: tenant.id, name: 'Toner Preto MP C3004', type: 'toner', quantity: 3, minQuantity: 5 },
  });
  await prisma.inventoryMovement.create({
    data: { tenantId: tenant.id, itemId: inventoryItem.id, type: 'IN', quantity: 3, reason: 'Estoque inicial' },
  });

  console.log('Demo tenant seeded: login with admin@demo.local / Demo@1234');
}

/**
 * The Super Admin (spec §79) is a real User row like any other — it just
 * has `isSuperAdmin=true` and, since `tenantId` is required by the schema,
 * lives under a dedicated "Plataforma" system tenant that never appears in
 * platform tenant listings for commercial purposes.
 */
async function seedPlatformSuperAdmin() {
  const existing = await prisma.user.findFirst({ where: { email: 'superadmin@platform.local' } });
  if (existing) {
    console.log('Platform super admin already exists, skipping');
    return;
  }

  const platformTenant = await prisma.tenant.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000000', name: 'Plataforma (sistema)', isDemo: false },
  });

  await prisma.user.create({
    data: {
      tenantId: platformTenant.id,
      name: 'Super Admin',
      email: 'superadmin@platform.local',
      passwordHash: await argon2.hash('SuperAdmin@1234'),
      isSuperAdmin: true,
    },
  });

  console.log('Platform super admin seeded: login with superadmin@platform.local / SuperAdmin@1234');
}

async function seedPlans() {
  const plans = [
    { name: 'Starter', maxUsers: 3, maxCustomers: 10, maxPrinters: 25, maxAgents: 5, priceMonthly: 199 },
    { name: 'Pro', maxUsers: 10, maxCustomers: 50, maxPrinters: 150, maxAgents: 20, priceMonthly: 499 },
    { name: 'Enterprise', maxUsers: null, maxCustomers: null, maxPrinters: null, maxAgents: null, priceMonthly: null },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({ where: { name: plan.name }, update: plan, create: plan });
  }
  console.log(`Seeded ${plans.length} plans`);
}

async function main() {
  await seedPermissions();
  await seedPlans();
  await seedDemoTenant();
  await seedPlatformSuperAdmin();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
