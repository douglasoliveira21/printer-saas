import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

export interface SeededTenant {
  tenantId: string;
  accessToken: string;
  userId: string;
  email: string;
}

/** Registers a fresh tenant + admin user through the real /auth/register-tenant endpoint. */
export async function registerTenant(app: INestApplication, companyName: string): Promise<SeededTenant> {
  const email = `admin-${randomUUID()}@isolation-test.local`;
  const response = await request(app.getHttpServer()).post('/api/v1/auth/register-tenant').send({
    companyName,
    adminName: 'Admin Teste',
    adminEmail: email,
    adminPassword: 'Test@12345',
  });

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Failed to register tenant: ${response.status} ${JSON.stringify(response.body)}`);
  }

  return {
    tenantId: response.body.user.tenantId,
    accessToken: response.body.accessToken,
    userId: response.body.user.id,
    email,
  };
}
