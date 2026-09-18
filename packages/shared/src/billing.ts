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
