"use client";

import * as React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { Sheet, SheetPopup } from "@/components/sakani/sheet";
import { useAuth } from "@/hooks/use-auth";

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
          className="p-0 w-[248px] max-w-[85vw] bg-[var(--color-bg-canvas)] border-r border-[var(--color-border-subtle)]"
        >
          <AppSidebar
            collapsed={false}
            onToggleCollapse={() => setMobileNavOpen(false)}
            userPermissions={permissions}
            userRole={role}
            onNavigate={() => setMobileNavOpen(false)}
          />
        </SheetPopup>
      </Sheet>

      {/* Main Workspace Viewport */}
      <div className="flex flex-1 flex-col min-w-0 bg-[var(--color-bg-canvas)]">
        <AppHeader
          user={user}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onLogout={logout}
          isLoggingOut={isLoggingOut}
        />
        {/* Signature Sakani Page Container with 28px top corner radii */}
        <main className="flex-1 overflow-y-auto bg-[var(--color-bg-surface)] rounded-t-[var(--radius-3xl)] shadow-sm border-t border-[var(--color-border-subtle)]/60 transition-all min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
