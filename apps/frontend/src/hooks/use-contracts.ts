import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  Contract,
  ContractEmailRecipient,
  ContractFixedCost,
  ContractPrinter,
  ContractReadjustment,
  PaginatedResponse,
} from "@/lib/types";

export function useContracts(params: { status?: string; search?: string } = {}) {
  return useQuery({
    queryKey: ["contracts", params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Contract>>("/contracts", { params: { ...params, limit: 100 } });
      return data;
    },
  });
}

export function useContract(id: string | undefined) {
  return useQuery({
    queryKey: ["contracts", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Contract>(`/contracts/${id}`);
      return data;
    },
    enabled: !!id,
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
  defaultPriceBw?: number;
  defaultPriceColor?: number;
  defaultPriceScan?: number;
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
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      queryClient.invalidateQueries({ queryKey: ["contracts", variables.id] });
    },
  });
}

// ---------------------------------------------------------------------
// Contract printers
// ---------------------------------------------------------------------

export interface ContractPrinterInput {
  printerId: string;
  priceBw?: number;
  priceColor?: number;
  priceScan?: number;
  fixedCost?: number;
}

function invalidateContract(queryClient: ReturnType<typeof useQueryClient>, contractId: string) {
  queryClient.invalidateQueries({ queryKey: ["contracts", contractId] });
}

export function useAddContractPrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, ...input }: ContractPrinterInput & { contractId: string }) => {
      const { data } = await apiClient.post<ContractPrinter>(`/contracts/${contractId}/printers`, input);
      return data;
    },
    onSuccess: (_data, variables) => invalidateContract(queryClient, variables.contractId),
  });
}

export function useUpdateContractPrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      contractPrinterId,
      ...input
    }: Omit<ContractPrinterInput, "printerId"> & { contractId: string; contractPrinterId: string }) => {
      const { data } = await apiClient.patch<ContractPrinter>(`/contracts/${contractId}/printers/${contractPrinterId}`, input);
      return data;
    },
    onSuccess: (_data, variables) => invalidateContract(queryClient, variables.contractId),
  });
}

export function useRemoveContractPrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, contractPrinterId }: { contractId: string; contractPrinterId: string }) => {
      await apiClient.delete(`/contracts/${contractId}/printers/${contractPrinterId}`);
    },
    onSuccess: (_data, variables) => invalidateContract(queryClient, variables.contractId),
  });
}

// ---------------------------------------------------------------------
// Fixed costs
// ---------------------------------------------------------------------

export function useAddContractFixedCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, label, amount }: { contractId: string; label: string; amount: number }) => {
      const { data } = await apiClient.post<ContractFixedCost>(`/contracts/${contractId}/fixed-costs`, { label, amount });
      return data;
    },
    onSuccess: (_data, variables) => invalidateContract(queryClient, variables.contractId),
  });
}

export function useRemoveContractFixedCost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, costId }: { contractId: string; costId: string }) => {
      await apiClient.delete(`/contracts/${contractId}/fixed-costs/${costId}`);
    },
    onSuccess: (_data, variables) => invalidateContract(queryClient, variables.contractId),
  });
}

// ---------------------------------------------------------------------
// Email recipients
// ---------------------------------------------------------------------

export function useContractEmails(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contracts", contractId, "emails"],
    queryFn: async () => {
      const { data } = await apiClient.get<ContractEmailRecipient[]>(`/contracts/${contractId}/emails`);
      return data;
    },
    enabled: !!contractId,
  });
}

export function useAddContractEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, email }: { contractId: string; email: string }) => {
      const { data } = await apiClient.post<ContractEmailRecipient>(`/contracts/${contractId}/emails`, { email });
      return data;
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["contracts", variables.contractId, "emails"] }),
  });
}

export function useRemoveContractEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, emailId }: { contractId: string; emailId: string }) => {
      await apiClient.delete(`/contracts/${contractId}/emails/${emailId}`);
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["contracts", variables.contractId, "emails"] }),
  });
}

// ---------------------------------------------------------------------
// Readjustments
// ---------------------------------------------------------------------

export function useContractReadjustments(contractId: string | undefined) {
  return useQuery({
    queryKey: ["contracts", contractId, "readjustments"],
    queryFn: async () => {
      const { data } = await apiClient.get<ContractReadjustment[]>(`/contracts/${contractId}/readjustments`);
      return data;
    },
    enabled: !!contractId,
  });
}

export function useCreateContractReadjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      contractId,
      ...input
    }: {
      contractId: string;
      percentage: number;
      effectiveMonth: number;
      effectiveYear: number;
      applyNow?: boolean;
    }) => {
      const { data } = await apiClient.post<ContractReadjustment>(`/contracts/${contractId}/readjustments`, input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", variables.contractId, "readjustments"] });
      invalidateContract(queryClient, variables.contractId);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}

export function useApplyContractReadjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractId, readjustmentId }: { contractId: string; readjustmentId: string }) => {
      const { data } = await apiClient.post<ContractReadjustment>(`/contracts/${contractId}/readjustments/${readjustmentId}/apply`);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["contracts", variables.contractId, "readjustments"] });
      invalidateContract(queryClient, variables.contractId);
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
