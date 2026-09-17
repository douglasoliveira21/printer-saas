import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  status: string;
  lastLoginAt: string | null;
  role: { id: string; name: string } | null;
}

export function useTenantUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const { data } = await apiClient.get<TenantUser[]>("/users");
      return data;
    },
  });
}
