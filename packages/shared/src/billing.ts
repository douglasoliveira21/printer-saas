export interface CounterPoint {
  collectedAt: Date;
  total: number | null;
  blackWhite: number | null;
  color: number | null;
  copies: number | null;
}

export interface UsageResult {
  /** Pages used in the period, or null when there isn't enough data to know. */
  pagesUsed: number | null;
  /** True when a counter decrease was observed (board swap, reset, replaced equipment — spec §22/§70). */
  counterWasReset: boolean;
  startReading: CounterPoint | null;
  endReading: CounterPoint | null;
}

/**
 * Pages used between the first and last counter reading in [from, to].
 * Never invents a number: if there are fewer than two readings in the
 * period, `pagesUsed` is null (spec §67) rather than falling back to 0.
 *
 * A decreasing counter (end < start) is treated as a reset/equipment swap
 * (spec §22/§70): we report the end reading's own value as the usage since
 * the reset, flagged via `counterWasReset`, instead of a negative number.
 */
export function calculatePeriodUsage(readings: CounterPoint[], field: 'total' | 'blackWhite' | 'color' | 'copies', from: Date, to: Date): UsageResult {
  const inPeriod = readings
    .filter((r) => r.collectedAt >= from && r.collectedAt <= to && r[field] !== null)
    .sort((a, b) => a.collectedAt.getTime() - b.collectedAt.getTime());

  if (inPeriod.length < 2) {
    return {
      pagesUsed: null,
      counterWasReset: false,
      startReading: inPeriod[0] ?? null,
      endReading: inPeriod[inPeriod.length - 1] ?? null,
    };
  }

  const startReading = inPeriod[0];
  const endReading = inPeriod[inPeriod.length - 1];
  const start = startReading[field] as number;
  const end = endReading[field] as number;

  if (end < start) {
    return { pagesUsed: end, counterWasReset: true, startReading, endReading };
  }

  return { pagesUsed: end - start, counterWasReset: false, startReading, endReading };
}

export interface FranchiseBilling {
  franchisePages: number;
  pagesUsed: number | null;
  overturnedPages: number | null;
  monthlyFee: number;
  overageAmount: number | null;
  totalAmount: number | null;
  counterWasReset: boolean;
  dataAvailable: boolean;
}

export function calculateFranchiseBilling(params: {
  franchisePages: number;
  monthlyFee: number;
  overagePricePerPage: number;
  usage: UsageResult;
}): FranchiseBilling {
  const { franchisePages, monthlyFee, overagePricePerPage, usage } = params;

  if (usage.pagesUsed === null) {
    return {
      franchisePages,
      pagesUsed: null,
      overturnedPages: null,
      monthlyFee,
      overageAmount: null,
      totalAmount: null,
      counterWasReset: usage.counterWasReset,
      dataAvailable: false,
    };
  }

  const overturnedPages = Math.max(0, usage.pagesUsed - franchisePages);
  const overageAmount = Math.round(overturnedPages * overagePricePerPage * 100) / 100;
  const totalAmount = Math.round((monthlyFee + overageAmount) * 100) / 100;

  return {
    franchisePages,
    pagesUsed: usage.pagesUsed,
    overturnedPages,
    monthlyFee,
    overageAmount,
    totalAmount,
    counterWasReset: usage.counterWasReset,
    dataAvailable: true,
  };
}

export interface PricingTier {
  fromPage: number;
  /** null = no upper bound (last bracket). */
  toPage: number | null;
  pricePerPage: number;
}

export interface TieredBillingBreakdownItem {
  fromPage: number;
  toPage: number | null;
  pagesInTier: number;
  pricePerPage: number;
  amount: number;
}

export interface TieredBilling {
  pagesUsed: number | null;
  totalAmount: number | null;
  breakdown: TieredBillingBreakdownItem[];
  dataAvailable: boolean;
}

export interface ContractPageCostInput {
  /** Aggregate pages used across all of the contract's printers in the period (bw+color+scan). */
  totalPagesUsed: number | null;
  pricingTiers: PricingTier[];
  franchisePages: number;
  overagePricePerPage: number;
}

export interface ContractPageCostResult {
  mode: 'TIERED' | 'FRANCHISE' | 'FLAT';
  amount: number | null;
  breakdown: TieredBillingBreakdownItem[];
}

/**
 * Decides which of the 3 always-visible cost blocks (tiers / franquia /
 * custo por página) actually drives a contract's page-cost billing this
 * period, in priority order: tiered pricing wins if any tier row exists,
 * then franchise+overage if franchisePages > 0, otherwise the caller falls
 * back to its own flat per-page × per-printer calculation (mode: 'FLAT',
 * amount: null signals "compute it yourself").
 */
export function computeContractPageCost(input: ContractPageCostInput): ContractPageCostResult {
  if (input.pricingTiers.length > 0) {
    const tiered = calculateTieredBilling(input.totalPagesUsed, input.pricingTiers);
    return { mode: 'TIERED', amount: tiered.totalAmount, breakdown: tiered.breakdown };
  }
  if (input.franchisePages > 0) {
    const franchise = calculateFranchiseBilling({
      franchisePages: input.franchisePages,
      monthlyFee: 0,
      overagePricePerPage: input.overagePricePerPage,
      usage: { pagesUsed: input.totalPagesUsed, counterWasReset: false, startReading: null, endReading: null },
    });
    return { mode: 'FRANCHISE', amount: franchise.overageAmount, breakdown: [] };
  }
  return { mode: 'FLAT', amount: null, breakdown: [] };
}

/**
 * Progressive/bracket pricing (spec: "tabela de faixas de páginas") — like a
 * tax bracket. Pages fall into whichever tiers they overlap: the first
 * `tier.toPage - tier.fromPage + 1` pages go in the first tier's price, the
 * next bracket's pages at its price, and so on. Tiers are sorted by
 * fromPage before applying, so caller order doesn't matter.
 */
export function calculateTieredBilling(pagesUsed: number | null, tiers: PricingTier[]): TieredBilling {
  if (pagesUsed === null) {
    return { pagesUsed: null, totalAmount: null, breakdown: [], dataAvailable: false };
  }

  const sortedTiers = [...tiers].sort((a, b) => a.fromPage - b.fromPage);
  const breakdown: TieredBillingBreakdownItem[] = [];
  let totalAmount = 0;

  for (const tier of sortedTiers) {
    if (pagesUsed < tier.fromPage) continue;
    const tierEnd = tier.toPage ?? pagesUsed;
    const pagesInTier = Math.max(0, Math.min(pagesUsed, tierEnd) - tier.fromPage + 1);
    if (pagesInTier <= 0) continue;
    const amount = Math.round(pagesInTier * tier.pricePerPage * 100) / 100;
    totalAmount = Math.round((totalAmount + amount) * 100) / 100;
    breakdown.push({ fromPage: tier.fromPage, toPage: tier.toPage, pagesInTier, pricePerPage: tier.pricePerPage, amount });
  }

  return { pagesUsed, totalAmount, breakdown, dataAvailable: true };
}
