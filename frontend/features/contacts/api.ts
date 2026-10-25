import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Contact = components["schemas"]["ContactResponse"];
export type ContactCreate = components["schemas"]["ContactCreate"];
export type ContactUpdate = components["schemas"]["ContactUpdate"];
export type PaginatedContacts = components["schemas"]["PaginatedResponse_ContactResponse_"];

export function useContacts(params?: {
  search?: string;
  account_id?: string;
  status?: string;
  is_primary?: boolean;
  page?: number;
  page_size?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set("search", params.search);
  if (params?.account_id) queryParams.set("account_id", params.account_id);
  if (params?.status) queryParams.set("status", params.status);
  if (params?.is_primary !== undefined) queryParams.set("is_primary", String(params.is_primary));
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/contacts${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedContacts>({
    queryKey: ["contacts", params],
    queryFn: () => apiClient.get<PaginatedContacts>(url),
  });
}

export function useCreateContact(accountId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ContactCreate) =>
      apiClient.post<Contact>(`/api/v1/accounts/${accountId}/contacts`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts", accountId] });
    },
  });
}

export function useUpdateContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: ContactUpdate) => apiClient.patch<Contact>(`/api/v1/contacts/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}

export function useArchiveContact(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expected_version: number) =>
      apiClient.post<Contact>(`/api/v1/contacts/${id}/archive`, { expected_version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
