export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type CustomerStatus = "ACTIVE" | "INACTIVE";

export interface Customer {
  id: string;
  legalName: string;
  tradeName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  status: CustomerStatus;
  slaHours: number | null;
  createdAt: string;
  locations?: Location[];
}

export interface Location {
  id: string;
  customerId: string;
  name: string;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
  slaHours: number | null;
}

export type AgentStatus = "PENDING" | "ONLINE" | "OFFLINE" | "DISABLED";

export interface Agent {
  id: string;
  name: string;
  status: AgentStatus;
  hostname: string | null;
  localIp: string | null;
  agentVersion: string | null;
  lastHeartbeatAt: string | null;
  locationId: string | null;
}

export type PrinterStatus = "DISCOVERED" | "MONITORED" | "IGNORED" | "DECOMMISSIONED";
export type PrinterOnlineStatus = "UNKNOWN" | "ONLINE" | "OFFLINE";

export interface Printer {
  id: string;
  status: PrinterStatus;
  onlineStatus: PrinterOnlineStatus;
  ip: string | null;
  mac: string | null;
  serial: string | null;
  manufacturer: string | null;
  model: string | null;
  hostname: string | null;
  customerId: string | null;
  locationId: string | null;
  lastSeenAt: string | null;
  lastCollectedAt: string | null;
  monitoredAt: string | null;
  slaHours: number | null;
  collectionMethod: "SNMP" | "MANUAL";
  createdAt: string;
  customer?: { id: string; legalName: string } | null;
  location?: { id: string; name: string } | null;
  agent?: { id: string; name: string; hostname: string | null } | null;
  counters?: CounterReading[];
  consumables?: ConsumableReading[];
}

export interface SupplyForecast {
  currentLevelPercent: number;
  dailyDepletionRate: number;
  daysRemaining: number;
  predictedReplacementAt: string;
  dataPoints: number;
}

export interface CounterReading {
  id: string;
  total: number | null;
  blackWhite: number | null;
  color: number | null;
  copies: number | null;
  collectedAt: string;
}

export interface SupplyStats {
  pagesPrintedSinceInstall: number | null;
  averagePagesPerReplacement: number | null;
  averageDaysBetweenReplacements: number | null;
  estimatedCoveragePercent: number | null;
}

export interface ConsumableReading {
  id: string;
  type: string;
  color: string | null;
  levelPercent: number | null;
  name: string | null;
  collectedAt: string;
  forecast?: SupplyForecast | null;
  stats?: SupplyStats;
}

export type PrinterTimelineItemType = "replacement" | "service_order";

export interface PrinterTimelineItem {
  type: PrinterTimelineItemType;
  date: string;
  status: string;
  label: string;
  notes: string | null;
}

export interface PrinterComment {
  id: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string } | null;
}

export type ConsumableReplacementStatus = "PREDICTED" | "CONFIRMED" | "PREMATURE" | "DISMISSED";

export interface ConsumableReplacement {
  id: string;
  type: string;
  color: string | null;
  predictedAt: string | null;
  replacedAt: string | null;
  levelPercentAtReplacement: number | null;
  status: ConsumableReplacementStatus;
  notes: string | null;
  createdAt: string;
  printer?: { id: string; model: string | null; ip: string | null; customer?: { id: string; legalName: string } | null } | null;
}

export interface SupplyForecastEntry {
  printer: { id: string; model: string | null; ip: string | null };
  customer: { id: string; legalName: string } | null;
  type: string;
  color: string | null;
  currentLevelPercent: number;
  daysRemaining: number;
  predictedReplacementAt: string;
}

export type AlertType =
  | "PRINTER_OFFLINE"
  | "AGENT_OFFLINE"
  | "TONER_LOW"
  | "TONER_CRITICAL"
  | "COUNTER_STALE"
  | "DEVICE_ERROR"
  | "CONTRACT_EXPIRING"
  | "SERVICE_ORDER_LATE"
  | "SLA_EXPIRING"
  | "COLLECTION_FAILED";
