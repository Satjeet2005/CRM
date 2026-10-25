import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type ApprovalQueueItem = components["schemas"]["ApprovalQueueItemResponse"];
export type PaginatedApprovals = components["schemas"]["PaginatedApprovalsResponse"];

export function useApprovalQueue(params?: {
  status?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.status && params.status !== "all") queryParams.set("status", params.status);
  if (params?.search) queryParams.set("search", params.search);
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/approvals${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedApprovals>({
    queryKey: ["approvals", params],
    queryFn: () => apiClient.get<PaginatedApprovals>(url),
  });
}
