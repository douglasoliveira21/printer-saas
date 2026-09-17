import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ConsumableReplacement, SupplyForecastEntry } from "@/lib/types";

export function useSupplyForecast() {
  return useQuery({
    queryKey: ["consumables", "forecast"],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplyForecastEntry[]>("/consumables/forecast");
      return data;
    },
    refetchInterval: 60_000,
  });
}

export function useReplacements(status?: string) {
  return useQuery({
    queryKey: ["consumables", "replacements", status ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<ConsumableReplacement[]>("/consumables/replacements", { params: { status } });
      return data;
    },
  });
}

export function useCreateReplacement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      printerId,
      ...input
    }: {
      printerId: string;
      type: string;
      color?: string;
      notes?: string;
      inventoryItemId?: string;
    }) => {
      const { data } = await apiClient.post<ConsumableReplacement>(`/consumables/${printerId}/replacements`, input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["consumables"] });
      queryClient.invalidateQueries({ queryKey: ["printers", variables.printerId] });
      queryClient.invalidateQueries({ queryKey: ["inventory-items"] });
    },
  });
}