export type AlertLevel = "INFO" | "WARNING" | "CRITICAL";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface Alert {
  id: string;
  type: AlertType;
  level: AlertLevel;
  status: AlertStatus;
  message: string;
  createdAt: string;
  resolvedAt: string | null;
  printer?: { id: string; model: string | null; ip: string | null; customer?: { id: string; legalName: string } | null } | null;
}

export interface DashboardSummary {
  customers: { total: number };
  printers: {
    total: number;
    origin: { clientes: number; empresa: number; novas: number };
    communication: { ok: number; falha: number; manual: number };
  };
  alerts: { total: number; alto: number; medio: number };
  serviceOrders: { total: number; pendente: number; andamento: number; finalizado: number };
  replacementsPending: number;
}

export interface PageUsagePeriod {
  period: string;
  blackWhite: number;
  color: number;
  copies: number;
}

export interface TopCustomerUsage {
  name: string;
  pages: number;
}

export type ServiceOrderStatus = "OPEN" | "SCHEDULED" | "IN_PROGRESS" | "WAITING_PART" | "WAITING_CUSTOMER" | "DONE" | "CANCELLED";
export type ServiceOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface ServiceOrder {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  type: string | null;
  description: string | null;
  diagnosis: string | null;
  solution: string | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  slaDueAt: string | null;
  createdAt: string;
  customer?: { id: string; legalName: string; tradeName: string | null } | null;
  location?: { id: string; name: string } | null;
  printer?: { id: string; model: string | null; ip: string | null } | null;
  technician?: { id: string; name: string } | null;
}

export type ContractStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ENDED" | "EXPIRED";

export interface Contract {
  id: string;
  number: number;
  status: ContractStatus;
  startDate: string;
  endDate: string | null;
  monthlyFee: string;
  franchisePages: number;
  overagePriceBw: string;
  overagePriceColor: string;
  billingDay: number;
  slaHours: number | null;
  customer?: { id: string; legalName: string; tradeName: string | null } | null;
  printer?: { id: string; model: string | null; ip: string | null } | null;
}

export type FinancialEntryType = "RECEIVABLE" | "PAYABLE";
export type FinancialEntryStatus = "PENDING" | "PAID" | "OVERDUE" | "CANCELLED";

export interface FinancialEntry {
  id: string;
  type: FinancialEntryType;
  category: string;
  costCenter: string | null;
  description: string | null;
  amount: string;
  dueDate: string;
  paidAt: string | null;
  status: FinancialEntryStatus;
  customer?: { id: string; legalName: string; tradeName: string | null } | null;
  contract?: { id: string; number: number } | null;
  serviceOrder?: { id: string; number: number } | null;
}

export interface FinancialSummary {
  receivableToday: number;
  receivableOverdue: number;
  receivableUpcoming: number;
  payablePending: number;
  projectedBalance: number;
}

export interface MonthlyClosingLine {
  contractId: string;
  contractNumber: number;
  printerId: string | null;
  printerModel: string | null;
  pagesUsed: number | null;
  franchisePages: number;
  overturnedPages: number | null;
  overageAmount: number | null;
  monthlyFee: number;
  totalAmount: number;
  dataAvailable: boolean;
}

export interface MonthlyClosing {
  id: string;
  customerId: string;
  referenceYear: number;
  referenceMonth: number;
  totalAmount: string;
  details: MonthlyClosingLine[];
  generatedAt: string;
  customer?: { id: string; legalName: string; tradeName: string | null };
}

export type InventoryMovementType = "IN" | "OUT" | "ADJUSTMENT";

export interface InventoryMovement {
  id: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string | null;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: string;
  quantity: number;
  minQuantity: number;
  movements?: InventoryMovement[];
}

export interface FranchiseBilling {
  period: { from: string; to: string };
  franchisePages: number;
  pagesUsed: number | null;
  overturnedPages: number | null;
  monthlyFee: number;
  overageAmount: number | null;
  totalAmount: number | null;
  counterWasReset: boolean;
  dataAvailable: boolean;
}
