import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Customer, Location, PaginatedResponse } from "@/lib/types";

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
  legalName: string;
  tradeName?: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
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
    mutationFn: async (input: { customerId: string; name: string; address?: string; contactName?: string; contactPhone?: string }) => {
      const { data } = await apiClient.post<Location>("/locations", input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["customers", variables.customerId] });
    },
  });
}

export type UpdateCustomerInput = Partial<CreateCustomerInput> & { status?: "ACTIVE" | "INACTIVE" };

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
