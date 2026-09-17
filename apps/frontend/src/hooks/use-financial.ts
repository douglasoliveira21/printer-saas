import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { FinancialEntry, FinancialEntryType, FinancialSummary, PaginatedResponse } from "@/lib/types";

export function useFinancialSummary() {
  return useQuery({
    queryKey: ["financial-summary"],
    queryFn: async () => {
      const { data } = await apiClient.get<FinancialSummary>("/financial/summary");
      return data;
    },
  });
}

export function useFinancialEntries(params: { type?: string; status?: string } = {}) {
  return useQuery({
    queryKey: ["financial-entries", params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<FinancialEntry>>("/financial/entries", {
        params: { ...params, limit: 100 },
      });
      return data;
    },
  });
}

export interface CreateFinancialEntryInput {
  type: FinancialEntryType;
  category: string;
  description?: string;
  amount: number;
  dueDate: string;
  customerId?: string;
}

export function useCreateFinancialEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateFinancialEntryInput) => {
      const { data } = await apiClient.post<FinancialEntry>("/financial/entries", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    },
  });
}

export function useUpdateFinancialEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      category?: string;
      description?: string;
      amount?: number;
      dueDate?: string;
    }) => {
      const { data } = await apiClient.patch<FinancialEntry>(`/financial/entries/${id}`, input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    },
  });
}

export function useCancelFinancialEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<FinancialEntry>(`/financial/entries/${id}/cancel`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    },
  });
}

export function useMarkEntryPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<FinancialEntry>(`/financial/entries/${id}/pay`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial-entries"] });
      queryClient.invalidateQueries({ queryKey: ["financial-summary"] });
    },
  });
}
