import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { InventoryItem, InventoryMovementType } from "@/lib/types";

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory-items"],
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryItem[]>("/inventory/items");
      return data;
    },
  });
}

export function useInventoryItem(id: string | undefined) {
  return useQuery({
    queryKey: ["inventory-items", id],
    queryFn: async () => {
      const { data } = await apiClient.get<InventoryItem>(`/inventory/items/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export interface CreateInventoryItemInput {
  name: string;
  type: string;
  code?: string;
  manufacturer?: string;
  model: string;
  color?: string;
  standardLifespanPages?: number;
  costPrice?: number;
  salePrice?: number;
  notes?: string;
  quantity?: number;
  minQuantity?: number;
}

export function useCreateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInventoryItemInput) => {
      const { data } = await apiClient.post<InventoryItem>("/inventory/items", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}

export function useUpdateInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; type?: string; minQuantity?: number }) => {
      const { data } = await apiClient.patch<InventoryItem>(`/inventory/items/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}

export function useDeleteInventoryItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/inventory/items/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}

export function useCreateMovement() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, type, quantity, reason }: { itemId: string; type: InventoryMovementType; quantity: number; reason?: string }) => {
      const { data } = await apiClient.post(`/inventory/items/${itemId}/movements`, { type, quantity, reason });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-items"] }),
  });
}
