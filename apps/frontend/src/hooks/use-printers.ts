import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  PageUsagePeriod,
  PaginatedResponse,
  Printer,
  PrinterComment,
  PrinterDuplicatesResponse,
  PrinterTimelineItem,
} from "@/lib/types";

export function usePrinters(params: { status?: string; search?: string; customerId?: string; agentEnrolled?: boolean }) {
  return useQuery({
    queryKey: ["printers", params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<Printer>>("/printers", {
        params: { ...params, limit: 100 },
      });
      return data;
    },
  });
}

/** "Monitoramentos duplicados" — same serial tracked more than once. */
export function usePrinterDuplicates() {
  return useQuery({
    queryKey: ["printers", "duplicates"],
    queryFn: async () => {
      const { data } = await apiClient.get<PrinterDuplicatesResponse>("/printers/duplicates");
      return data;
    },
  });
}

export function usePrinter(id: string | undefined) {
  return useQuery({
    queryKey: ["printers", id],
    queryFn: async () => {
      const { data } = await apiClient.get<Printer>(`/printers/${id}`);
      return data;
    },
    enabled: !!id,
    refetchInterval: 30_000,
  });
}

export function useClaimPrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, customerId, locationId }: { id: string; customerId: string; locationId?: string }) => {
      const { data } = await apiClient.post<Printer>(`/printers/${id}/claim`, { customerId, locationId });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
    },
  });
}

export function useIgnorePrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Printer>(`/printers/${id}/ignore`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
    },
  });
}

export function useRestorePrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Printer>(`/printers/${id}/restore`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["printers"] }),
  });
}

export function useDecommissionPrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.patch<Printer>(`/printers/${id}/decommission`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["printers"] }),
  });
}

export function useUpdatePrinter() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: {
      id: string;
      manufacturer?: string;
      model?: string;
      hostname?: string;
      slaHours?: number;
      collectionMethod?: "SNMP" | "MANUAL";
      snmpV3CredentialId?: string | null;
      departmentId?: string | null;
    }) => {
      const { data } = await apiClient.patch<Printer>(`/printers/${id}`, input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["printers"] });
      queryClient.invalidateQueries({ queryKey: ["printers", variables.id] });
    },
  });
}

export function usePrinterTimeline(id: string | undefined) {
  return useQuery({
    queryKey: ["printers", id, "timeline"],
    queryFn: async () => {
      const { data } = await apiClient.get<PrinterTimelineItem[]>(`/printers/${id}/timeline`);
      return data;
    },
    enabled: !!id,
  });
}

export function usePrinterPageUsage(id: string | undefined, granularity: "month" | "day") {
  return useQuery({
    queryKey: ["printers", id, "page-usage", granularity],
    queryFn: async () => {
      const { data } = await apiClient.get<PageUsagePeriod[]>(`/printers/${id}/page-usage`, { params: { granularity } });
      return data;
    },
    enabled: !!id,
  });
}

export function usePrinterComments(id: string | undefined) {
  return useQuery({
    queryKey: ["printers", id, "comments"],
    queryFn: async () => {
      const { data } = await apiClient.get<PrinterComment[]>(`/printers/${id}/comments`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreatePrinterComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { data } = await apiClient.post<PrinterComment>(`/printers/${id}/comments`, { body });
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["printers", variables.id, "comments"] });
    },
  });
}
