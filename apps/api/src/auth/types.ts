export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
  roleId: string | null;
  permissions: string[];
  /** Set only for customer-portal users (spec §34) — see AppClsStore/PortalGuard. */
  customerId: string | null;
  /** STAFF only — false means the account is restricted to UserVisibleCustomer rows (see CustomersService.findAll). */
  viewAllCustomers: boolean;
}

export interface JwtAccessPayload {
  sub: string; // userId
  tenantId: string;
  isSuperAdmin: boolean;
}
