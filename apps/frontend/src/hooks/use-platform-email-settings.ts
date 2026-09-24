import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface PlatformEmailSettings {
  m365ClientId: string | null;
  hasM365ClientSecret: boolean;
  redirectUri: string;
  updatedAt: string | null;
}

export interface UpdatePlatformEmailSettingsInput {
  m365ClientId?: string;
  m365ClientSecret?: string;
}

const QUERY_KEY = ["platform-email-settings"];

export function usePlatformEmailSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<PlatformEmailSettings>("/platform/email-settings");
      return data;
    },
  });
}

export function useUpdatePlatformEmailSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePlatformEmailSettingsInput) => {
      const { data } = await apiClient.put<PlatformEmailSettings>("/platform/email-settings", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
