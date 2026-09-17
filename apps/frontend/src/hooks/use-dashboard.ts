import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DashboardSummary } from "@/lib/types";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const { data } = await apiClient.get<DashboardSummary>("/dashboard/summary");
      return data;
    },
  });
}
