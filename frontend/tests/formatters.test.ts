import { describe, it, expect } from "vitest";
import { formatMoney, getInitials } from "@/lib/formatters/formatters";

describe("Formatters", () => {
  it("formats money with Indian currency notation", () => {
    const formatted = formatMoney(150000, "INR");
    expect(formatted).toContain("1,50,000");
  });

  it("handles null or invalid money values safely", () => {
    expect(formatMoney(null)).toBe("—");
    expect(formatMoney(undefined)).toBe("—");
  });

  it("computes initials correctly for various name shapes", () => {
    expect(getInitials("Sarah Sales")).toBe("SS");
    expect(getInitials("Alex")).toBe("AL");
    expect(getInitials("Marcus Manager Admin")).toBe("MA");
    expect(getInitials("")).toBe("?");
  });
});
