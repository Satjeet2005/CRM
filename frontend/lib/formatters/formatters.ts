import { format, parseISO } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export function formatMoney(amount: number | string | null | undefined, currency = "INR"): string {
  if (amount === null || amount === undefined || isNaN(Number(amount))) {
    return "—";
  }

  const num = typeof amount === "string" ? parseFloat(amount) : amount;

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function formatDateTime(
  dateInput: string | Date | null | undefined,
  timeZone = "Asia/Kolkata",
  pattern = "dd MMM yyyy, HH:mm"
): string {
  if (!dateInput) return "—";
  try {
    const date = typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
    return formatInTimeZone(date, timeZone, pattern);
  } catch {
    return String(dateInput);
  }
}

export function formatDate(
  dateInput: string | Date | null | undefined,
  pattern = "dd MMM yyyy"
): string {
  if (!dateInput) return "—";
  try {
    const date = typeof dateInput === "string" ? parseISO(dateInput) : dateInput;
    return format(date, pattern);
  } catch {
    return String(dateInput);
  }
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
