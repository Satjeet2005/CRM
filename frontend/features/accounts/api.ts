import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Account = components["schemas"]["AccountResponse"];
export type AccountCreate = components["schemas"]["AccountCreate"];
export type AccountUpdate = components["schemas"]["AccountUpdate"];
export type PaginatedAccounts = components["schemas"]["PaginatedResponse_AccountResponse_"];
export type Contact = components["schemas"]["ContactResponse"];
export type PaginatedContacts = components["schemas"]["PaginatedResponse_ContactResponse_"];
export type Activity = components["schemas"]["ActivityResponse"];

export function useAccounts(params?: {
  search?: string;
  account_type?: string;
  status?: string;
  industry?: string;
  page?: number;
  page_size?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set("search", params.search);
  if (params?.account_type && params.account_type !== "all") queryParams.set("account_type", params.account_type);
  if (params?.status) queryParams.set("status", params.status);
  if (params?.industry && params.industry !== "all") queryParams.set("industry", params.industry);
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/accounts${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedAccounts>({
    queryKey: ["accounts", params],
    queryFn: () => apiClient.get<PaginatedAccounts>(url),
  });
}

export function useAccount(id: string | null | undefined) {
  return useQuery<Account>({
    queryKey: ["accounts", id],
    queryFn: () => apiClient.get<Account>(`/api/v1/accounts/${id}`),
    enabled: !!id,
  });
}

export function useAccountContacts(accountId: string | null | undefined) {
  return useQuery<PaginatedContacts>({
    queryKey: ["accounts", accountId, "contacts"],
    queryFn: () => apiClient.get<PaginatedContacts>(`/api/v1/accounts/${accountId}/contacts`),
    enabled: !!accountId,
  });
}

export function useAccountTimeline(accountId: string | null | undefined) {
  return useQuery<Activity[]>({
    queryKey: ["accounts", accountId, "timeline"],
    queryFn: () => apiClient.get<Activity[]>(`/api/v1/accounts/${accountId}/timeline`),
    enabled: !!accountId,
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AccountCreate) => apiClient.post<Account>("/api/v1/accounts", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AccountUpdate) => apiClient.patch<Account>(`/api/v1/accounts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", id] });
    },
  });
}

export function useArchiveAccount(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expected_version: number) =>
      apiClient.post<Account>(`/api/v1/accounts/${id}/archive`, { expected_version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
