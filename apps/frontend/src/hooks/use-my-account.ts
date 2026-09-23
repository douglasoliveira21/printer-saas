import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useUpdateMyProfile() {
  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { data } = await apiClient.patch("/users/me", input);
      return data;
    },
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
