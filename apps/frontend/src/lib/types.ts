export interface PaginatedResponse<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export type CustomerStatus = "ACTIVE" | "INACTIVE" | "BLOCKED";
export type CustomerPersonType = "INDIVIDUAL" | "COMPANY";

export interface Customer {
  id: string;
  personType: CustomerPersonType;
  legalName: string;
  tradeName: string | null;
  document: string | null;
  stateRegistration: string | null;
  municipalRegistration: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  financialEmail: string | null;
  supportEmail: string | null;
  contactName: string | null;
  contactRole: string | null;
  address: string | null;
  zipCode: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
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
export type PrinterDeviceType =
  | "UNKNOWN"
  | "PRINTER"
  | "MFP"
  | "PLOTTER"
  | "ROUTER"
  | "FIREWALL"
  | "SWITCH"
  | "ACCESS_POINT"
  | "SERVER"
  | "COMPUTER"
  | "CAMERA";

export interface PrinterCapabilities {
  color?: boolean;
  duplex?: boolean;
  a3?: boolean;
  copy?: boolean;
  scan?: boolean;
  fax?: boolean;
}

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
  /** Null = never determined (device doesn't expose the input tray table). Drives whether A3-specific fields show up at all. Mirrors capabilities.a3. */
  supportsA3: boolean | null;
  deviceType: PrinterDeviceType;
  classificationConfidence: number | null;
  /** Tri-state per field: true = show it, false/absent = never show it (spec: never invent, never show "not supported" as if it were a real 0 reading). */
  capabilities: PrinterCapabilities | null;
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
export type ServiceOrderType =
  | "CORRECTIVE_MAINTENANCE"
  | "PREVENTIVE_MAINTENANCE"
  | "INSTALLATION"
  | "EQUIPMENT_REPLACEMENT"
  | "DELIVERY_PICKUP"
  | "PRINT_ISSUE"
  | "CONFIGURATION"
  | "TECHNICAL_SUPPORT"
  | "OTHER";
export type ServiceOrderBillingType = "CONTRACT" | "CHARGE_CUSTOMER" | "WARRANTY" | "COURTESY";
export type ServiceOrderPhotoPhase = "BEFORE" | "AFTER";

export interface ServiceOrderPart {
  id: string;
  name: string;
  quantity: number;
  unitValue: string;
  inventoryItemId: string | null;
}

export interface ServiceOrderPhoto {
  id: string;
  phase: ServiceOrderPhotoPhase;
  path: string;
  createdAt: string;
}

export interface ServiceOrder {
  id: string;
  number: number;
  status: ServiceOrderStatus;
  priority: ServiceOrderPriority;
  type: string | null;
  serviceType: ServiceOrderType | null;
  description: string | null;
  symptoms: string[];
  counterAtOpening: number | null;

  diagnosis: string | null;
  causeIdentified: string | null;
  testsPerformed: string | null;
  defectiveParts: string | null;
  suppliesUsed: string | null;
  technicalNotes: string | null;
  solution: string | null;

  billingType: ServiceOrderBillingType | null;
  laborCost: string | null;
  travelCost: string | null;

  arrivedAt: string | null;
  departedAt: string | null;
  mileageKm: number | null;
  activityPerformed: string | null;
  attendanceNotes: string | null;

  equipmentWorking: boolean | null;

  approvalName: string | null;
  approvalAt: string | null;
  approvalSignature: string | null;
  approvalNotes: string | null;

  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  slaDueAt: string | null;
  createdAt: string;
  customer?: { id: string; legalName: string; tradeName: string | null } | null;
  location?: { id: string; name: string } | null;
  printer?: { id: string; manufacturer: string | null; model: string | null; ip: string | null } | null;
  technician?: { id: string; name: string } | null;
  createdBy?: { id: string; name: string } | null;
  parts?: ServiceOrderPart[];
  photos?: ServiceOrderPhoto[];
}

export type ContractStatus = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ENDED" | "EXPIRED";

export interface ContractPrinter {
  id: string;
  printerId: string;
  priceBw: string | null;
  priceColor: string | null;
  priceScan: string | null;
  fixedCost: string;
  printer: { id: string; manufacturer: string | null; model: string | null; serial: string | null };
}

export interface ContractFixedCost {
  id: string;
  label: string;
  amount: string;
}

export interface ContractEmailRecipient {
  id: string;
  email: string;
}

export type ContractReadjustmentStatus = "SCHEDULED" | "APPLIED" | "CANCELLED";

export interface ContractReadjustment {
  id: string;
  percentage: string;
  effectiveMonth: number;
  effectiveYear: number;
  status: ContractReadjustmentStatus;
  previousMonthlyFee: string | null;
  newMonthlyFee: string | null;
  appliedAt: string | null;
  createdAt: string;
}

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
  defaultPriceBw: string | null;
  defaultPriceColor: string | null;
  defaultPriceScan: string | null;
  customer?: { id: string; legalName: string; tradeName: string | null } | null;
  printer?: { id: string; model: string | null; ip: string | null } | null;
  contractPrinters?: ContractPrinter[];
  fixedCosts?: ContractFixedCost[];
  emailRecipients?: ContractEmailRecipient[];
  readjustments?: ContractReadjustment[];
  _count?: { contractPrinters: number };
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

export interface ClosingPrinterLine {
  printerId: string;
  printerModel: string | null;
  pagesBw: number | null;
  pagesColor: number | null;
  pagesScan: number | null;
  priceBw: number;
  priceColor: number;
  priceScan: number;
  fixedCost: number;
  lineTotal: number;
  dataAvailable: boolean;
}

export interface ClosingContractLine {
  contractId: string;
  contractNumber: number;
  monthlyFee: number;
  fixedCosts: { label: string; amount: number }[];
  printers: ClosingPrinterLine[];
  contractTotal: number;
}

export interface MonthlyClosing {
  id: string;
  customerId: string;
  referenceYear: number;
  referenceMonth: number;
  totalAmount: string;
  details: ClosingContractLine[];
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
