import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface TenantInfo {
  id: string;
  name: string;
  legalName: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
}

export interface UpdateTenantInfoInput {
  name?: string;
  legalName?: string;
  document?: string;
  email?: string;
  phone?: string;
  address?: string;
}

const INFO_KEY = ["tenant-info"];

export function useTenantInfo() {
  return useQuery({
    queryKey: INFO_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<TenantInfo>("/tenant/info");
      return data;
    },
  });
}

export function useUpdateTenantInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateTenantInfoInput) => {
      const { data } = await apiClient.put<TenantInfo>("/tenant/info", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INFO_KEY }),
  });
}

export function useUploadTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await apiClient.post<TenantInfo>("/tenant/logo", formData, { headers: { "Content-Type": "multipart/form-data" } });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: INFO_KEY }),
  });
}

export interface AlertThresholds {
  agentOfflineThresholdHours: number | null;
  printerOfflineThresholdHours: number | null;
}

const THRESHOLDS_KEY = ["alert-thresholds"];

export function useAlertThresholds() {
  return useQuery({
    queryKey: THRESHOLDS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<AlertThresholds>("/tenant/alert-thresholds");
      return data;
    },
  });
}

export function useUpdateAlertThresholds() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<AlertThresholds>) => {
      const { data } = await apiClient.put<AlertThresholds>("/tenant/alert-thresholds", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: THRESHOLDS_KEY }),
  });
}

export interface ClosingSettings {
  allowDisablingPrinterMonitoring: boolean;
  allowEditingClosingDocumentNumber: boolean;
  hideUnknownLevelSupplies: boolean;
  hideNonTonerSupplies: boolean;
  closingReportTitle: string;
  closingReportColumns: Record<string, boolean>;
  printUsageReportColumns: Record<string, boolean>;
  additionalText: string | null;
}

const CLOSING_SETTINGS_KEY = ["closing-settings"];

export function useClosingSettings() {
  return useQuery({
    queryKey: CLOSING_SETTINGS_KEY,
    queryFn: async () => {
      const { data } = await apiClient.get<ClosingSettings>("/tenant/closing-settings");
      return data;
    },
  });
}

export function useUpdateClosingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<ClosingSettings>) => {
      const { data } = await apiClient.put<ClosingSettings>("/tenant/closing-settings", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLOSING_SETTINGS_KEY }),
  });
}
