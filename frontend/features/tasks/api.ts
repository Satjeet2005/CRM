import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Task = components["schemas"]["TaskResponse"];
export type TaskCreate = components["schemas"]["TaskCreate"];
export type TaskUpdate = components["schemas"]["TaskUpdate"];
export type PaginatedTasks = components["schemas"]["PaginatedResponse_TaskResponse_"];

export function useTasks(params?: {
  assignee_id?: string;
  status?: string;
  priority?: string;
  is_overdue?: boolean;
  account_id?: string;
  opportunity_id?: string;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.assignee_id) queryParams.set("assignee_id", params.assignee_id);
  if (params?.status && params.status !== "all") queryParams.set("status", params.status);
  if (params?.priority && params.priority !== "all") queryParams.set("priority", params.priority);
  if (params?.is_overdue !== undefined) queryParams.set("is_overdue", String(params.is_overdue));
  if (params?.account_id) queryParams.set("account_id", params.account_id);
  if (params?.opportunity_id) queryParams.set("opportunity_id", params.opportunity_id);
  if (params?.search) queryParams.set("search", params.search);
  if (params?.page) queryParams.set("page", params.page.toString());
  if (params?.page_size) queryParams.set("page_size", params.page_size.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/tasks${qs ? `?${qs}` : ""}`;

  return useQuery<PaginatedTasks>({
    queryKey: ["tasks", params],
    queryFn: () => apiClient.get<PaginatedTasks>(url),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskCreate) => apiClient.post<Task>("/api/v1/tasks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useUpdateTask(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TaskUpdate) => apiClient.patch<Task>(`/api/v1/tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, expected_version }: { taskId: string; expected_version: number }) =>
      apiClient.post<Task>(`/api/v1/tasks/${taskId}/complete`, { expected_version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useReopenTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, expected_version }: { taskId: string; expected_version: number }) =>
      apiClient.post<Task>(`/api/v1/tasks/${taskId}/reopen`, { expected_version }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
