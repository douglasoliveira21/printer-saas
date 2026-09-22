import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Customer, CustomerHistoryItem, Location, PaginatedResponse, SlaHourMode, WorkingHourEntry } from "@/lib/types";

export function useCustomers(search?: string) {
  return useQuery({
    queryKey: ["customers", search ?? ""],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Customer>>("/customers", {
        params: { search: search || undefined, limit: 100 },
      });
      return data;
    },
  });
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Customer & { locations: Location[] }>(`/customers/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export interface CreateCustomerInput {
  personType?: "INDIVIDUAL" | "COMPANY";
  legalName: string;
  tradeName?: string;
  document?: string;
  stateRegistration?: string;
  municipalRegistration?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  financialEmail?: string;
  supportEmail?: string;
  contactName?: string;
  contactRole?: string;
  address?: string;
  zipCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  notes?: string;
  slaHours?: number;
  slaEnabled?: boolean;
  slaHourMode?: SlaHourMode;
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCustomerInput) => {
      const { data } = await apiClient.post<Customer>("/customers", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

export function useCreateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      customerId: string;
      name: string;
      address?: string;
      contactName?: string;
      contactPhone?: string;
      department?: string;
      costCenter?: string;
    }) => {
      const { data } = await apiClient.post<Location>("/locations", input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId] });
    },
  });
}

export type UpdateCustomerInput = Partial<CreateCustomerInput> & { status?: "ACTIVE" | "INACTIVE" | "BLOCKED" };

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCustomerInput & { id: string }) => {
      const { data } = await apiClient.patch<Customer>(`/customers/${id}`, input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers", variables.id] });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/customers/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      customerId,
      ...input
    }: {
      id: string;
      customerId: string;
      name?: string;
      address?: string;
      contactName?: string;
      contactPhone?: string;
      department?: string;
      costCenter?: string;
      slaHours?: number;
    }) => {
      const { data } = await apiClient.patch<Location>(`/locations/${id}`, input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId] });
    },
  });
}

export function useDeleteLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; customerId: string }) => {
      await apiClient.delete(`/locations/${id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId] });
    },
  });
}

export function useSetPrimaryLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; customerId: string }) => {
      const { data } = await apiClient.patch<Location>(`/locations/${id}/primary`);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId] });
    },
  });
}

export function useCustomerHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id, "history"],
    queryFn: async () => {
      const { data } = await apiClient.get<CustomerHistoryItem[]>(`/customers/${id}/history`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCustomerWorkingHours(id: string | undefined) {
  return useQuery({
    queryKey: ["customers", id, "working-hours"],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkingHourEntry[]>(`/customers/${id}/working-hours`);
      return data;
    },
    enabled: !!id,
  });
}

export function useSetCustomerWorkingHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hours }: { id: string; hours: WorkingHourEntry[] }) => {
      const { data } = await apiClient.put<WorkingHourEntry[]>(`/customers/${id}/working-hours`, { hours });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.id, "working-hours"] });
    },
  });
}

export function useTenantWorkingHours() {
  return useQuery({
    queryKey: ["tenant", "working-hours"],
    queryFn: async () => {
      const { data } = await apiClient.get<WorkingHourEntry[]>("/tenant/working-hours");
      return data;
    },
  });
}

export function useSetTenantWorkingHours() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (hours: WorkingHourEntry[]) => {
      const { data } = await apiClient.put<WorkingHourEntry[]>("/tenant/working-hours", { hours });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tenant", "working-hours"] }),
  });
}
