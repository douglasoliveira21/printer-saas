import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface PlatformTenant {
  id: string;
  name: string;
  document: string | null;
  email: string | null;
  status: "ACTIVE" | "SUSPENDED" | "CANCELLED";
  isDemo: boolean;
  createdAt: string;
  usersCount: number;
  customersCount: number;
  printersCount: number;
  agentsCount: number;
}

export interface PlatformStats {
  tenants: number;
  activeTenants: number;
  printers: number;
  agents: number;
  onlineAgents: number;
}

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const { data } = await apiClient.get<PlatformStats>("/platform/stats");
      return data;
    },
  });
}

export function usePlatformTenants() {
  return useQuery({
    queryKey: ["platform-tenants"],
    queryFn: async () => {
      const { data } = await apiClient.get<PlatformTenant[]>("/platform/tenants");
      return data;
    },
  });
}

export function useUpdateTenantStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: PlatformTenant["status"] }) => {
      const { data } = await apiClient.patch(`/platform/tenants/${id}/status`, { status });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-tenants"] }),
  });
}
