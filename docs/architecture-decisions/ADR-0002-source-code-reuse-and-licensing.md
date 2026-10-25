# ADR-0002: Upstream Source Code Reuse Boundaries and Licensing

## Status
Accepted

## Context
ForgeFlow unifies capabilities from two existing open-source / prototype repositories authored by Satjeet2005:
1. `RFQ-line-item-normalizer` (`https://github.com/Satjeet2005/RFQ-line-item-normalizer`) at commit `a91341e2bf2bb479b8accadbf03a70b4a627adbb` (branch `main`).
2. `model-change-review-lab` (`https://github.com/Satjeet2005/model-change-review-lab`) at commit `ecba766fb4db9edbd217449777fe06fa0d2f5ef5` (branch `master`).

Both source repositories were inspected and their existing tests verified:
- `RFQ-line-item-normalizer`: 125 backend unit tests pass in 0.15s. Pure Python normalizer and unit converter in `backend/domain/`.
- `model-change-review-lab`: 41 backend tests pass in 2.76s against Postgres. Implements proposal lifecycle, atomic commits, and revision concurrency.

Neither repository contains an explicit LICENSE file in its root. Both are public GitHub repositories by the project owner.

## Decision
1. **Preserve Upstream Independence**:
   - Both upstream repositories remain completely unmodified and runnable independently. No runtime network calls are made between ForgeFlow and upstream repos.
2. **RFQ Normalization Reuse Scope**:
   - For Phase 3, adapt pure Python normalization and catalog matching from `RFQ-line-item-normalizer/backend/domain/` (`normalizer.py`, `matcher.py`, `units.py`, `split.py`, `types.py`) into `backend/app/domain/rfq/`.
   - Preserve exact determinism, unit compatibility rules, and abstention thresholds. Matching thresholds must not be lowered to falsely inflate automation claims.
3. **Model Change Review Lab Pattern Scope**:
   - Adopt architectural *patterns* (isolated proposals, before/after differences, atomic commit transactions, concurrency checks, audit logs) into `backend/app/domain/proposals/` and `backend/app/domain/quotes/`.
   - Explicitly reject reusing the financial-model spreadsheet calculation formulas as the quote calculator. ForgeFlow uses its own authoritative `Decimal`-based commercial calculation engine.
4. **Attribution & Provenance**:
   - Retain provenance notice acknowledging the source algorithms authored by Satjeet2005.

## Consequences
- Clean reuse boundaries with zero coupling to upstream runtime environments.
- Future agents implementing Phases 3–5 can cleanly port the proven domain modules without architectural rework.
