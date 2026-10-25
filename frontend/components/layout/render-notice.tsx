"use client";

import * as React from "react";
import { toast } from "sonner";
import { Server, X } from "lucide-react";

export function RenderNotice() {
  const [isDismissed, setIsDismissed] = React.useState(false);

  React.useEffect(() => {
    // Show a clean toast on initial load explaining the free tier spin-up
    const hasSeenToast = sessionStorage.getItem("forgeflow_render_toast_shown");
    if (!hasSeenToast) {
      sessionStorage.setItem("forgeflow_render_toast_shown", "true");

      const timer = setTimeout(() => {
        toast("Free Tier Spin-up", {
          description:
            "Hosted on Render free tier. Free instances hibernate when idle — please allow 50–60s if initial requests take a moment to wake up.",
          duration: 10000,
          icon: <Server className="h-4 w-4 text-[var(--color-fg-muted)] shrink-0" />,
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, []);

  if (isDismissed) return null;

  return (
    <div
      role="region"
      aria-label="Server status notice"
      className="bg-[var(--color-bg-canvas)] border-b border-[var(--color-border-subtle)] text-[var(--color-fg-muted)] px-3 py-1.5 transition-colors select-none text-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-1.5 w-1.5 rounded-full bg-[var(--color-primary-500)] shrink-0" aria-hidden="true" />
          <p className="truncate text-xs font-normal">
            <span className="font-semibold text-[var(--color-fg-default)]">
              Free Tier Notice:
            </span>{" "}
            Deployed on Render free tier. If the service was idle, please allow 50–60s for the instance to boot up.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-[var(--radius-xs)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-bg-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] shrink-0 transition-colors cursor-pointer"
          aria-label="Dismiss deployment notice"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
