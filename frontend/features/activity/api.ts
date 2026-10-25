import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api/client";
import type { components } from "@/lib/api/schema";

export type Activity = components["schemas"]["ActivityResponse"];

export function useActivities(params?: {
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  event_type?: string;
  limit?: number;
}) {
  const queryParams = new URLSearchParams();
  if (params?.entity_type) queryParams.set("entity_type", params.entity_type);
  if (params?.entity_id) queryParams.set("entity_id", params.entity_id);
  if (params?.actor_id) queryParams.set("actor_id", params.actor_id);
  if (params?.event_type) queryParams.set("event_type", params.event_type);
  if (params?.limit) queryParams.set("limit", params.limit.toString());

  const qs = queryParams.toString();
  const url = `/api/v1/activity${qs ? `?${qs}` : ""}`;

  return useQuery<Activity[]>({
    queryKey: ["activity", params],
    queryFn: () => apiClient.get<Activity[]>(url),
  });
}
