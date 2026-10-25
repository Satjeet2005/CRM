"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsNav } from "@/features/settings/components/settings-nav";

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const pathname = usePathname();

  const getHeaderMeta = () => {
    if (pathname.startsWith("/app/settings/organization")) {
      return {
        title: "Organization",
        description: "Tenant identification, operational currency, and workspace timezone.",
        breadcrumbs: [
          { label: "Workspace", href: "/app/dashboard" },
          { label: "Settings", href: "/app/settings" },
          { label: "Organization" },
        ],
      };
    }

    if (pathname.startsWith("/app/settings/security")) {
      return {
        title: "Security & Access",
        description: "Active session identity, role assignment, and effective workspace permissions.",
        breadcrumbs: [
          { label: "Workspace", href: "/app/dashboard" },
          { label: "Settings", href: "/app/settings" },
          { label: "Security & Access" },
        ],
      };
    }

    return {
      title: "Settings",
      description: "Manage your organization, security, and workspace configuration.",
      breadcrumbs: [
        { label: "Workspace", href: "/app/dashboard" },
        { label: "Settings" },
      ],
    };
  };

  const { title, description, breadcrumbs } = getHeaderMeta();

  return (
    <PageContainer>
      <PageHeader
        title={title}
        description={description}
        breadcrumbs={breadcrumbs}
      />

      <div className="mt-6 flex flex-col md:flex-row gap-6 items-start">
        {/* Settings Subnavigation */}
        <SettingsNav />

        {/* Content Region */}
        <div className="flex-1 min-w-0 w-full space-y-6">
          {children}
        </div>
      </div>
    </PageContainer>
  );
}
