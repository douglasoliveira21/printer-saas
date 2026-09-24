import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export function useReport<T = Record<string, unknown>>(path: string, params: Record<string, string | undefined> = {}) {
  return useQuery({
    queryKey: ["reports", path, params],
    queryFn: async () => {
      const { data } = await apiClient.get<T[]>(`/reports/${path}`, { params });
      return data;
    },
  });
}

export async function downloadReportCsv(path: string, filename: string, params: Record<string, string | undefined> = {}) {
  const response = await apiClient.get(`/reports/${path}`, {
    params: { ...params, format: "csv" },
    responseType: "blob",
  });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadReportPdf(path: string, filename: string, params: Record<string, string | undefined> = {}) {
  const response = await apiClient.get(`/reports/${path}/pdf`, { params, responseType: "blob" });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
