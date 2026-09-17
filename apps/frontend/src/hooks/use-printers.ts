import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse, Printer } from "@/lib/types";

export function usePrinters(params: { status?: string; search?: string; customerId?: string }) {
  return useQuery({
    queryKey: ["printers", params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Printer>>("/printers", {
        params: { ...params, limit: 100 },
      });
      return data;
    },
  });
}

export function usePrinter(id: string | undefined) {
  return useQuery({
    queryKey: ["printers", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Printer>(`/printers/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useClaimPrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customerId, locationId }: { id: string; customerId: string; locationId?: string }) => {
      const { data } = await apiClient.post<Printer>(`/printers/${id}/claim`, { customerId, locationId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
    },
  });
}

export function useIgnorePrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Printer>(`/printers/${id}/ignore`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
    },
  });
}
