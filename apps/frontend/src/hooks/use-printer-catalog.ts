import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type CatalogTriState = boolean | null;

export interface CatalogCapabilities {
  color?: CatalogTriState;
  duplex?: CatalogTriState;
  a3?: CatalogTriState;
  copy?: CatalogTriState;
  scan?: CatalogTriState;
  fax?: CatalogTriState;
}

export interface PrinterCatalogModel {
  id: string;
  manufacturer: string;
  model: string;
  family: string | null;
  aliases: string[];
  deviceType: "PRINTER" | "MFP" | "PLOTTER";
  capabilities: CatalogCapabilities;
  countersAvailable: Record<string, CatalogTriState> | null;
  suppliesAvailable: Record<string, CatalogTriState> | null;
  confidence: "ALTA" | "MEDIA" | "BAIXA";
  status: "ATUAL" | "DESCONTINUADO" | "ANTIGO" | "A_CONFIRMAR";
  sourcePrimary: string | null;
  sourcesSecondary: string | null;
  notes: string | null;
  researchedAt: string | null;
  createdAt: string;
}

export type CatalogModelInput = Omit<
  PrinterCatalogModel,
  "id" | "createdAt" | "researchedAt" | "aliases" | "countersAvailable" | "suppliesAvailable"
> & {
  aliases?: string[];
  countersAvailable?: Record<string, CatalogTriState> | null;
  suppliesAvailable?: Record<string, CatalogTriState> | null;
};

export function usePrinterCatalog() {
  return useQuery({
    queryKey: ["printer-catalog"],
    queryFn: async () => {
      const { data } = await apiClient.get<PrinterCatalogModel[]>("/platform/printer-catalog");
      return data;
    },
  });
}

export function useCreateCatalogModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CatalogModelInput) => {
      const { data } = await apiClient.post<PrinterCatalogModel>("/platform/printer-catalog", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["printer-catalog"] }),
  });
}

export function useUpdateCatalogModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CatalogModelInput> & { id: string }) => {
      const { data } = await apiClient.patch<PrinterCatalogModel>(`/platform/printer-catalog/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["printer-catalog"] }),
  });
}

export function useDeleteCatalogModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/platform/printer-catalog/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["printer-catalog"] }),
  });
}
