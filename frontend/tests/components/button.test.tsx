import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "@/components/ui/button";

describe("Button Component", () => {
  it("renders with default primary variant", () => {
    render(<Button>Click me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
  });

  it("disables and marks busy when isLoading is true", () => {
    render(<Button isLoading>Saving</Button>);
    const btn = screen.getByRole("button", { name: /saving/i });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
  });

  it("handles click events when enabled", async () => {
    let clicked = false;
    render(<Button onClick={() => (clicked = true)}>Submit</Button>);
    const btn = screen.getByRole("button", { name: /submit/i });
    await userEvent.click(btn);
    expect(clicked).toBe(true);
  });
});
