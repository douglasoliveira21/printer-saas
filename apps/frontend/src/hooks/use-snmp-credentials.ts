import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export const SNMP_V3_SECURITY_LEVELS = ["noAuthNoPriv", "authNoPriv", "authPriv"] as const;
export const SNMP_V3_AUTH_PROTOCOLS = ["MD5", "SHA1", "SHA256", "SHA384", "SHA512"] as const;
export const SNMP_V3_PRIV_PROTOCOLS = ["DES", "AES128", "AES192", "AES256"] as const;

export type SnmpV3SecurityLevel = (typeof SNMP_V3_SECURITY_LEVELS)[number];
export type SnmpV3AuthProtocol = (typeof SNMP_V3_AUTH_PROTOCOLS)[number];
export type SnmpV3PrivProtocol = (typeof SNMP_V3_PRIV_PROTOCOLS)[number];

/** Never carries a decrypted password — only whether one is set (`hasAuthenticationPassword`/`hasPrivacyPassword`), same shape the API returns. */
export interface SnmpCredential {
  id: string;
  name: string;
  userName: string;
  securityLevel: SnmpV3SecurityLevel;
  authenticationProtocol: SnmpV3AuthProtocol | null;
  hasAuthenticationPassword: boolean;
  privacyProtocol: SnmpV3PrivProtocol | null;
  hasPrivacyPassword: boolean;
  contextName: string | null;
  printersUsingIt: number;
  agentsUsingItAsDefault: number;
  createdAt: string;
  updatedAt: string;
}

export interface SnmpCredentialInput {
  name: string;
  userName: string;
  securityLevel: SnmpV3SecurityLevel;
  authenticationProtocol?: SnmpV3AuthProtocol;
  /** Only sent when the user actually typed a new one — leaving it out on update keeps whatever's already stored. */
  authenticationPassword?: string;
  privacyProtocol?: SnmpV3PrivProtocol;
  privacyPassword?: string;
  contextName?: string | null;
}

export function useSnmpCredentials() {
  return useQuery({
    queryKey: ["snmp-credentials"],
    queryFn: async () => {
      const { data } = await apiClient.get<SnmpCredential[]>("/snmp-credentials");
      return data;
    },
  });
}

export function useCreateSnmpCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SnmpCredentialInput) => {
      const { data } = await apiClient.post<SnmpCredential>("/snmp-credentials", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["snmp-credentials"] }),
  });
}

export function useUpdateSnmpCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<SnmpCredentialInput> & { id: string }) => {
      const { data } = await apiClient.patch<SnmpCredential>(`/snmp-credentials/${id}`, input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["snmp-credentials"] }),
  });
}

export function useDeleteSnmpCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/snmp-credentials/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["snmp-credentials"] }),
  });
}
