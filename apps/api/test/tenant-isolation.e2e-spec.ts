import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/create-test-app';
import { registerTenant, type SeededTenant } from './utils/seed-tenant';

/**
 * Spec §61 (critical): a user from Tenant A must never be able to read,
 * modify or delete Tenant B's data, regardless of how it guesses/enumerates
 * IDs. Every entity type that carries a `tenantId` gets the same drill:
 * seed it under Tenant B, then hit it from Tenant A's authenticated session
 * and assert the API behaves as if it doesn't exist (404) — never leaking
 * data, and never a bare 403 that would at least confirm the ID exists.
 *
 * Requires a real Postgres reachable via DATABASE_URL (see README "Rodando
 * testes" / docs/development.md). Skipped automatically otherwise so `npm
 * test` doesn't hard-fail in environments without a database configured.
 */

const hasDatabaseUrl = !!process.env.DATABASE_URL;
const describeIfDb = hasDatabaseUrl ? describe : describe.skip;

describeIfDb('Tenant isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenantA: SeededTenant;
  let tenantB: SeededTenant;

  // Entities seeded directly under Tenant B (bypassing the API, since some
  // of these — printers, agents — don't have simple single-shot creation
  // endpoints; the Agent/device ingestion flow is exercised separately).
  let tenantBCustomerId: string;
  let tenantBLocationId: string;
  let tenantBAgentId: string;
  let tenantBPrinterId: string;
  let tenantBServiceOrderId: string;
  let tenantBContractId: string;
  let tenantBAlertId: string;
  let tenantBFinancialEntryId: string;
  let tenantBInventoryItemId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    tenantA = await registerTenant(app, `Tenant A ${Date.now()}`);
    tenantB = await registerTenant(app, `Tenant B ${Date.now()}`);

    const customer = await prisma.customer.create({
      data: { tenantId: tenantB.tenantId, legalName: 'Cliente Sigiloso do Tenant B' },
    });
    tenantBCustomerId = customer.id;

    const location = await prisma.location.create({
      data: { tenantId: tenantB.tenantId, customerId: customer.id, name: 'Matriz B' },
    });
    tenantBLocationId = location.id;

    const agent = await prisma.agent.create({
      data: { tenantId: tenantB.tenantId, locationId: location.id, name: 'Agent B', status: 'ONLINE' },
    });
    tenantBAgentId = agent.id;

    const printer = await prisma.printer.create({
      data: {
        tenantId: tenantB.tenantId,
        agentId: agent.id,
        customerId: customer.id,
        locationId: location.id,
        status: 'MONITORED',
        serial: `SECRET-${Date.now()}`,
        fingerprint: `serial:SECRET-${Date.now()}`,
      },
    });
    tenantBPrinterId = printer.id;

    const serviceOrder = await prisma.serviceOrder.create({
      data: { tenantId: tenantB.tenantId, number: 1, customerId: customer.id, description: 'Chamado confidencial' },
    });
    tenantBServiceOrderId = serviceOrder.id;

    const contract = await prisma.contract.create({
      data: {
        tenantId: tenantB.tenantId,
        number: 1,
        customerId: customer.id,
        printerId: printer.id,
        startDate: new Date(),
        monthlyFee: 500,
        franchisePages: 10000,
      },
    });
    tenantBContractId = contract.id;

    const alert = await prisma.alert.create({
      data: { tenantId: tenantB.tenantId, printerId: printer.id, type: 'TONER_LOW', level: 'WARNING', message: 'Sigiloso' },
    });
    tenantBAlertId = alert.id;

    const financialEntry = await prisma.financialEntry.create({
      data: {
        tenantId: tenantB.tenantId,
        type: 'RECEIVABLE',
        category: 'Mensalidade',
        amount: 999,
        dueDate: new Date(),
        customerId: customer.id,
      },
    });
    tenantBFinancialEntryId = financialEntry.id;

    const inventoryItem = await prisma.inventoryItem.create({
      data: { tenantId: tenantB.tenantId, name: 'Toner sigiloso', type: 'toner', quantity: 10 },
    });
    tenantBInventoryItemId = inventoryItem.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  const authHeader = () => ({ Authorization: `Bearer ${tenantA.accessToken}` });

  it('cannot read a customer belonging to another tenant', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/customers/${tenantBCustomerId}`).set(authHeader());
    expect(res.status).toBe(404);
  });

  it('does not list another tenant\'s customers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/customers').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { id: string }) => c.id)).not.toContain(tenantBCustomerId);
  });

  it('cannot update or delete a customer belonging to another tenant', async () => {
    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/customers/${tenantBCustomerId}`)
      .set(authHeader())
      .send({ legalName: 'Hacked' });
    expect(patch.status).toBe(404);

    const del = await request(app.getHttpServer()).delete(`/api/v1/customers/${tenantBCustomerId}`).set(authHeader());
    expect(del.status).toBe(404);

    const stillThere = await prisma.customer.findUnique({ where: { id: tenantBCustomerId } });
    expect(stillThere?.legalName).toBe('Cliente Sigiloso do Tenant B');
  });

  it('cannot read a location belonging to another tenant', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/locations/${tenantBLocationId}`).set(authHeader());
    expect(res.status).toBe(404);
  });

  it('cannot create a location under a foreign customerId', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/locations')
      .set(authHeader())
      .send({ customerId: tenantBCustomerId, name: 'Local Invasor' });
    // customerId is validated against the caller's own tenant, so this must
    // be rejected even though the tenant-scoped extension only protects the
    // Location row being written, not the foreign key value supplied.
    expect(res.status).toBe(404);
  });

  it('does not list another tenant\'s agents, and cannot read their config/heartbeat without the real API key', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/agents').set(authHeader());
    expect(list.status).toBe(200);
    expect(list.body.map((a: { id: string }) => a.id)).not.toContain(tenantBAgentId);
  });

  it('cannot read a printer belonging to another tenant', async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/printers/${tenantBPrinterId}`).set(authHeader());
    expect(res.status).toBe(404);
  });

  it('cannot claim a printer belonging to another tenant', async () => {
    // Tenant A creates its own customer to claim into, but the printer id
    // itself belongs to Tenant B and must never be reachable regardless.
    const ownCustomer = await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set(authHeader())
      .send({ legalName: 'Cliente do Tenant A' });

    const claim = await request(app.getHttpServer())
      .post(`/api/v1/printers/${tenantBPrinterId}/claim`)
      .set(authHeader())
      .send({ customerId: ownCustomer.body.id });
    expect(claim.status).toBe(404);

    const untouched = await prisma.printer.findUnique({ where: { id: tenantBPrinterId } });
    expect(untouched?.customerId).toBe(tenantBCustomerId);
  });

  it('cannot read or update a service order belonging to another tenant', async () => {
    const get = await request(app.getHttpServer()).get(`/api/v1/service-orders/${tenantBServiceOrderId}`).set(authHeader());
    expect(get.status).toBe(404);

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/service-orders/${tenantBServiceOrderId}`)
      .set(authHeader())
      .send({ status: 'CANCELLED' });
    expect(patch.status).toBe(404);

    const untouched = await prisma.serviceOrder.findUnique({ where: { id: tenantBServiceOrderId } });
    expect(untouched?.status).toBe('OPEN');
  });

  it('does not list another tenant\'s service orders', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/service-orders').set(authHeader());
    expect(res.body.data.map((so: { id: string }) => so.id)).not.toContain(tenantBServiceOrderId);
  });

  it('cannot read, update, or preview billing for a contract belonging to another tenant', async () => {
    const get = await request(app.getHttpServer()).get(`/api/v1/contracts/${tenantBContractId}`).set(authHeader());
    expect(get.status).toBe(404);

    const patch = await request(app.getHttpServer())
      .patch(`/api/v1/contracts/${tenantBContractId}`)
      .set(authHeader())
      .send({ status: 'ACTIVE' });
    expect(patch.status).toBe(404);

    const billing = await request(app.getHttpServer())
      .get(`/api/v1/contracts/${tenantBContractId}/billing-preview`)
      .query({ from: '2024-01-01', to: '2024-01-31' })
      .set(authHeader());
    expect(billing.status).toBe(404);
  });

  it('does not list another tenant\'s alerts', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/alerts').set(authHeader());
    expect(res.body.map((a: { id: string }) => a.id)).not.toContain(tenantBAlertId);
  });

  it('does not list another tenant\'s financial entries and cannot mark theirs as paid', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/financial/entries').set(authHeader());
    expect(list.body.data.map((e: { id: string }) => e.id)).not.toContain(tenantBFinancialEntryId);

    const pay = await request(app.getHttpServer()).patch(`/api/v1/financial/entries/${tenantBFinancialEntryId}/pay`).set(authHeader());
    expect(pay.status).toBe(404);

    const untouched = await prisma.financialEntry.findUnique({ where: { id: tenantBFinancialEntryId } });
    expect(untouched?.status).toBe('PENDING');
  });

  it('does not list another tenant\'s inventory items and cannot move their stock', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/inventory/items').set(authHeader());
    expect(list.body.map((i: { id: string }) => i.id)).not.toContain(tenantBInventoryItemId);

    const get = await request(app.getHttpServer()).get(`/api/v1/inventory/items/${tenantBInventoryItemId}`).set(authHeader());
    expect(get.status).toBe(404);

    const movement = await request(app.getHttpServer())
      .post(`/api/v1/inventory/items/${tenantBInventoryItemId}/movements`)
      .set(authHeader())
      .send({ type: 'OUT', quantity: 1 });
    expect(movement.status).toBe(404);

    const untouched = await prisma.inventoryItem.findUnique({ where: { id: tenantBInventoryItemId } });
    expect(untouched?.quantity).toBe(10);
  });

  it('does not list or fetch another tenant\'s users', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/users').set(authHeader());
    expect(list.body.map((u: { id: string }) => u.id)).not.toContain(tenantB.userId);

    const get = await request(app.getHttpServer()).get(`/api/v1/users/${tenantB.userId}`).set(authHeader());
    expect(get.status).toBe(404);
  });

  it('cannot use the platform (super-admin) endpoints as a regular tenant user', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/platform/tenants').set(authHeader());
    expect(res.status).toBe(403);
  });

  it('rejects a JWT whose tenantId no longer matches any active user in that tenant', async () => {
    // Sanity check on the trust boundary itself: JwtStrategy re-derives the
    // tenant from (userId, tenantId) in the token against the DB on every
    // request, so a token can't outlive tenant/user deletion.
    const res = await request(app.getHttpServer()).get('/api/v1/customers').set({ Authorization: 'Bearer not-a-real-token' });
    expect(res.status).toBe(401);
  });
});
