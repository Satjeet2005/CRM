"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, Moon, Sun, Settings } from "lucide-react";
import { Button } from "@/components/sakani/button";
import { Badge } from "@/components/sakani/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InitialsAvatar } from "@/components/data-display/initials-avatar";
import { getInitials } from "@/lib/formatters/formatters";
import { useTheme } from "@/hooks/use-theme";
import type { AuthUser } from "@/hooks/use-auth";

interface AppHeaderProps {
  user: AuthUser | null;
  onOpenMobileNav: () => void;
  onLogout: () => void;
  isLoggingOut?: boolean;
}

export function AppHeader({
  user,
  onOpenMobileNav,
  onLogout,
  isLoggingOut = false,
}: AppHeaderProps) {
  const router = useRouter();
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full items-center justify-between bg-[var(--color-bg-canvas)] px-4 sm:px-6">
      {/* Mobile nav toggle */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)]"
          onClick={onOpenMobileNav}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Organization Name Badge */}
        {user?.organization && (
          <div className="hidden sm:flex items-center gap-2 rounded-[var(--radius-full)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] px-3 py-1 text-xs font-medium text-[var(--color-fg-default)] shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-[var(--color-success-500)]" aria-hidden="true" />
            <span className="truncate max-w-[180px]">{user.organization.name}</span>
          </div>
        )}

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
          title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)]"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 text-[var(--color-warning-500)]" aria-hidden="true" />
          ) : (
            <Moon className="h-4 w-4 text-[var(--color-fg-muted)]" aria-hidden="true" />
          )}
        </Button>

        {/* User Avatar & Dropdown Menu */}
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => {
                const initials = getInitials(user.display_name);
                return (
                  <button
                    {...props}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-[var(--color-border-focus)] cursor-pointer transition-transform active:scale-95"
                    aria-label={`${initials} - ${user.display_name} profile menu`}
                  >
                    <InitialsAvatar aria-hidden="true" name={user.display_name} size="sm" />
                  </button>
                );
              }}
            />
            <DropdownMenuContent align="end" className="w-56 p-1 border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] shadow-md rounded-[var(--radius-lg)]">
              <div className="p-3">
                <p className="text-sm font-semibold text-[var(--color-fg-default)] truncate">
                  {user.display_name}
                </p>
                <p className="text-xs text-[var(--color-fg-muted)] truncate">{user.email}</p>
                <div className="mt-2">
                  <Badge variant="accent" emphasis="subtle">
                    {user.role}
                  </Badge>
                </div>
              </div>
              <DropdownMenuSeparator className="bg-[var(--color-border-subtle)]" />
              <DropdownMenuItem
                className="text-xs text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)] cursor-pointer min-h-[36px]"
                onClick={() => router.push("/app/settings")}
              >
                <div className="flex items-center gap-2">
                  <Settings className="h-3.5 w-3.5 text-[var(--color-fg-muted)]" aria-hidden="true" />
                  <span>Settings</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[var(--color-border-subtle)]" />
              <DropdownMenuItem
                className="text-xs text-[var(--color-danger-700)] dark:text-[var(--color-danger-400)] focus:bg-[var(--color-danger-50)] dark:focus:bg-[var(--color-neutral-800)] cursor-pointer min-h-[36px]"
                onClick={onLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Signing out..." : "Sign Out"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
