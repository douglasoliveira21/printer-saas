import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type NotificationType = "TICKET_ASSIGNED" | "TICKET_SLA_EXPIRING" | "TICKET_SLA_BREACHED" | "TICKET_CLOSED" | "TICKET_COMMENTED";

export interface NotificationTypeSetting {
  type: NotificationType;
  allCustomers: boolean;
  customers: { id: string; legalName: string; tradeName: string | null }[];
}

const QUERY_KEY = ["notification-settings"];

export function useNotificationSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<NotificationTypeSetting[]>("/notification-settings");
      return data;
    },
  });
}

export function useUpdateNotificationSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ type, allCustomers, customerIds }: { type: NotificationType; allCustomers: boolean; customerIds: string[] }) => {
      const { data } = await apiClient.put<NotificationTypeSetting>(`/notification-settings/${type}`, { allCustomers, customerIds });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
