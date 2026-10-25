import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Opportunity = components["schemas"]["OpportunityResponse"];
export type OpportunityCreate = components["schemas"]["OpportunityCreate"];
export type OpportunityUpdate = components["schemas"]["OpportunityUpdate"];
export type OpportunityStageUpdate = components["schemas"]["OpportunityStageUpdate"];
export type OpportunityReopenRequest = components["schemas"]["OpportunityReopenRequest"];
export type PaginatedOpportunities = components["schemas"]["PaginatedResponse_OpportunityResponse_"];
export type Activity = components["schemas"]["ActivityResponse"];

export function useOpportunities(params?: {
  account_id?: string;
  stage?: string;
  owner_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.account_id) queryParams.set("account_id", params.account_id);
  if (params?.stage && params.stage !== "all") queryParams.set("stage", params.stage);
  if (params?.owner_id) queryParams.set("owner_id", params.owner_id);
  if (params?.search) queryParams.set("search", params.search);
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/opportunities${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedOpportunities>({
    queryKey: ["opportunities", params],
    queryFn: () => apiClient.get<PaginatedOpportunities>(url),
  });
}

export function useOpportunity(id: string | null | undefined) {
  return useQuery<Opportunity>({
    queryKey: ["opportunities", id],
    queryFn: () => apiClient.get<Opportunity>(`/api/v1/opportunities/${id}`),
    enabled: !!id,
  });
}

export function useOpportunityTimeline(opportunityId: string | null | undefined) {
  return useQuery<Activity[]>({
    queryKey: ["opportunities", opportunityId, "timeline"],
    queryFn: () => apiClient.get<Activity[]>(`/api/v1/opportunities/${opportunityId}/timeline`),
    enabled: !!opportunityId,
  });
}

export function useCreateOpportunity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OpportunityCreate) =>
      apiClient.post<Opportunity>("/api/v1/opportunities", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOpportunity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OpportunityUpdate) =>
      apiClient.patch<Opportunity>(`/api/v1/opportunities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateOpportunityStage(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OpportunityStageUpdate) =>
      apiClient.post<Opportunity>(`/api/v1/opportunities/${id}/stage`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReopenOpportunity(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: OpportunityReopenRequest) =>
      apiClient.post<Opportunity>(`/api/v1/opportunities/${id}/reopen`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["opportunities", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
