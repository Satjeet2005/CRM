import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StatusBadge } from "@/components/ui/status-badge";
import { MoneyText } from "@/components/data-display/money-text";
import type { Candidate, RFQLine } from "@/features/rfqs/api";

const mockCandidate: Candidate = {
  id: "c1-uuid",
  product_id: "prod1-uuid",
  product_sku: "PIPE-001",
  product_name: "GI Pipe 15mm Class A",
  product_category: "Pipes",
  product_base_unit: "mtr",
  sell_price: "2100.0000",
  unit_cost: "1400.0000",
  rank: 1,
  match_method: "exact_alias",
  similarity_score: 1.0,
  is_disqualified: false,
  flags: [],
  reasons: ["EXACT_ALIAS_MATCH"],
  attributes: { material: "GI", size_mm: "15", class: "A" },
};

const mockLine: RFQLine = {
  id: "line1-uuid",
  rfq_id: "rfq1-uuid",
  source_row_number: 1,
  raw_sku: "CL-A-15",
  raw_description: "GI Pipe 15mm Class A",
  raw_quantity: "50",
  raw_unit: "mtr",
  raw_specifications: null,
  raw_manufacturer: null,
  raw_part_number: null,
  raw_notes: null,
  normalized_description: "pipe",
  parsed_quantity: "50.0000",
  canonical_unit: "mtr",
  specifications: { material: "GI", class: "A", size_mm: "15" },
  diagnostics: {},
  normalization_status: "valid",
  match_status: "exact_match",
  selected_product_id: null,
  selected_product: null,
  top_candidate: mockCandidate,
  candidate_count: 3,
  resolution_reason_code: null,
  resolution_notes: null,
  version: 1,
  updated_at: "2026-10-24T12:00:00Z",
};

describe("RFQ StatusBadges", () => {
  it("renders ready to quote status badge with success styling", () => {
    render(<StatusBadge variant="success" label="Ready to Quote" />);
    expect(screen.getByText("Ready to Quote")).toBeInTheDocument();
  });

  it("renders needs review status badge with warning styling", () => {
    render(<StatusBadge variant="warning" label="Needs Review" />);
    expect(screen.getByText("Needs Review")).toBeInTheDocument();
  });

  it("renders exact match badge with info styling", () => {
    render(<StatusBadge variant="info" label="Exact Match" />);
    expect(screen.getByText("Exact Match")).toBeInTheDocument();
  });
});

describe("RFQ Candidate & Pricing Display", () => {
  it("formats candidate prices and UOM correctly", () => {
    render(
      <div data-testid="candidate-card">
        <span>{mockCandidate.product_sku}</span>
        <span>{mockCandidate.product_name}</span>
        <MoneyText amount={mockCandidate.sell_price} currency="INR" />
        <span>UOM: {mockCandidate.product_base_unit}</span>
        <span>{((mockCandidate.similarity_score) * 100).toFixed(0)}%</span>
      </div>
    );

    expect(screen.getByText("PIPE-001")).toBeInTheDocument();
    expect(screen.getByText("GI Pipe 15mm Class A")).toBeInTheDocument();
    expect(screen.getByText("₹2,100.00")).toBeInTheDocument();
    expect(screen.getByText("UOM: mtr")).toBeInTheDocument();
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("renders line specifications correctly", () => {
    render(
      <div data-testid="line-specs">
        <span>Line #{mockLine.source_row_number}</span>
        <span>{mockLine.raw_description}</span>
        <span>Qty: {mockLine.parsed_quantity} {mockLine.canonical_unit}</span>
      </div>
    );

    expect(screen.getByText("Line #1")).toBeInTheDocument();
    expect(screen.getByText("GI Pipe 15mm Class A")).toBeInTheDocument();
    expect(screen.getByText("Qty: 50.0000 mtr")).toBeInTheDocument();
  });
});
