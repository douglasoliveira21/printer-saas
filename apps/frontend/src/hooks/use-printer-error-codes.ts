import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export interface PrinterErrorCode {
  id: string;
  manufacturer: string;
  code: string;
  description: string;
  severity: AlertSeverity;
}

export interface PrinterErrorCodeInput {
  manufacturer: string;
  code: string;
  description: string;
  severity: AlertSeverity;
}

const QUERY_KEY = ["printer-error-codes"];

export function usePrinterErrorCodes() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<PrinterErrorCode[]>("/printer-error-codes");
      return data;
    },
  });
}

export function useCreatePrinterErrorCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: PrinterErrorCodeInput) => {
      const { data } = await apiClient.post<PrinterErrorCode>("/printer-error-codes", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useUpdatePrinterErrorCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: PrinterErrorCodeInput & { id: string }) => {
      const { data } = await apiClient.patch<PrinterErrorCode>(`/printer-error-codes/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDeletePrinterErrorCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/printer-error-codes/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
