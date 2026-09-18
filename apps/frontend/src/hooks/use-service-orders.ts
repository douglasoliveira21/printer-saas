import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type {
  PaginatedResponse,
  ServiceOrder,
  ServiceOrderBillingType,
  ServiceOrderPhotoPhase,
  ServiceOrderPriority,
  ServiceOrderStatus,
  ServiceOrderType,
} from "@/lib/types";

export function useServiceOrders(params: { status?: string; technicianId?: string } = {}) {
  return useQuery({
    queryKey: ["service-orders", params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<ServiceOrder>>("/service-orders", {
        params: { ...params, limit: 100 },
      });
      return data;
    },
  });
}

export function useServiceOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["service-orders", id],
    queryFn: async () => {
      const { data } = await apiClient.get<ServiceOrder>(`/service-orders/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export interface CreateServiceOrderInput {
  customerId: string;
  locationId?: string;
  printerId?: string;
  technicianId?: string;
  serviceType?: ServiceOrderType;
  priority?: ServiceOrderPriority;
  description?: string;
  symptoms?: string[];
  scheduledAt?: string;
}

export function useCreateServiceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateServiceOrderInput) => {
      const { data } = await apiClient.post<ServiceOrder>("/service-orders", input);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-orders"] }),
  });
}

export function useUpdateServiceOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ServiceOrderStatus }) => {
      const { data } = await apiClient.patch<ServiceOrder>(`/service-orders/${id}`, { status });
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["service-orders"] }),
  });
}

export interface UpdateServiceOrderInput {
  id: string;
  description?: string;
  symptoms?: string[];
  serviceType?: ServiceOrderType;
  technicianId?: string;
  priority?: ServiceOrderPriority;
  status?: ServiceOrderStatus;

  diagnosis?: string;
  causeIdentified?: string;
  testsPerformed?: string;
  defectiveParts?: string;
  suppliesUsed?: string;
  technicalNotes?: string;
  solution?: string;

  billingType?: ServiceOrderBillingType;
  laborCost?: number;
  travelCost?: number;

  arrivedAt?: string;
  departedAt?: string;
  mileageKm?: number;
  activityPerformed?: string;
  attendanceNotes?: string;

  equipmentWorking?: boolean;
}

export function useUpdateServiceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateServiceOrderInput) => {
      const { data } = await apiClient.patch<ServiceOrder>(`/service-orders/${id}`, input);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["service-orders"] });
      queryClient.invalidateQueries({ queryKey: ["service-orders", variables.id] });
    },
  });
}

export function useAddServiceOrderPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      serviceOrderId,
      ...input
    }: {
      serviceOrderId: string;
      name: string;
      quantity: number;
      unitValue: number;
      inventoryItemId?: string;
    }) => {
      const { data } = await apiClient.post(`/service-orders/${serviceOrderId}/parts`, input);
      return data;
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["service-orders", variables.serviceOrderId] }),
  });
}

export function useRemoveServiceOrderPart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceOrderId, partId }: { serviceOrderId: string; partId: string }) => {
      await apiClient.delete(`/service-orders/${serviceOrderId}/parts/${partId}`);
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["service-orders", variables.serviceOrderId] }),
  });
}

export function useUploadServiceOrderPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceOrderId, phase, file }: { serviceOrderId: string; phase: ServiceOrderPhotoPhase; file: File }) => {
      const formData = new FormData();
      formData.append("phase", phase);
      formData.append("file", file);
      const { data } = await apiClient.post(`/service-orders/${serviceOrderId}/photos`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["service-orders", variables.serviceOrderId] }),
  });
}

export function useDeleteServiceOrderPhoto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ serviceOrderId, photoId }: { serviceOrderId: string; photoId: string }) => {
      await apiClient.delete(`/service-orders/${serviceOrderId}/photos/${photoId}`);
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["service-orders", variables.serviceOrderId] }),
  });
}

export function useApproveServiceOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      serviceOrderId,
      ...input
    }: {
      serviceOrderId: string;
      approvalName: string;
      approvalSignature: string;
      approvalNotes?: string;
    }) => {
      const { data } = await apiClient.post<ServiceOrder>(`/service-orders/${serviceOrderId}/approve`, input);
      return data;
    },
    onSuccess: (_data, variables) => queryClient.invalidateQueries({ queryKey: ["service-orders", variables.serviceOrderId] }),
  });
}

export async function downloadServiceOrderPdf(id: string, filename: string) {
  const { data } = await apiClient.get(`/service-orders/${id}/pdf`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
