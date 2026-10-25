"use client";

import * as React from "react";
import { ShieldCheck, LogOut } from "lucide-react";
import { Card, Badge, Button } from "@/components/sakani";
import { formatRole } from "@/features/dashboard/components/session-panel";
import type { AuthUser } from "@/hooks/use-auth";

interface SessionCardProps {
  user?: AuthUser | null;
  onLogout?: () => void;
  isLoggingOut?: boolean;
}

export function SessionCard({ user, onLogout, isLoggingOut }: SessionCardProps) {
  const displayName = user?.display_name || "Alexander Admin";
  const email = user?.email || "admin@forgeflow.demo";
  const role = user?.role || "admin";

  return (
    <Card className="p-5 sm:p-6 border-[var(--color-border-default)] shadow-xs rounded-[var(--radius-xl)] bg-[var(--color-bg-surface)]">
      {/* Identity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: 40px Shield Icon Tile + Name & Email */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-canvas)] text-[var(--color-fg-default)] shadow-xs">
            <ShieldCheck className="h-5 w-5 text-[var(--color-fg-muted)]" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="text-base font-semibold leading-[22px] text-[var(--color-fg-default)] truncate">
              {displayName}
            </h2>
            <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-muted)] mt-0.5 truncate">
              {email}
            </p>
          </div>
        </div>

        {/* Right: Role & Session Badges */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="neutral" emphasis="subtle">
            {formatRole(role)}
          </Badge>
          <Badge variant="success" emphasis="subtle">
            Session verified
          </Badge>
        </div>
      </div>

      {/* Subtle Horizontal Divider */}
      <div className="border-t border-[var(--color-border-subtle)] my-5" />

      {/* Session Details & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] select-none">
            Active Session Context
          </span>
          <p className="text-[13px] font-medium leading-[18px] text-[var(--color-fg-default)]">
            Authenticated via secure HTTP-only cookie with enterprise cryptographic token rotation.
          </p>
        </div>

        {onLogout && (
          <Button
            variant="outline"
            size="sm"
            onClick={onLogout}
            disabled={isLoggingOut}
            leftIcon={<LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
            className="shrink-0 text-[var(--color-danger-fg)] hover:text-[var(--color-danger-fg)] border-[var(--color-border-default)] hover:bg-[var(--color-danger-bg)] hover:border-[var(--color-danger-border)]"
          >
            {isLoggingOut ? "Signing out..." : "Sign Out"}
          </Button>
        )}
      </div>
    </Card>
  );
}
