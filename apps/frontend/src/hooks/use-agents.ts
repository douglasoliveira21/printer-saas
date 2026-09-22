import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { Agent } from "@/lib/types";

export function useAgents() {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data } = await apiClient.get<Agent[]>("/agents");
      return data;
    },
    refetchInterval: 30_000,
  });
}

export interface CreateAgentEnrollmentResult {
  agentId: string;
  enrollmentToken: string;
  expiresAt: string;
}

export function useCreateAgentEnrollment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; customerId?: string; locationId?: string }) => {
      const { data } = await apiClient.post<CreateAgentEnrollmentResult>("/agents", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useRenameAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data } = await apiClient.patch<Agent>(`/agents/${id}`, { name });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/agents/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useRegenerateAgentToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<CreateAgentEnrollmentResult>(`/agents/${id}/regenerate-token`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agents"] }),
  });
}
