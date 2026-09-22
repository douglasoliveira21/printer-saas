import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './utils/create-test-app';
import { registerTenant, type SeededTenant } from './utils/seed-tenant';

/**
 * Spec §34: a customer-portal user must only ever see their OWN customer's
 * data — even other customers within the SAME tenant must stay invisible.
 * This is a finer-grained isolation boundary than tenant-isolation.e2e-spec.ts
 * (which covers cross-tenant leaks) and is tested separately here.
 */

const hasDatabaseUrl = !!process.env.DATABASE_URL;
const describeIfDb = hasDatabaseUrl ? describe : describe.skip;

describeIfDb('Portal isolation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tenant: SeededTenant;

  let _customerXId: string;
  let _customerYId: string;
  let printerYId: string;
  let serviceOrderYId: string;
  let portalXAccessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = new PrismaClient();

    tenant = await registerTenant(app, `Portal Tenant ${Date.now()}`);

    const customerX = await prisma.customer.create({ data: { tenantId: tenant.tenantId, legalName: 'Cliente X' } });
    _customerXId = customerX.id;
    const customerY = await prisma.customer.create({ data: { tenantId: tenant.tenantId, legalName: 'Cliente Y (sigiloso para X)' } });
    _customerYId = customerY.id;

    const agent = await prisma.agent.create({ data: { tenantId: tenant.tenantId, name: 'Agent', status: 'ONLINE' } });
    const printerY = await prisma.printer.create({
      data: {
        tenantId: tenant.tenantId,
        agentId: agent.id,
        customerId: customerY.id,
        status: 'MONITORED',
        serial: `Y-${Date.now()}`,
        fingerprint: `serial:Y-${Date.now()}`,
      },
    });
    printerYId = printerY.id;

    const serviceOrderY = await prisma.serviceOrder.create({
      data: { tenantId: tenant.tenantId, number: 100, customerId: customerY.id, description: 'Chamado do Cliente Y' },
    });
    serviceOrderYId = serviceOrderY.id;

    // Portal user created directly (there's no self-signup flow yet) —
    // mirrors what UsersService.create does when given a customerId.
    const portalUser = await prisma.user.create({
      data: {
        tenantId: tenant.tenantId,
        customerId: customerX.id,
        name: 'Usuário do Portal (Cliente X)',
        email: `portal-x-${Date.now()}@isolation-test.local`,
        passwordHash: await argon2.hash('Test@12345'),
      },
    });

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: portalUser.email, password: 'Test@12345' });
    expect(login.status).toBe(200);
    portalXAccessToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await app?.close();
  });

  const portalAuthHeader = () => ({ Authorization: `Bearer ${portalXAccessToken}` });

  it("does not list Customer Y's printers in Customer X's portal", async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/portal/printers').set(portalAuthHeader());
    expect(res.status).toBe(200);
    expect(res.body.map((p: { id: string }) => p.id)).not.toContain(printerYId);
  });

  it("cannot read Customer Y's printer detail from Customer X's portal", async () => {
    const res = await request(app.getHttpServer()).get(`/api/v1/portal/printers/${printerYId}`).set(portalAuthHeader());
    expect(res.status).toBe(404);
  });

  it("does not list Customer Y's service orders in Customer X's portal", async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/portal/service-orders').set(portalAuthHeader());
    expect(res.body.map((so: { id: string }) => so.id)).not.toContain(serviceOrderYId);
  });

  it("cannot open a service order against Customer Y's printer from Customer X's portal", async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/portal/service-orders')
      .set(portalAuthHeader())
      .send({ printerId: printerYId, description: 'Tentando abrir chamado para impressora de outro cliente' });
    expect(res.status).toBe(404);
  });

  it('portal user has no access to tenant-staff endpoints', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/customers').set(portalAuthHeader());
    // Empty permissions array (no role assigned to portal users) -> PermissionsGuard denies.
    expect(res.status).toBe(403);
  });

  it('regular tenant staff cannot use the customer portal', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/portal/printers').set({ Authorization: `Bearer ${tenant.accessToken}` });
    expect(res.status).toBe(403);
  });
});
