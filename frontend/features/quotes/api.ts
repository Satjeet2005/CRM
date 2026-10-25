import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type QuoteListItem = components["schemas"]["QuoteListItemResponse"];
export type PaginatedQuotes = components["schemas"]["PaginatedQuotesResponse"];
export type QuoteDetail = components["schemas"]["QuoteDetailResponse"];
export type QuoteRevision = components["schemas"]["QuoteRevisionResponse"];
export type QuoteRevisionLine = components["schemas"]["QuoteRevisionLineResponse"];
export type QuoteTotals = components["schemas"]["QuoteTotalsSchema"];
export type QuoteDraftUpdateRequest = components["schemas"]["QuoteDraftUpdateRequest"];
export type QuoteDraftLineUpdateInput = components["schemas"]["QuoteDraftLineUpdateInput"];
export type CalculationTrace = components["schemas"]["CalculationTraceResponse"];
export type QuoteCustomerDelivery = components["schemas"]["QuoteCustomerDeliveryResponse"];

export function useQuotes(params?: {
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
  const url = `/api/v1/quotes${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedQuotes>({
    queryKey: ["quotes", params],
    queryFn: () => apiClient.get<PaginatedQuotes>(url),
  });
}

export function useQuote(quoteId: string | null | undefined) {
  return useQuery<QuoteDetail>({
    queryKey: ["quotes", quoteId],
    queryFn: () => apiClient.get<QuoteDetail>(`/api/v1/quotes/${quoteId}`),
    enabled: !!quoteId,
  });
}

export function useQuoteRevisions(quoteId: string | null | undefined) {
  return useQuery<QuoteRevision[]>({
    queryKey: ["quotes", quoteId, "revisions"],
    queryFn: () => apiClient.get<QuoteRevision[]>(`/api/v1/quotes/${quoteId}/revisions`),
    enabled: !!quoteId,
  });
}

export function useQuoteRevision(
  quoteId: string | null | undefined,
  revisionId: string | null | undefined
) {
  return useQuery<QuoteRevision>({
    queryKey: ["quotes", quoteId, "revisions", revisionId],
    queryFn: () =>
      apiClient.get<QuoteRevision>(`/api/v1/quotes/${quoteId}/revisions/${revisionId}`),
    enabled: !!quoteId && !!revisionId,
  });
}

export function useCalculationTrace(
  quoteId: string | null | undefined,
  revisionId?: string | null | undefined
) {
  const qs = revisionId ? `?revision_id=${revisionId}` : "";
  return useQuery<CalculationTrace>({
    queryKey: ["quotes", quoteId, "trace", revisionId],
    queryFn: () =>
      apiClient.get<CalculationTrace>(`/api/v1/quotes/${quoteId}/calculation-trace${qs}`),
    enabled: !!quoteId,
  });
}

export function useQuoteDeliveries(quoteId: string | null | undefined) {
  return useQuery<QuoteCustomerDelivery[]>({
    queryKey: ["quotes", quoteId, "deliveries"],
    queryFn: () => apiClient.get<QuoteCustomerDelivery[]>(`/api/v1/quotes/${quoteId}/deliveries`),
    enabled: !!quoteId,
  });
}

export function useUpdateQuoteDraft() {
  const qc = useQueryClient();
  return useMutation<
    QuoteDetail,
    Error,
    { quoteId: string; payload: QuoteDraftUpdateRequest }
  >({
    mutationFn: ({ quoteId, payload }) =>
      apiClient.patch<QuoteDetail>(`/api/v1/quotes/${quoteId}/draft`, payload),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId, "revisions"] });
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId, "trace"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
