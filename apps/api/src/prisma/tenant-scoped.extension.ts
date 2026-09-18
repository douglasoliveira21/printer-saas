import { Prisma } from '@prisma/client';

/**
 * Models that carry a `tenantId` column and therefore must always be
 * scoped to the caller's tenant. Any model NOT listed here is assumed to be
 * platform-global (e.g. Permission) and is left untouched by this extension.
 *
 * Keep this list in sync with prisma/schema.prisma. It is intentionally a
 * static allow-list rather than schema introspection so a newly added
 * tenant-owned model that is forgotten here fails loudly (via the
 * isolation test suite) instead of silently leaking across tenants.
 */
const TENANT_SCOPED_MODELS = new Set([
  'User',
  'RefreshToken',
  'Role',
  'AuditLog',
  'Customer',
  'Location',
  'Agent',
  'Printer',
  'CounterReading',
  'ConsumableReading',
  'ConsumableReplacement',
  'PrinterComment',
  'Alert',
  'ServiceOrder',
  'ServiceOrderPart',
  'ServiceOrderPhoto',
  'Contract',
  'ContractPrinter',
  'ContractFixedCost',
  'ContractEmailRecipient',
  'ContractReadjustment',
  'InventoryItem',
  'InventoryMovement',
  'FinancialEntry',
  'MonthlyClosing',
]);

const READ_OPS = new Set(['findFirst', 'findFirstOrThrow', 'findMany', 'count', 'aggregate', 'groupBy']);
const WRITE_MANY_OPS = new Set(['updateMany', 'deleteMany']);

/**
 * Returns a Prisma Client extension that forces every query against a
 * tenant-owned model to be filtered/tagged with `tenantId`. This is the
 * single choke point for tenant isolation: callers should almost never
 * build a `where: { tenantId }` clause by hand — they should go through a
 * client produced by `PrismaService.forTenant(tenantId)` instead.
 */
export function tenantScopedExtension(tenantId: string) {
  return Prisma.defineExtension((client) =>
    client.$extends({
      name: 'tenant-scoped',
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            if (!TENANT_SCOPED_MODELS.has(model)) {
              return query(args);
            }

            const a = args as Record<string, any>;

            if (operation === 'create') {
              a.data = { ...a.data, tenantId };
            } else if (operation === 'createMany') {
              const rows = Array.isArray(a.data) ? a.data : [a.data];
              a.data = rows.map((row: Record<string, unknown>) => ({ ...row, tenantId }));
            } else if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
              // findUnique's `where` must match a unique index and can't be
              // arbitrarily extended, so re-route through findFirst which
              // safely accepts the extra tenantId filter.
              return (client as any)[model].findFirst({
                ...a,
                where: { ...a.where, tenantId },
              });
            } else if (
              READ_OPS.has(operation) ||
              WRITE_MANY_OPS.has(operation) ||
              operation === 'update' ||
              operation === 'delete' ||
              operation === 'upsert'
            ) {
              a.where = { ...a.where, tenantId };
              if (operation === 'upsert') {
                a.create = { ...a.create, tenantId };
              }
            }

            return query(a);
          },
        },
      },
    }),
  );
}
