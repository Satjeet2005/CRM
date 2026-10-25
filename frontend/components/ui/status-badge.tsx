import * as React from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, Clock, type LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-[var(--radius-full)] text-xs font-medium border select-none",
  {
    variants: {
      variant: {
        success:
          "bg-[var(--success-soft)] text-[var(--success)] border-[var(--success)]/20",
        warning:
          "bg-[var(--warning-soft)] text-[var(--warning)] border-[var(--warning)]/20",
        destructive:
          "bg-[var(--destructive-soft)] text-[var(--destructive)] border-[var(--destructive)]/20",
        info: "bg-[var(--primary-soft)] text-[var(--info)] border-[var(--info)]/20",
        neutral:
          "bg-[var(--surface-muted)] text-[var(--muted-foreground)] border-[var(--border)]",
      },
      size: {
        sm: "text-[11px] px-2 py-0.5",
        md: "text-xs px-2.5 py-0.5",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "md",
    },
  }
);

export type StatusVariant = "success" | "warning" | "destructive" | "info" | "neutral";

const DEFAULT_ICONS: Record<StatusVariant, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: XCircle,
  info: Info,
  neutral: Clock,
};

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  label: string;
  variant?: StatusVariant;
  icon?: LucideIcon;
}

export function StatusBadge({
  label,
  variant = "neutral",
  size,
  icon: CustomIcon,
  className,
  ...props
}: StatusBadgeProps) {
  const IconComponent = CustomIcon || DEFAULT_ICONS[variant || "neutral"];

  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      <IconComponent className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
