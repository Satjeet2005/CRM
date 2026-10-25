"use client";

import * as React from "react";
import { toast } from "sonner";
import { Clock, Info, X } from "lucide-react";

export function RenderNotice() {
  const [isDismissed, setIsDismissed] = React.useState(false);

  React.useEffect(() => {
    // Show a helpful toast on initial load explaining the free tier spin-up
    const hasSeenToast = sessionStorage.getItem("forgeflow_render_toast_shown");
    if (!hasSeenToast) {
      sessionStorage.setItem("forgeflow_render_toast_shown", "true");

      const timer = setTimeout(() => {
        toast.info("Hosted on Render Free Tier", {
          description:
            "If requests feel slow or take a moment, the free web instance spins down during inactivity. Please allow 50–60 seconds to boot up.",
          duration: 12000,
          icon: <Clock className="h-4 w-4 text-[var(--color-primary-500)] shrink-0" />,
        });
      }, 800);

      return () => clearTimeout(timer);
    }
  }, []);

  if (isDismissed) return null;

  return (
    <div
      role="region"
      aria-label="Server status notice"
      className="bg-[var(--color-primary-50)] dark:bg-[var(--color-primary-950)]/40 border-b border-[var(--color-primary-200)] dark:border-[var(--color-primary-800)]/60 text-[var(--color-fg-default)] px-3 py-1.5 transition-colors select-none text-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Info
            className="h-3.5 w-3.5 text-[var(--color-primary-600)] dark:text-[var(--color-primary-400)] shrink-0"
            aria-hidden="true"
          />
          <p className="truncate text-xs font-medium">
            <span className="font-semibold text-[var(--color-primary-700)] dark:text-[var(--color-primary-300)]">
              Free Tier Notice:
            </span>{" "}
            Deployed on Render free instances. If inactive, backend cold start may take 50–60 seconds to boot up.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-[var(--radius-xs)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg-default)] hover:bg-[var(--color-primary-100)] dark:hover:bg-[var(--color-primary-900)]/50 focus-visible:outline-2 focus-visible:outline-[var(--color-primary-500)] shrink-0 transition-colors cursor-pointer"
          aria-label="Dismiss deployment notice"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
