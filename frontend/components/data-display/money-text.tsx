import * as React from "react";
import { formatMoney } from "@/lib/formatters/formatters";
import { cn } from "@/lib/utils";

export interface MoneyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  amount: number | string | null | undefined;
  currency?: string;
}

export function MoneyText({
  amount,
  currency = "INR",
  className,
  ...props
}: MoneyTextProps) {
  return (
    <span className={cn("tabular-nums font-medium", className)} {...props}>
      {formatMoney(amount, currency)}
    </span>
  );
}
