import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface SupplyLevelFilter {
  id: string;
  name: string;
  customerId: string;
  customer: { id: string; legalName: string; tradeName: string | null };
  createdAt: string;
}

export interface SupplyLevelRow {
  printerId: string;
  manufacturer: string | null;
  model: string | null;
  serial: string | null;
  ip: string | null;
  customer: string;
  department: string | null;
  itemName: string | null;
  type: string;
  color: string | null;
  itemSerial: string | null;
  levelPercent: number | null;
  collectedAt: string;
}

export interface SupplyLevelFilterRows {
  filter: SupplyLevelFilter;
  rows: SupplyLevelRow[];
}

export function useSupplyLevelFilters() {
  return useQuery({
    queryKey: ["supply-level-filters"],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplyLevelFilter[]>("/supply-level-filters");
      return data;
    },
  });
}

export function useSupplyLevelFilterRows(id: string | null) {
  return useQuery({
    queryKey: ["supply-level-filters", id, "rows"],
    queryFn: async () => {
      const { data } = await apiClient.get<SupplyLevelFilterRows>(`/supply-level-filters/${id}/rows`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateSupplyLevelFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; customerId: string }) => {
      const { data } = await apiClient.post<SupplyLevelFilter>("/supply-level-filters", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supply-level-filters"] }),
  });
}

export function useDeleteSupplyLevelFilter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/supply-level-filters/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["supply-level-filters"] }),
  });
}
