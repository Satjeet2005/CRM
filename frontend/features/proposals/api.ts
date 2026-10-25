import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type ProposalListItem = components["schemas"]["ProposalListItemResponse"];
export type PaginatedProposals = components["schemas"]["PaginatedProposalsResponse"];
export type ProposalDetail = components["schemas"]["ProposalDetailResponse"];
export type ProposalDiff = components["schemas"]["ProposalDiffResponse"];
export type CreateProposalRequest = components["schemas"]["CreateProposalRequest"];
export type UpdateProposalDraftRequest = components["schemas"]["UpdateProposalDraftRequest"];
export type ApprovalDecisionRequest = components["schemas"]["ApprovalDecisionRequest"];
export type ApprovalDecision = components["schemas"]["ApprovalDecisionResponse"];
export type InitialQuoteSubmitRequest = components["schemas"]["InitialQuoteSubmitRequest"];
export type InitialQuoteDecisionRequest = components["schemas"]["InitialQuoteDecisionRequest"];
export type QuoteRevision = components["schemas"]["QuoteRevisionResponse"];
export type QuoteDetail = components["schemas"]["QuoteDetailResponse"];

export function useQuoteProposals(
  quoteId: string | null | undefined,
  params?: { status?: string; page?: number; page_size?: number }
) {
  const queryParams = new URLSearchParams();
  if (params?.status && params.status !== "all") queryParams.set("status", params.status);
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/quotes/${quoteId}/proposals${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedProposals>({
    queryKey: ["proposals", "quote", quoteId, params],
    queryFn: () => apiClient.get<PaginatedProposals>(url),
    enabled: !!quoteId,
  });
}

export function useProposal(proposalId: string | null | undefined) {
  return useQuery<ProposalDetail>({
    queryKey: ["proposals", proposalId],
    queryFn: () => apiClient.get<ProposalDetail>(`/api/v1/proposals/${proposalId}`),
    enabled: !!proposalId,
  });
}

export function useProposalDiff(proposalId: string | null | undefined) {
  return useQuery<ProposalDiff>({
    queryKey: ["proposals", proposalId, "diff"],
    queryFn: () => apiClient.get<ProposalDiff>(`/api/v1/proposals/${proposalId}/diff`),
    enabled: !!proposalId,
  });
}

export function useCreateProposal() {
  const qc = useQueryClient();
  return useMutation<
    ProposalDetail,
    Error,
    { quoteId: string; payload: CreateProposalRequest; idempotencyKey?: string }
  >({
    mutationFn: ({ quoteId, payload, idempotencyKey }) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return apiClient.post<ProposalDetail>(
        `/api/v1/quotes/${quoteId}/proposals`,
        payload,
        { headers }
      );
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["proposals", "quote", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateProposalDraft() {
  const qc = useQueryClient();
  return useMutation<
    ProposalDetail,
    Error,
    { proposalId: string; payload: UpdateProposalDraftRequest }
  >({
    mutationFn: ({ proposalId, payload }) =>
      apiClient.patch<ProposalDetail>(`/api/v1/proposals/${proposalId}`, payload),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["proposals", variables.proposalId] });
      qc.invalidateQueries({ queryKey: ["proposals", variables.proposalId, "diff"] });
    },
  });
}

export function useSubmitProposal() {
  const qc = useQueryClient();
  return useMutation<ProposalDetail, Error, { proposalId: string; quoteId: string }>({
    mutationFn: ({ proposalId }) =>
      apiClient.post<ProposalDetail>(`/api/v1/proposals/${proposalId}/submit`, {}),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["proposals", variables.proposalId] });
      qc.invalidateQueries({ queryKey: ["proposals", "quote", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCancelProposal() {
  const qc = useQueryClient();
  return useMutation<ProposalDetail, Error, { proposalId: string; quoteId: string }>({
    mutationFn: ({ proposalId }) =>
      apiClient.post<ProposalDetail>(`/api/v1/proposals/${proposalId}/cancel`, {}),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["proposals", variables.proposalId] });
      qc.invalidateQueries({ queryKey: ["proposals", "quote", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useApproveProposal() {
  const qc = useQueryClient();
  return useMutation<
    ApprovalDecision,
    Error,
    { proposalId: string; quoteId: string; payload: ApprovalDecisionRequest; idempotencyKey?: string }
  >({
    mutationFn: ({ proposalId, payload, idempotencyKey }) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return apiClient.post<ApprovalDecision>(
        `/api/v1/proposals/${proposalId}/approve`,
        payload,
        { headers }
      );
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["proposals", variables.proposalId] });
      qc.invalidateQueries({ queryKey: ["proposals", "quote", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useRejectProposal() {
  const qc = useQueryClient();
  return useMutation<
    ApprovalDecision,
    Error,
    { proposalId: string; quoteId: string; payload: ApprovalDecisionRequest; idempotencyKey?: string }
  >({
    mutationFn: ({ proposalId, payload, idempotencyKey }) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return apiClient.post<ApprovalDecision>(
        `/api/v1/proposals/${proposalId}/reject`,
        payload,
        { headers }
      );
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["proposals", variables.proposalId] });
      qc.invalidateQueries({ queryKey: ["proposals", "quote", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCommitProposal() {
  const qc = useQueryClient();
  return useMutation<
    QuoteRevision,
    Error,
    { proposalId: string; quoteId: string; idempotencyKey?: string }
  >({
    mutationFn: ({ proposalId, idempotencyKey }) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return apiClient.post<QuoteRevision>(
        `/api/v1/proposals/${proposalId}/commit`,
        { idempotency_key: idempotencyKey },
        { headers }
      );
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["proposals", variables.proposalId] });
      qc.invalidateQueries({ queryKey: ["proposals", "quote", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId, "revisions"] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useSubmitQuoteForApproval() {
  const qc = useQueryClient();
  return useMutation<
    QuoteDetail,
    Error,
    { quoteId: string; payload?: InitialQuoteSubmitRequest }
  >({
    mutationFn: ({ quoteId, payload }) =>
      apiClient.post<QuoteDetail>(
        `/api/v1/quotes/${quoteId}/submit-for-approval`,
        payload || {}
      ),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useApproveInitialQuote() {
  const qc = useQueryClient();
  return useMutation<
    ApprovalDecision,
    Error,
    { quoteId: string; payload: InitialQuoteDecisionRequest; idempotencyKey?: string }
  >({
    mutationFn: ({ quoteId, payload, idempotencyKey }) => {
      const headers: Record<string, string> = {};
      if (idempotencyKey) {
        headers["Idempotency-Key"] = idempotencyKey;
      }
      return apiClient.post<ApprovalDecision>(
        `/api/v1/quotes/${quoteId}/approve-initial`,
        payload,
        { headers }
      );
    },
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: ["quotes", variables.quoteId] });
      qc.invalidateQueries({ queryKey: ["quotes"] });
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
