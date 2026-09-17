import type { ClsStore } from 'nestjs-cls';

export interface AppClsStore extends ClsStore {
  tenantId?: string;
  userId?: string;
  isSuperAdmin?: boolean;
  requestId?: string;
}
