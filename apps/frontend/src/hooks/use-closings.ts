import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { MonthlyClosing } from "@/lib/types";

export function useClosings(customerId: string | undefined, year?: number) {
  return useQuery({
    queryKey: ["closings", customerId ?? "none", year ?? "all"],
    queryFn: async () => {
      const { data } = await apiClient.get<MonthlyClosing[]>("/closings", { params: { customerId, year } });
      return data;
    },
    enabled: !!customerId,
  });
}

export function useGenerateClosing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { customerId: string; year: number; month: number }) => {
      const { data } = await apiClient.post<MonthlyClosing>("/closings/generate", input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["closings", variables.customerId] });
    },
  });
}

export function useFreezeClosing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; customerId: string }) => {
      const { data } = await apiClient.post<MonthlyClosing>(`/closings/${id}/freeze`);
      return data;
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["closings", variables.customerId] }),
  });
}

export function useUnfreezeClosing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; customerId: string }) => {
      const { data } = await apiClient.post<MonthlyClosing>(`/closings/${id}/unfreeze`);
      return data;
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["closings", variables.customerId] }),
  });
}

export async function downloadClosingPdf(id: string, filename: string) {
  const { data } = await apiClient.get(`/closings/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
