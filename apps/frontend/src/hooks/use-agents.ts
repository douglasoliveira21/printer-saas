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
    mutationFn: async (input: { name: string; locationId?: string }) => {
      const { data } = await apiClient.post<CreateAgentEnrollmentResult>("/agents", input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
