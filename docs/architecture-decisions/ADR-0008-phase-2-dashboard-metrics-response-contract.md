# ADR-0008: Phase 2 Dashboard Metrics Response Contract

## Status
Accepted

## Context
PRD Section 8 defines operational dashboard metrics including open opportunities, open pipeline value, overdue tasks, quotes awaiting approval, and RFQ review lines requiring review.
In Phase 2, quote and RFQ tables do not exist yet (Phases 3 and 4). Returning `0` for quotes awaiting approval or RFQ review lines would falsely indicate zero outstanding work in those domains.

## Decision
1. **Stable Response Contract**: The `GET /api/v1/dashboard/summary` endpoint provides stable schema fields for all future metrics:
   - `open_opportunities_count: int` (real query)
   - `open_pipeline_value: Decimal` (real query)
   - `overdue_tasks_count: int` (real query)
   - `stage_distribution: list[StageDistributionItem]` (real query)
   - `quotes_awaiting_approval: Optional[int] = None`
   - `open_rfq_review_lines: Optional[int] = None`
   - `quotes_availability: str = "available_phase_4"`
   - `rfq_availability: str = "available_phase_3"`
2. **Frontend Presentation**: The UI renders a dedicated "Upcoming Workflow" badge ("Available in Quotations phase" / "Available in RFQ phase") rather than a misleading zero count.

## Consequences
- Maintains backward-compatible API schema for future phases.
- Accurately conveys workflow availability to users.
