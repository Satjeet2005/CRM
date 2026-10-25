import * as React from "react";
import { getInitials } from "@/lib/formatters/formatters";
import { cn } from "@/lib/utils";

export interface InitialsAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string | null | undefined;
  size?: "sm" | "md" | "lg";
}

export function InitialsAvatar({
  name,
  size = "md",
  className,
  ...props
}: InitialsAvatarProps) {
  const sizeClasses = {
    sm: "h-7 w-7 text-xs",
    md: "h-9 w-9 text-sm",
    lg: "h-11 w-11 text-base",
  };

  const initials = getInitials(name);
  const isAriaHidden = props["aria-hidden"] === true || props["aria-hidden"] === "true";

  return (
    <div
      role={isAriaHidden ? undefined : "img"}
      aria-label={isAriaHidden ? undefined : (name || "User Avatar")}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full bg-[var(--color-primary-50)] font-medium text-[var(--color-primary-700)] border border-[var(--color-primary-500)]/20",
        sizeClasses[size],
        className
      )}
      {...props}
    >
      <span aria-hidden="true">{initials}</span>
    </div>
  );
}
