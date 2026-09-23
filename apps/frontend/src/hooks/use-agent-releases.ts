import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface AgentRelease {
  id: string;
  version: string;
  downloadUrl: string;
  sha256: string;
  signingCertThumbprint: string | null;
  releaseNotes: string | null;
  isActive: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type AgentReleaseInput = Omit<AgentRelease, "id" | "publishedAt" | "createdAt" | "updatedAt">;

export function useAgentReleases() {
  return useQuery({
    queryKey: ["agent-releases"],
    queryFn: async () => {
      const { data } = await apiClient.get<AgentRelease[]>("/platform/agent-releases");
      return data;
    },
  });
}

export function useCreateAgentRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AgentReleaseInput) => {
      const { data } = await apiClient.post<AgentRelease>("/platform/agent-releases", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-releases"] }),
  });
}

export function useUpdateAgentRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<AgentReleaseInput> & { id: string }) => {
      const { data } = await apiClient.patch<AgentRelease>(`/platform/agent-releases/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-releases"] }),
  });
}

export function useDeleteAgentRelease() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/platform/agent-releases/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["agent-releases"] }),
  });
}
