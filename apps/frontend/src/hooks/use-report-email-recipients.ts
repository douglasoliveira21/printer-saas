import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ReportEmailRecipient } from "@/lib/types";

const QUERY_KEY = ["report-email-recipients"];

export function useReportEmailRecipients() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ReportEmailRecipient[]>("/report-email-recipients");
      return data;
    },
  });
}

export function useAddReportEmailRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data } = await apiClient.post<ReportEmailRecipient>("/report-email-recipients", { email });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useRemoveReportEmailRecipient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/report-email-recipients/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
