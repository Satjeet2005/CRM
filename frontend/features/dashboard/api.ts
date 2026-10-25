import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type DashboardSummary = components["schemas"]["DashboardSummaryResponse"];
export type AttentionItem = components["schemas"]["AttentionItemResponse"];
export type RFQMatchHealthSummary = components["schemas"]["RFQMatchHealthSummary"];
export type QuoteLifecycleSummary = components["schemas"]["QuoteLifecycleSummary"];
export type TaskDueLoadSummary = components["schemas"]["TaskDueLoadSummary"];

export function useDashboardSummary(params?: { from_date?: string; to_date?: string }) {
  const queryParams = new URLSearchParams();
  if (params?.from_date) queryParams.set("from_date", params.from_date);
  if (params?.to_date) queryParams.set("to_date", params.to_date);
  const qs = queryParams.toString();
  const url = `/api/v1/dashboard/summary${qs ? `?${qs}` : ""}`;

  return useQuery<DashboardSummary>({
    queryKey: ["dashboard", "summary", params],
    queryFn: () => apiClient.get<DashboardSummary>(url),
    refetchInterval: 60000,
  });
}

export function useDashboardAttention(limit = 10) {
  return useQuery<AttentionItem[]>({
    queryKey: ["dashboard", "attention", limit],
    queryFn: () => apiClient.get<AttentionItem[]>(`/api/v1/dashboard/attention?limit=${limit}`),
    refetchInterval: 30000,
  });
}
