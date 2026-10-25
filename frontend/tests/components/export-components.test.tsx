import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { QuoteExportSection } from "@/features/quotes/components/quote-export-section";
import type { QuoteDetail } from "@/features/quotes/api";

const mockDeliveries = [
  {
    id: "del-1",
    quote_id: "q-1",
    revision_id: "rev-1",
    export_type: "pdf",
    sha256_hash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822c60c9ddc120614569",
    recipient_email: "client@example.com",
    watermarked: false,
    exported_by_user_id: "u-1",
    exported_by_name: "Sarah Sales",
    created_at: "2026-10-24T12:00:00Z",
  },
];

vi.mock("@/features/quotes/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/quotes/api")>();
  return {
    ...actual,
    useQuoteDeliveries: () => ({
      data: mockDeliveries,
      isLoading: false,
    }),
  };
});

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("QuoteExportSection Component Tests", () => {
  const baseQuote: QuoteDetail = {
    id: "q-1",
    organization_id: "org-1",
    quote_number: "QT-2026-0001",
    account_id: "acc-1",
    account_name: "Apex Heavy Engineering",
    opportunity_id: "opp-1",
    opportunity_name: "Valve Retrofit",
    status: "draft",
    created_by: "u-1",
    created_by_name: "Sarah Sales",
    version: 1,
    notes: null,
    valid_until: "2026-11-24",
    payment_terms: "Net 30",
    delivery_terms: "Ex-Works",
    requires_manager_approval: true,
    approval_triggers: [],
    created_at: "2026-10-24T10:00:00Z",
    updated_at: "2026-10-24T10:00:00Z",
    current_revision: null,
  };

  it("disables final export buttons and shows draft warning when quote is in draft status", () => {
    renderWithClient(<QuoteExportSection quote={{ ...baseQuote, status: "draft" }} />);

    const pdfBtn = screen.getByTestId("export-pdf-button");
    const csvBtn = screen.getByTestId("export-csv-button");
    const previewBtn = screen.getByTestId("export-preview-button");

    expect(pdfBtn).toBeDisabled();
    expect(csvBtn).toBeDisabled();
    expect(previewBtn).toBeEnabled();

    expect(
      screen.getByText(/Final customer exports locked \(DRAFT\)/i)
    ).toBeInTheDocument();
  });

  it("enables final export buttons when quote is in approved status", () => {
    renderWithClient(<QuoteExportSection quote={{ ...baseQuote, status: "approved" }} />);

    const pdfBtn = screen.getByTestId("export-pdf-button");
    const csvBtn = screen.getByTestId("export-csv-button");

    expect(pdfBtn).toBeEnabled();
    expect(csvBtn).toBeEnabled();

    // Draft preview button is omitted for already approved quotes
    expect(screen.queryByTestId("export-preview-button")).not.toBeInTheDocument();
    expect(
      screen.getByText(/Quotation is approved and certified for commercial customer release/i)
    ).toBeInTheDocument();
  });

  it("renders export delivery history and fingerprint copy action", () => {
    renderWithClient(<QuoteExportSection quote={{ ...baseQuote, status: "approved" }} />);

    expect(screen.getByText("Export History & Integrity Verification")).toBeInTheDocument();
    expect(screen.getByText("Sarah Sales")).toBeInTheDocument();
    expect(screen.getByText("CLEAN FINAL")).toBeInTheDocument();
    expect(screen.getByText("9f86d08188...")).toBeInTheDocument();
  });
});
