"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { SessionCard } from "@/features/settings/components/session-card";
import { PermissionsGrid } from "@/features/settings/components/permissions-grid";

export default function SecuritySettingsPage() {
  const { user, permissions, logout, isLoggingOut } = useAuth();

  return (
    <div className="space-y-6">
      {/* 1. Current Session Identity */}
      <SessionCard
        user={user}
        onLogout={logout}
        isLoggingOut={isLoggingOut}
      />

      {/* 2. Granted Permissions Grid */}
      <PermissionsGrid permissions={permissions || user?.permissions} />
    </div>
  );
}
