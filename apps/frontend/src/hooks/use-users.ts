import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type AccountType = "STAFF" | "CUSTOMER";

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  status: "ACTIVE" | "INACTIVE" | "INVITED";
  lastLoginAt: string | null;
  roleId: string | null;
  role: { id: string; name: string } | null;
  accountType: AccountType;
  customerId: string | null;
  customer: { id: string; legalName: string; tradeName: string | null } | null;
  viewAllCustomers: boolean;
  visibleCustomers: { customer: { id: string; legalName: string; tradeName: string | null } }[];
  directPermissions: { permission: { key: string } }[];
  notifyTicketAssigned: boolean;
  notifyTicketSlaExpiring: boolean;
  notifyTicketSlaBreached: boolean;
  notifyTicketClosed: boolean;
  notifyTicketCommented: boolean;
  createdAt: string;
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

export function useTenantUser(id: string | undefined) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: async () => {
      const { data } = await apiClient.get<TenantUser>(`/users/${id}`);
      return data;
    },
    enabled: !!id,
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

export interface UserAccountInput {
  name: string;
  email: string;
  password?: string;
  accountType: AccountType;
  customerId?: string;
  permissionKeys?: string[];
  viewAllCustomers?: boolean;
  visibleCustomerIds?: string[];
  notifyTicketAssigned?: boolean;
  notifyTicketSlaExpiring?: boolean;
  notifyTicketSlaBreached?: boolean;
  notifyTicketClosed?: boolean;
  notifyTicketCommented?: boolean;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UserAccountInput & { password: string }) => {
      const { data } = await apiClient.post<TenantUser>("/users", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<UserAccountInput> & { id: string }) => {
      const { data } = await apiClient.patch<TenantUser>(`/users/${id}`, input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", variables.id] });
    },
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

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
