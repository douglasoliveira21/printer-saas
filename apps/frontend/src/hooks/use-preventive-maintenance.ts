import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface PreventiveMaintenanceSchedule {
  id: string;
  printerId: string;
  intervalDays: number;
  lastTriggeredAt: string | null;
  nextDueAt: string;
  active: boolean;
  notes: string | null;
  printer: { id: string; manufacturer: string | null; model: string | null; serial: string | null };
}

const QUERY_KEY = ["preventive-maintenance"];

export function usePreventiveMaintenanceSchedules() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<PreventiveMaintenanceSchedule[]>("/preventive-maintenance");
      return data;
    },
  });
}

export function useCreatePreventiveMaintenanceSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { printerId: string; intervalDays: number; notes?: string }) => {
      const { data } = await apiClient.post<PreventiveMaintenanceSchedule>("/preventive-maintenance", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdatePreventiveMaintenanceSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; active?: boolean; intervalDays?: number; notes?: string }) => {
      const { data } = await apiClient.patch<PreventiveMaintenanceSchedule>(`/preventive-maintenance/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeletePreventiveMaintenanceSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/preventive-maintenance/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
