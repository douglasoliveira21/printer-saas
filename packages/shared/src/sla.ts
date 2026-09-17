export interface SlaHierarchy {
  printerSlaHours?: number | null;
  locationSlaHours?: number | null;
  customerSlaHours?: number | null;
  contractSlaHours?: number | null;
}

/**
 * Resolves the applicable SLA (in hours) for a service order, honoring the
 * most specific override available: printer > location > customer >
 * contract. Returns null when none of the levels define one (no SLA
 * tracking for that service order).
 */
export function resolveSlaHours(hierarchy: SlaHierarchy): number | null {
  const { printerSlaHours, locationSlaHours, customerSlaHours, contractSlaHours } = hierarchy;
  if (printerSlaHours !== null && printerSlaHours !== undefined) return printerSlaHours;
  if (locationSlaHours !== null && locationSlaHours !== undefined) return locationSlaHours;
  if (customerSlaHours !== null && customerSlaHours !== undefined) return customerSlaHours;
  if (contractSlaHours !== null && contractSlaHours !== undefined) return contractSlaHours;
  return null;
}
