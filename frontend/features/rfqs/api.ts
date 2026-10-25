import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type RFQ = components["schemas"]["RFQResponse"];
export type PaginatedRFQs = components["schemas"]["PaginatedResponse_RFQResponse_"];
export type RFQLine = components["schemas"]["RFQLineResponse"];
export type RFQLineDetail = components["schemas"]["RFQLineDetailResponse"];
export type PaginatedRFQLines = components["schemas"]["PaginatedResponse_RFQLineResponse_"];
export type Candidate = components["schemas"]["CandidateResponse"];
export type DecisionHistoryItem = components["schemas"]["DecisionHistoryItem"];
export type RFQImportPreviewRequest = components["schemas"]["RFQImportPreviewRequest"];
export type RFQImportPreviewResponse = components["schemas"]["RFQImportPreviewResponse"];
export type RFQImportRequest = components["schemas"]["RFQImportRequest"];
export type RFQLineDecisionRequest = components["schemas"]["RFQLineDecisionRequest"];
export type RFQBulkDecisionRequest = components["schemas"]["RFQBulkDecisionRequest"];
export type RFQBulkDecisionResponse = components["schemas"]["RFQBulkDecisionResponse"];
export type RFQRematchRequest = components["schemas"]["RFQRematchRequest"];
export type RFQCreateQuoteRequest = components["schemas"]["RFQCreateQuoteRequest"];
export type RFQCreateQuoteResponse = components["schemas"]["RFQCreateQuoteResponse"];

export function useRFQs(params?: {
  status?: string;
  account_id?: string;
  opportunity_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.status && params.status !== "all") queryParams.set("status", params.status);
  if (params?.account_id) queryParams.set("account_id", params.account_id);
  if (params?.opportunity_id) queryParams.set("opportunity_id", params.opportunity_id);
  if (params?.search) queryParams.set("search", params.search);
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/rfqs${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedRFQs>({
    queryKey: ["rfqs", params],
    queryFn: () => apiClient.get<PaginatedRFQs>(url),
  });
}

export function useRFQ(id: string | null | undefined) {
  return useQuery<RFQ>({
    queryKey: ["rfqs", id],
    queryFn: () => apiClient.get<RFQ>(`/api/v1/rfqs/${id}`),
    enabled: !!id,
  });
}

export function useRFQLines(
  rfqId: string | null | undefined,
  params?: {
    match_status?: string;
    needs_review_only?: boolean;
    page?: number;
    page_size?: number;
  }
) {
  const queryParams = new URLSearchParams();
  if (params?.match_status && params.match_status !== "all") {
    queryParams.set("match_status", params.match_status);
  }
  if (params?.needs_review_only) {
    queryParams.set("needs_review_only", "true");
  }
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/rfqs/${rfqId}/lines${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedRFQLines>({
    queryKey: ["rfqs", rfqId, "lines", params],
    queryFn: () => apiClient.get<PaginatedRFQLines>(url),
    enabled: !!rfqId,
  });
}

export function useRFQLineDetail(rfqId: string | null | undefined, lineId: string | null | undefined) {
  return useQuery<RFQLineDetail>({
    queryKey: ["rfqs", rfqId, "lines", lineId],
    queryFn: () => apiClient.get<RFQLineDetail>(`/api/v1/rfqs/${rfqId}/lines/${lineId}`),
    enabled: !!rfqId && !!lineId,
  });
}

export function usePreviewRFQ() {
  return useMutation<RFQImportPreviewResponse, Error, RFQImportPreviewRequest>({
    mutationFn: (payload) =>
      apiClient.post<RFQImportPreviewResponse>("/api/v1/rfqs/import/preview", payload),
  });
}

export function useImportRFQ() {
  const queryClient = useQueryClient();
  return useMutation<RFQ, Error, RFQImportRequest>({
    mutationFn: (payload) => apiClient.post<RFQ>("/api/v1/rfqs/import", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useLineDecision(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    RFQLineDetail,
    Error,
    { lineId: string; payload: RFQLineDecisionRequest }
  >({
    mutationFn: ({ lineId, payload }) =>
      apiClient.post<RFQLineDetail>(`/api/v1/rfqs/${rfqId}/lines/${lineId}/decision`, payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId] });
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId, "lines"] });
      queryClient.setQueryData(["rfqs", rfqId, "lines", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useBulkAcceptExactMatches(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation<RFQBulkDecisionResponse, Error, RFQBulkDecisionRequest>({
    mutationFn: (payload) =>
      apiClient.post<RFQBulkDecisionResponse>(`/api/v1/rfqs/${rfqId}/lines/bulk-decision`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId] });
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId, "lines"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRematchRFQ(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation<RFQ, Error, RFQRematchRequest>({
    mutationFn: (payload) =>
      apiClient.post<RFQ>(`/api/v1/rfqs/${rfqId}/rematch`, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["rfqs", rfqId], data);
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId, "lines"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCreateQuoteFromRFQ(rfqId: string) {
  const queryClient = useQueryClient();
  return useMutation<RFQCreateQuoteResponse, Error, RFQCreateQuoteRequest>({
    mutationFn: (payload) =>
      apiClient.post<RFQCreateQuoteResponse>(`/api/v1/rfqs/${rfqId}/create-quote`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfqs", rfqId] });
      queryClient.invalidateQueries({ queryKey: ["rfqs"] });
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
