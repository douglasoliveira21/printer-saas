import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Contract, FranchiseBilling, PaginatedResponse } from "@/lib/types";

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Contract>>("/contracts", { params: { limit: 100 } });
      return data;
    },
  });
}

export interface CreateContractInput {
  customerId: string;
  printerId?: string;
  startDate: string;
  monthlyFee: number;
  franchisePages?: number;
  overagePriceBw?: number;
  overagePriceColor?: number;
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateContractInput) => {
      const { data } = await apiClient.post<Contract>("/contracts", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export function useUpdateContractStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Contract["status"] }) => {
      const { data } = await apiClient.patch<Contract>(`/contracts/${id}`, { status });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export type UpdateContractInput = Partial<CreateContractInput>;

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateContractInput & { id: string }) => {
      const { data } = await apiClient.patch<Contract>(`/contracts/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contracts"] }),
  });
}

export function useContractBillingPreview(contractId: string | undefined, from: string, to: string) {
  return useQuery({
    queryKey: ["contracts", contractId, "billing-preview", from, to],
    queryFn: async () => {
      const { data } = await apiClient.get<FranchiseBilling>(`/contracts/${contractId}/billing-preview`, { params: { from, to } });
      return data;
    },
    enabled: !!contractId,
  });
}
