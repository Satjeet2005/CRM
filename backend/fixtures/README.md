# ForgeFlow Phase 3 Demo RFQ Fixture

This directory provides representative deterministic fixture files for demonstrating RFQ ingestion, deterministic normalization, persisted catalog matching, and the Line-Item Review Studio.

## Files

1. `demo-rfq-ambiguous.csv`: Realistic 11-line industrial customer RFQ CSV demonstrating the four primary matching and normalization outcomes:
   - **Exact Matches (Deterministic Auto-Acceptable)**:
     - Line 1: `GI Pipe 15mm Class A` -> Matches `PIPE-001` (similarity 1.0, exact match).
     - Line 2: `GI Pipe 25mm Class B` -> Matches `PIPE-006` (similarity 1.0, exact match).
     - Line 4: `MS Hex Bolt M16x60 Grade 8.8` -> Matches `BOLT-018` (similarity 1.0, exact match).
     - Line 5: `Brass Ball Valve Screwed 25mm` -> Matches `VALV-003` (similarity 1.0, exact match).
     - Line 6: `Brass Gate Valve Screwed 50mm` -> Matches `VALV-008` (similarity 1.0, exact match).
     - Line 7: `GI 90 Degree Elbow 25mm Class B` -> Matches `FITT-003` (similarity 1.0, exact match).
     - Line 8: `Welding Electrodes MS E6013 3.15mm` -> Matches `CONS-001` (similarity 1.0, exact match).
     - Line 9: `PTFE Thread Seal Tape 12mm x 10m` -> Matches `CONS-003` (similarity 1.0, exact match).
   - **Ambiguous Tie (Needs Review Studio Selection)**:
     - Line 3: `MS Hex Bolt M12x50` -> Omits grade specification; triggers near-tie between `BOLT-007` (Grade 4.6) and `BOLT-016` (Grade 8.8) with reason `SPEC_MISSING_DISCRIMINATOR`. Requires sales engineer review.
   - **Invalid Normalization (Conversion Blocker)**:
     - Line 10: `Special Titanium Alloy Impeller Casing` with quantity `-5` -> Normalization failure `NEGATIVE_QUANTITY`. Blocks RFQ quotation conversion gate with explicit diagnostic until corrected or marked unmatched.
   - **Unmatched (Custom/Exotic Line)**:
     - Line 11: `Unknown Exotic Ceramic Seal Ring 45mm` -> Low similarity below `T_PROPOSE=0.60`. System abstains safely and flags as `unmatched`.

2. `catalog_standard_industrial.json`: Complete snapshot of standard industrial catalog items (80+ items covering pipes, fasteners, valves, fittings, and consumables) adapted from the upstream deterministic normalization benchmark repository (`Satjeet2005/RFQ-line-item-normalizer`).
