import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Alert } from "@/lib/types";

export type { Alert };

export function useAlerts(status?: string, printerId?: string, serviceOrderId?: string) {
  return useQuery({
    queryKey: ["alerts", status ?? "all", printerId ?? "all", serviceOrderId ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<Alert[]>("/alerts", { params: { status, printerId, serviceOrderId } });
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
