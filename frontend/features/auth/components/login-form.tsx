"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, Sparkles, Workflow } from "lucide-react";
import { Button, Input, Alert } from "@/components/sakani";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type BackendStatus = "checking" | "waking" | "ready" | "unavailable";

const DEFAULT_HEALTH_CHECK_INTERVAL_MS = 2_500;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 8_000;
const DEFAULT_BACKEND_WAKE_TIMEOUT_MS = 120_000;

const DEMO_ACCOUNTS = [
  {
    roleName: "Sales Rep",
    email: "sales@forgeflow.demo",
    roleKey: "sales_rep",
    subtitle: "CRM, RFQ & Draft Quotes",
  },
  {
    roleName: "Sales Manager",
    email: "manager@forgeflow.demo",
    roleKey: "sales_manager",
    subtitle: "Reviews & Approvals",
  },
  {
    roleName: "Catalog Reviewer",
    email: "catalog@forgeflow.demo",
    roleKey: "catalog_manager",
    subtitle: "Catalog & Costing",
  },
  {
    roleName: "Administrator",
    email: "admin@forgeflow.demo",
    roleKey: "admin",
    subtitle: "Full System Access",
  },
];

export function LoginForm() {
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [backendStatus, setBackendStatus] = React.useState<BackendStatus>("checking");
  const [healthCheckAttempt, setHealthCheckAttempt] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    let requestTimeout: number | undefined;
    let activeController: AbortController | null = null;

    const wakeTimeoutMs =
      (typeof window !== "undefined" &&
        (window as unknown as { __BACKEND_WAKE_TIMEOUT_MS__?: number })
          .__BACKEND_WAKE_TIMEOUT_MS__) ||
      DEFAULT_BACKEND_WAKE_TIMEOUT_MS;

    const intervalMs =
      (typeof window !== "undefined" &&
        (window as unknown as { __HEALTH_CHECK_INTERVAL_MS__?: number })
          .__HEALTH_CHECK_INTERVAL_MS__) ||
      DEFAULT_HEALTH_CHECK_INTERVAL_MS;

    const requestTimeoutMs =
      (typeof window !== "undefined" &&
        (window as unknown as { __HEALTH_CHECK_TIMEOUT_MS__?: number })
          .__HEALTH_CHECK_TIMEOUT_MS__) ||
      DEFAULT_HEALTH_CHECK_TIMEOUT_MS;

    const deadline = Date.now() + wakeTimeoutMs;

    const checkBackend = async (): Promise<void> => {
      if (cancelled) return;

      const controller = new AbortController();
      activeController = controller;
      requestTimeout = window.setTimeout(
        () => controller.abort(),
        requestTimeoutMs
      );

      try {
        // This request goes through the frontend's existing /health rewrite.
        // A first 502/503 may be expected while Render wakes the free backend.
        const response = await fetch("/health/ready", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          headers: { "Cache-Control": "no-cache" },
          signal: controller.signal,
        });

        if (response.ok) {
          if (!cancelled) setBackendStatus("ready");
          return;
        }
      } catch {
        // Keep retrying while the backend starts or the request times out.
      } finally {
        if (requestTimeout !== undefined) {
          window.clearTimeout(requestTimeout);
          requestTimeout = undefined;
        }
      }

      if (cancelled) return;

      if (Date.now() >= deadline) {
        setBackendStatus("unavailable");
        return;
      }

      setBackendStatus("waking");
      retryTimer = window.setTimeout(checkBackend, intervalMs);
    };

    void checkBackend();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      if (requestTimeout !== undefined) window.clearTimeout(requestTimeout);
      activeController?.abort();
    };
  }, [healthCheckAttempt]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    if (backendStatus !== "ready") {
      setServerError("Please wait for the server to finish starting before signing in.");
      return;
    }

    try {
      await login(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setServerError(err.message || "Invalid email or password");
      } else {
        setServerError("Failed to connect to authentication server. Please retry.");
      }
    }
  };

  const handleSelectDemoAccount = (email: string) => {
    setValue("email", email, { shouldValidate: true });
    setValue("password", "ForgeFlowDemo!2026", { shouldValidate: true });
    setServerError(null);
  };

  const retryBackendConnection = () => {
    setServerError(null);
    setBackendStatus("checking");
    setHealthCheckAttempt((attempt) => attempt + 1);
  };

  const isBackendChecking = backendStatus === "checking" || backendStatus === "waking";

  return (
    <div className="w-full max-w-md space-y-6 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-6 sm:p-8 shadow-sm">
      {/* Brand Header */}
      <div className="text-center space-y-2.5">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-primary-500)] text-white shadow-xs">
          <Workflow className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-fg-default)]">
            Sign in to ForgeFlow
          </h1>
          <p className="text-xs text-[var(--color-fg-muted)]">
            B2B CRM, RFQ Normalization & Quotation Operations
          </p>
        </div>
      </div>

      {/* Demo Credentials Quick-Select Chooser */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] p-3.5 space-y-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-warning-fg)]">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Demo Mode Enabled: Quick Role Select</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.roleKey}
              type="button"
              onClick={() => handleSelectDemoAccount(acc.email)}
              className="group rounded-[var(--radius-md)] border border-[var(--color-warning-border)] bg-[var(--color-bg-surface)] p-2 text-left transition-all hover:border-[var(--color-primary-500)] hover:shadow-xs focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] cursor-pointer"
            >
              <div className="font-semibold text-xs text-[var(--color-fg-default)] group-hover:text-[var(--color-primary-600)]">
                {acc.roleName}
              </div>
              <div className="text-[10px] text-[var(--color-fg-muted)] truncate">
                {acc.email}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Cold-start status: wake the API and wait for DB readiness before allowing login. */}
      {backendStatus === "ready" ? (
        <div
          role="status"
          className="flex items-center gap-2 rounded-[var(--radius-lg)] border border-[var(--color-success-border)] bg-[var(--color-success-bg)] p-3 text-xs text-[var(--color-success-fg)]"
        >
          <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
          <span>Server is ready. You can sign in.</span>
        </div>
      ) : backendStatus === "unavailable" ? (
        <Alert
          color="warning"
          role="alert"
          title="Server is taking longer than expected"
          description="We couldn't confirm that the server is ready yet. Check your connection and retry."
        >
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={retryBackendConnection}
            >
              Retry connection
            </Button>
          </div>
        </Alert>
      ) : (
        <Alert
          color="info"
          role="status"
          title={backendStatus === "checking" ? "Connecting to ForgeFlow" : "Waking up the server"}
          description="The preview server may be asleep after inactivity. We’re starting it and checking database readiness automatically. Sign-in will unlock as soon as it is ready."
        />
      )}

      {/* Form Error Banner */}
      {serverError && (
        <Alert
          color="danger"
          title="Sign in failed"
          description={serverError}
        />
      )}

      {/* Login Credentials Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@forgeflow.demo"
          error={errors.email?.message}
          {...register("email")}
        />

        <div className="relative">
          <Input
            id="password"
            label="Password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="••••••••••••"
            error={errors.password?.message}
            className="pr-10"
            {...register("password")}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-8.5 text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] rounded-[var(--radius-xs)] p-0.5 cursor-pointer"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full mt-2 font-medium"
          isLoading={isLoggingIn || isBackendChecking}
          disabled={backendStatus !== "ready"}
        >
          {backendStatus === "ready"
            ? "Sign In"
            : backendStatus === "unavailable"
              ? "Server unavailable"
              : backendStatus === "checking"
                ? "Connecting…"
                : "Waking up server…"}
        </Button>
      </form>

      {/* Synthetic Demo Disclaimer */}
      <div className="text-center pt-1 border-t border-[var(--color-border-subtle)]">
        <p className="text-[11px] text-[var(--color-fg-muted)]">
          Synthetic demo environment. Not for production credentials.
        </p>
      </div>
    </div>
  );
}
