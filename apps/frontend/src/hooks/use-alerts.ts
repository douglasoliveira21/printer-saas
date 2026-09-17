import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface Alert {
  id: string;
  type: string;
  level: "INFO" | "WARNING" | "CRITICAL";
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  message: string;
  createdAt: string;
  printer?: { id: string; model: string | null; ip: string | null; customer?: { legalName: string } | null } | null;
}

export function useAlerts(status?: string) {
  return useQuery({
    queryKey: ["alerts", status ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<Alert[]>("/alerts", { params: { status } });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch(`/alerts/${id}/resolve`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts"] }),
  });
}
