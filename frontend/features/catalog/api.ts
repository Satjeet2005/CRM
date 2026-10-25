import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type CatalogProduct = components["schemas"]["CatalogProductResponse"];
export type CatalogProductCreate = components["schemas"]["CatalogProductCreate"];
export type CatalogProductUpdate = components["schemas"]["CatalogProductUpdate"];
export type CatalogAlias = components["schemas"]["CatalogAliasResponse"];
export type CatalogAliasCreate = components["schemas"]["CatalogAliasCreate"];
export type PaginatedCatalogProducts = components["schemas"]["PaginatedResponse_CatalogProductResponse_"];

export function useCatalogProducts(params?: {
  search?: string;
  category?: string;
  stock_status?: string;
  is_active?: boolean;
  page?: number;
  page_size?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.search) queryParams.set("search", params.search);
  if (params?.category && params.category !== "all") queryParams.set("category", params.category);
  if (params?.stock_status && params.stock_status !== "all") queryParams.set("stock_status", params.stock_status);
  if (params?.is_active !== undefined) queryParams.set("is_active", String(params.is_active));
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/catalog/products${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedCatalogProducts>({
    queryKey: ["catalog", params],
    queryFn: () => apiClient.get<PaginatedCatalogProducts>(url),
  });
}

export function useCatalogProduct(id: string | null | undefined) {
  return useQuery<CatalogProduct>({
    queryKey: ["catalog", id],
    queryFn: () => apiClient.get<CatalogProduct>(`/api/v1/catalog/products/${id}`),
    enabled: !!id,
  });
}

export function useCreateCatalogProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CatalogProductCreate) =>
      apiClient.post<CatalogProduct>("/api/v1/catalog/products", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateCatalogProduct(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CatalogProductUpdate) =>
      apiClient.patch<CatalogProduct>(`/api/v1/catalog/products/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
      queryClient.invalidateQueries({ queryKey: ["catalog", id] });
    },
  });
}

export function useCreateCatalogAlias(productId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CatalogAliasCreate) =>
      apiClient.post<CatalogAlias>(`/api/v1/catalog/products/${productId}/aliases`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog", productId] });
      queryClient.invalidateQueries({ queryKey: ["catalog"] });
    },
  });
}
