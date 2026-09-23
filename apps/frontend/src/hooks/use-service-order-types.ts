import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface ServiceOrderTypeCatalog {
  id: string;
  name: string;
  defaultPrice: string | null;
  blankLinesOnPrint: number;
  active: boolean;
}

export interface ServiceOrderTypeInput {
  name: string;
  defaultPrice?: number;
  blankLinesOnPrint?: number;
  active?: boolean;
}

const QUERY_KEY = ["service-order-types"];

export function useServiceOrderTypes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ServiceOrderTypeCatalog[]>("/service-order-types");
      return data;
    },
  });
}

export function useCreateServiceOrderType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ServiceOrderTypeInput) => {
      const { data } = await apiClient.post<ServiceOrderTypeCatalog>("/service-order-types", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdateServiceOrderType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ServiceOrderTypeInput> & { id: string }) => {
      const { data } = await apiClient.patch<ServiceOrderTypeCatalog>(`/service-order-types/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeleteServiceOrderType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/service-order-types/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
