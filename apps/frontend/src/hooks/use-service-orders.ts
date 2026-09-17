import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { PaginatedResponse, ServiceOrder, ServiceOrderPriority, ServiceOrderStatus } from "@/lib/types";

export function useServiceOrders(params: { status?: string } = {}) {
  return useQuery({
    queryKey: ["service-orders", params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ServiceOrder>>("/service-orders", {
        params: { ...params, limit: 100 },
      });
      return data;
    },
  });
}

export interface CreateServiceOrderInput {
  customerId: string;
  locationId?: string;
  printerId?: string;
  priority?: ServiceOrderPriority;
  description?: string;
}

export function useCreateServiceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceOrderInput) => {
      const { data } = await apiClient.post<ServiceOrder>("/service-orders", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-orders"] }),
  });
}

export function useUpdateServiceOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ServiceOrderStatus }) => {
      const { data } = await apiClient.patch<ServiceOrder>(`/service-orders/${id}`, { status });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-orders"] }),
  });
}

export function useUpdateServiceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      description?: string;
      diagnosis?: string;
      solution?: string;
      technicianId?: string;
      priority?: ServiceOrderPriority;
    }) => {
      const { data } = await apiClient.patch<ServiceOrder>(`/service-orders/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-orders"] }),
  });
}
