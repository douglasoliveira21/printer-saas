import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type EmailProvider = "SMTP" | "MICROSOFT365";

export interface EmailSettings {
  provider: EmailProvider;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  smtpFrom: string | null;
  m365ConnectedEmail: string | null;
  m365ConnectedAt: string | null;
  m365Connected: boolean;
  updatedAt: string | null;
}

export interface UpdateEmailSettingsInput {
  provider?: EmailProvider;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  smtpFrom?: string;
}

const QUERY_KEY = ["email-settings"];

export function useEmailSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<EmailSettings>("/email-settings");
      return data;
    },
  });
}

export function useUpdateEmailSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateEmailSettingsInput) => {
      const { data } = await apiClient.put<EmailSettings>("/email-settings", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useConnectMicrosoft365() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.get<{ url: string }>("/email-settings/m365/connect");
      return data;
    },
  });
}

export function useDisconnectMicrosoft365() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.delete<EmailSettings>("/email-settings/m365");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
