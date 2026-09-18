import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DashboardSummary, PageUsagePeriod, TopCustomerUsage } from "@/lib/types";

export function useDashboardSummary(customerId?: string, refetchInterval?: number) {
  return useQuery({
    queryKey: ["dashboard-summary", customerId ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardSummary>("/dashboard/summary", { params: { customerId } });
      return data;
    },
    refetchInterval,
  });
}

export function usePageUsage(granularity: "month" | "day", customerId?: string, refetchInterval?: number) {
  return useQuery({
    queryKey: ["dashboard-page-usage", granularity, customerId ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<PageUsagePeriod[]>("/dashboard/page-usage", { params: { granularity, customerId } });
      return data;
    },
    refetchInterval,
  });
}

export function useTopCustomersByUsage(customerId?: string, refetchInterval?: number) {
  return useQuery({
    queryKey: ["dashboard-top-customers", customerId ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<TopCustomerUsage[]>("/dashboard/top-customers", { params: { customerId } });
      return data;
    },
    refetchInterval,
  });
}
