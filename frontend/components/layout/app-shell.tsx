"use client";

import * as React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Sheet, SheetPopup } from "@/components/sakani/sheet";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user, permissions, role, logout, isLoggingOut } = useAuth();
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("forgeflow_sidebar_collapsed") === "true";
    }
    return false;
  });
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("forgeflow_sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-[var(--color-bg-canvas)] text-[var(--color-fg-default)]">
      {/* Desktop Persistent Sidebar */}
      <div className="hidden md:flex shrink-0">
        <AppSidebar
          collapsed={collapsed}
          onToggleCollapse={handleToggleCollapse}
          userPermissions={permissions}
          userRole={role}
        />
      </div>

      {/* Mobile Drawer Navigation (Slide-over with Backdrop Scrim) */}
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetPopup
          side="left"
          aria-label="Navigation drawer"
          className="p-0 w-[248px] bg-[var(--color-bg-surface)] border-r border-[var(--color-border-subtle)]"
        >
          <AppSidebar
            collapsed={false}
            onToggleCollapse={() => setMobileNavOpen(false)}
            userPermissions={permissions}
            userRole={role}
          />
        </SheetPopup>
      </Sheet>

      {/* Main Content Viewport */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <AppHeader
          user={user}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onLogout={logout}
          isLoggingOut={isLoggingOut}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
