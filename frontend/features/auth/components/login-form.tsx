"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Eye, EyeOff, ShieldAlert, Sparkles, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/forms/form-field";
import { InlineError } from "@/components/forms/inline-error";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api/client";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

const DEMO_ACCOUNTS = [
  {
    roleName: "Sales Rep",
    email: "sales@forgeflow.demo",
    roleKey: "sales_rep",
  },
  {
    roleName: "Sales Manager",
    email: "manager@forgeflow.demo",
    roleKey: "sales_manager",
  },
  {
    roleName: "Catalog Reviewer",
    email: "catalog@forgeflow.demo",
    roleKey: "catalog_manager",
  },
  {
    roleName: "Administrator",
    email: "admin@forgeflow.demo",
    roleKey: "admin",
  },
];

export function LoginForm() {
  const { login, isLoggingIn } = useAuth();
  const [showPassword, setShowPassword] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);

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

  return (
    <div className="w-full max-w-md space-y-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
      {/* Brand Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-[var(--primary)] text-white shadow-xs">
          <Workflow className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--foreground)]">
          Sign in to ForgeFlow
        </h1>
        <p className="text-sm text-[var(--muted-foreground)]">
          B2B CRM, RFQ Normalization & Quotation Review
        </p>
      </div>

      {/* Demo Credentials Quick-Select Chooser */}
      <div className="rounded-[var(--radius-md)] border border-[var(--warning)]/30 bg-[var(--warning-soft)] p-3 text-xs text-[var(--warning)] space-y-2">
        <div className="flex items-center gap-1.5 font-semibold">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Demo Mode Enabled: Quick Role Select</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.roleKey}
              type="button"
              onClick={() => handleSelectDemoAccount(acc.email)}
              className="truncate rounded border border-[var(--warning)]/40 bg-[var(--surface)] px-2 py-1.5 text-left text-[11px] font-medium text-[var(--foreground)] transition-colors hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] cursor-pointer"
            >
              <div className="font-semibold">{acc.roleName}</div>
              <div className="text-[10px] text-[var(--muted-foreground)] truncate">
                {acc.email}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Form Error Banner */}
      {serverError && (
        <div
          role="alert"
          className="rounded-[var(--radius-sm)] border border-[var(--destructive)]/30 bg-[var(--destructive-soft)] p-3 text-sm text-[var(--destructive)] flex items-start gap-2"
        >
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{serverError}</span>
        </div>
      )}

      {/* Login Credentials Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          id="email"
          label="Email address"
          required
          error={errors.email?.message}
        >
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@forgeflow.demo"
            hasError={Boolean(errors.email)}
            {...register("email")}
          />
        </FormField>

        <FormField
          id="password"
          label="Password"
          required
          error={errors.password?.message}
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••••"
              hasError={Boolean(errors.password)}
              className="pr-10"
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-2.5 text-[var(--muted-foreground)] hover:text-[var(--foreground)] focus-visible:outline-2 focus-visible:outline-[var(--primary)] cursor-pointer"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </FormField>

        <Button
          type="submit"
          className="w-full mt-2"
          isLoading={isLoggingIn}
        >
          Sign In
        </Button>
      </form>

      {/* Synthetic Demo Disclaimer */}
      <div className="text-center">
        <p className="text-[11px] text-[var(--muted-foreground)]">
          Synthetic demo environment. Not for production credentials.
        </p>
      </div>
    </div>
  );
}
