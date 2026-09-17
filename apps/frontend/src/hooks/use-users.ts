import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "INVITED";
  lastLoginAt: string | null;
  roleId: string | null;
  role: { id: string; name: string } | null;
}

export interface Role {
  id: string;
  name: string;
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

export function useRoles() {
  return useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const { data } = await apiClient.get<Role[]>("/roles");
      return data;
    },
  });
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  roleId?: string;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const { data } = await apiClient.post<TenantUser>("/users", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; roleId?: string; password?: string }) => {
      const { data } = await apiClient.patch<TenantUser>(`/users/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useToggleUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, activate }: { id: string; activate: boolean }) => {
      const { data } = await apiClient.patch<TenantUser>(`/users/${id}/${activate ? "activate" : "deactivate"}`);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
