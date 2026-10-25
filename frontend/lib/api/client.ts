export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: unknown;
  request_id?: string;
}

export class ApiError extends Error {
  code: string;
  details?: unknown;
  requestId?: string;
  status: number;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message || `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code || "API_ERROR";
    this.details = payload.details;
    this.requestId = payload.request_id;
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? decodeURIComponent(match[2]) : null;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const headers = new Headers(options.headers || {});

  // For state-changing mutations, automatically attach CSRF token if present
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfToken = getCookie("forgeflow_csrf");
    if (csrfToken && !headers.has("X-CSRF-Token")) {
      headers.set("X-CSRF-Token", csrfToken);
    }
  }

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "include", // Ensure session and CSRF cookies are transmitted
  });

  if (!response.ok) {
    let errorData: ApiErrorPayload;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        code: "HTTP_" + response.status,
        message: response.statusText || "An unexpected error occurred",
      };
    }
    throw new ApiError(response.status, errorData);
  }

  // Handle empty 204 or bodyless responses
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: unknown, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),

  delete: <T>(path: string, options?: RequestInit) =>
    request<T>(path, { ...options, method: "DELETE" }),
};
