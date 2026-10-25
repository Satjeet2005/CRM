"use client";

import * as React from "react";
import { useAuth } from "@/hooks/use-auth";
import { OrganizationCard } from "@/features/settings/components/organization-card";

export default function OrganizationSettingsPage() {
  const { organization, user } = useAuth();

  return (
    <div className="space-y-6">
      <OrganizationCard organization={organization || user?.organization} />
    </div>
  );
}
