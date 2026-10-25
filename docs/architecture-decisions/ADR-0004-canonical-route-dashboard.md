# ADR-0004: Canonical Route Resolution for Application Dashboard

## Status
Accepted

## Context
A route naming discrepancy exists in `PRD.md`:
- The explicit canonical route table in Section 5.3 specifies `/app/dashboard` as the main operational view:
  > `/app/dashboard`: Role-aware KPIs, pipeline, tasks, activity, RFQs and approvals; real API data.
- However, the repository tree illustration in Section 9.3 illustrates `(workspace)/overview/page.tsx`.

## Decision
In accordance with prompt instructions:
1. Treat the explicit route table in PRD Section 5.3 as **canonical**.
2. Implement `/app/dashboard` as the dashboard route.
3. For compatibility, configure Next.js redirects from `/app` and `/app/overview` to `/app/dashboard`.
4. Do not rewrite `PRD.md` to erase or obscure the inconsistency; document the decision in this ADR.

## Consequences
- Single, predictable URL (`/app/dashboard`) for the authenticated home surface.
- Full compliance with both the PRD route table and any external links referencing overview via redirect.
