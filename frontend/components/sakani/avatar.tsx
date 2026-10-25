/**
 * SakaniUI Avatar Primitive for ForgeFlow
 *
 * Sourced from Sakani Design System (https://github.com/samzydd/Sakani-design-system)
 * Copyright (c) 2026 Samuel Okpere
 * Licensed under the MIT License.
 *
 * Adapted for ForgeFlow Enterprise CPQ (Next.js 16 App Router / React 19).
 */

import * as React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl";
  src?: string;
  alt?: string;
  initials?: string;
  icon?: React.ReactNode;
}

const SIZE_STYLES: Record<NonNullable<AvatarProps["size"]>, { container: string; text: string; icon: string }> = {
  sm: { container: "h-7 w-7", text: "text-[11px]", icon: "h-3.5 w-3.5" },
  md: { container: "h-9 w-9", text: "text-xs", icon: "h-4 w-4" },
  lg: { container: "h-11 w-11", text: "text-sm", icon: "h-5 w-5" },
  xl: { container: "h-14 w-14", text: "text-base", icon: "h-6 w-6" },
};

export function Avatar({
  size = "md",
  src,
  alt = "",
  initials,
  icon,
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const sizeConfig = SIZE_STYLES[size] || SIZE_STYLES.md;

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] font-medium text-[var(--color-fg-default)] overflow-hidden select-none",
        sizeConfig.container,
        sizeConfig.text,
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="h-full w-full object-cover"
        />
      ) : initials ? (
        <span aria-hidden="true" className="uppercase font-semibold tracking-wide">
          {initials.slice(0, 2)}
        </span>
      ) : icon ? (
        <span aria-hidden="true">{icon}</span>
      ) : (
        <User className={cn(sizeConfig.icon, "text-[var(--color-fg-muted)]")} aria-hidden="true" />
      )}
    </div>
  );
}
