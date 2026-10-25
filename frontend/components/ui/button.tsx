import * as React from "react";
import { Button as BaseButton } from "@base-ui/react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] active:bg-[var(--primary-hover)] shadow-xs",
        secondary:
          "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-muted)] shadow-2xs",
        outline:
          "bg-transparent text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-muted)]",
        ghost:
          "bg-transparent text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
        destructive:
          "bg-[var(--destructive)] text-white hover:opacity-90 shadow-xs",
        link: "text-[var(--primary)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-[var(--radius-sm)]",
        md: "h-10 px-4 text-sm rounded-[var(--radius-sm)]",
        lg: "h-11 px-6 text-base rounded-[var(--radius-md)]",
        icon: "h-10 w-10 rounded-[var(--radius-sm)] p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ComponentPropsWithoutRef<"button">,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <BaseButton
        ref={ref}
        className={cn(buttonVariants({ variant, size, className }))}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {children}
      </BaseButton>
    );
  }
);
Button.displayName = "Button";
