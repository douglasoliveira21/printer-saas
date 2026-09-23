import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type ReportType = "PRINTER_USAGE" | "CLOSING_DIGEST" | "PRINTER_USAGE_WITH_COPIES";
export type CustomerEmailField = "EMAIL" | "FINANCIAL_EMAIL" | "SUPPORT_EMAIL";

export interface ReportDelivery {
  reportType: ReportType;
  allCustomers: boolean;
  emailField: CustomerEmailField;
  customers: { id: string; legalName: string; tradeName: string | null }[];
}

const QUERY_KEY = ["report-deliveries"];

export function useReportDeliveries() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ReportDelivery[]>("/report-deliveries");
      return data;
    },
  });
}

export function useUpdateReportDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reportType,
      allCustomers,
      emailField,
      customerIds,
    }: {
      reportType: ReportType;
      allCustomers: boolean;
      emailField: CustomerEmailField;
      customerIds: string[];
    }) => {
      const { data } = await apiClient.put<ReportDelivery>(`/report-deliveries/${reportType}`, { allCustomers, emailField, customerIds });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
