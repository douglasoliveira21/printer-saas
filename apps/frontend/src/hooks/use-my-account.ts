import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { TenantUser } from "./use-users";

export function useMyFullProfile() {
  return useQuery({
    queryKey: ["users", "me", "full"],
    queryFn: async () => {
      const { data } = await apiClient.get<TenantUser>("/users/me/full");
      return data;
    },
  });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await apiClient.patch("/users/me", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users", "me", "full"] }),
  });
}

export function useChangeMyPassword() {
  return useMutation({
    mutationFn: async (input: { currentPassword: string; newPassword: string }) => {
      const { data } = await apiClient.patch("/users/me/password", input);
      return data;
    },
  });
}

export interface LatestAgentRelease {
  id: string;
  version: string;
  downloadUrl: string;
  releaseNotes: string | null;
}

export async function fetchLatestAgentRelease() {
  const { data } = await apiClient.get<LatestAgentRelease | null>("/agents/latest-release");
  return data;
}
