import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api/client";

export interface UserOrganization {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
}

export interface AuthUser {
  id: string;
  email: string;
  display_name: string;
  role: "sales_rep" | "sales_manager" | "catalog_manager" | "admin";
  organization: UserOrganization;
  permissions: string[];
}

interface AuthMeResponse {
  user: AuthUser;
}

interface LoginResponse {
  user: AuthUser;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data, isLoading, isError, error } = useQuery<AuthMeResponse>({
    queryKey: ["auth", "me"],
    queryFn: () => apiClient.get<AuthMeResponse>("/api/v1/auth/me"),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const user = data?.user ?? null;

  const loginMutation = useMutation({
    mutationFn: (credentials: { email: string; password: string }) =>
      apiClient.post<LoginResponse>("/api/v1/auth/login", credentials),
    onSuccess: (res) => {
      queryClient.setQueryData(["auth", "me"], res);
      router.push("/app/dashboard");
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiClient.post("/api/v1/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
    },
  });

  const hasPermission = (permission: string): boolean => {
    return user?.permissions.includes(permission) ?? false;
  };

  return {
    user,
    role: user?.role ?? null,
    organization: user?.organization ?? null,
    permissions: user?.permissions ?? [],
    hasPermission,
    isLoading,
    isAuthenticated: Boolean(user),
    isError,
    error,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
