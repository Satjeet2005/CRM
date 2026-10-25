# ForgeFlow Demo Script & Operational Walkthrough

## 1. Overview

ForgeFlow ships with a built-in synthetic demo mode enabled via `DEMO_MODE=true`. All demo accounts and operational data represent realistic Indian industrial manufacturing scenarios (valves, piping, flanges, pumps, and structural equipment) with Indian Rupee (₹) currency formatting.

---

## 2. Synthetic Demo Credentials

| Role | Email | Password | Primary Purpose |
|---|---|---|---|
| **Sales Representative** | `sales@forgeflow.demo` | `ForgeFlowDemo!2026` | Create CRM entities, manage pipeline, check tasks, draft quotes. Cannot see internal product costs. |
| **Sales Manager** | `manager@forgeflow.demo` | `ForgeFlowDemo!2026` | Oversee team pipeline, approve deals, monitor attention queue. |
| **Catalog Reviewer** | `catalog@forgeflow.demo` | `ForgeFlowDemo!2026` | Authoritative catalog manager. Views and manages unit costs, SKUs, and aliases. |
| **Administrator** | `admin@forgeflow.demo` | `ForgeFlowDemo!2026` | Tenant administrative control, full permissions, and user governance. |

---

## 3. Phase 2 Interactive Demo Walkthrough (3–4 Minutes)

### Step 1: Login as Sales Representative & View Operational Metrics (45s)
1. Navigate to `http://localhost:3000/login`.
2. Click **"Use demo account"** and select **"Sales Representative (Sarah Sales)"**.
3. Notice email and password populate automatically. Click **"Sign In"**.
4. Land on `/app/dashboard`.
5. Observe **real aggregate metrics**:
   - Total Open Pipeline: ~₹7.82M across 8 active opportunities.
   - Weighted Pipeline: ~₹3.13M.
   - Stage distribution showing counts from `lead` through `negotiation`, `closed_won`, and `closed_lost`.
   - **Attention Required Queue**: highlights overdue action items and stale opportunities with direct navigation links.
   - Future Phase 4 metric cards ("Quote Conversion Rate", "Average Quote Value") gracefully display `Phase 4: Quotation Engine` badges without fake metrics.

### Step 2: Manage Accounts & Primary Contact Demotion (45s)
1. Click **"Accounts"** in the sidebar navigation (`/app/accounts`).
2. Search for `"Apex"` using the search bar; observe real-time filtering to **"Apex Heavy Engineering Ltd."**.
3. Click **"New Account"**. Fill in:
   - Account Name: `Kalyani Heavy Forgings Pvt Ltd`
   - Industry: `Forging & Precision Machining`
   - Billing Email: `procurement@kalyaniforgings.example`
4. Click **"Create Account"**. Observe success toast notification and instant appearance in the table.
5. Navigate to **"Contacts"** (`/app/contacts`). Observe contacts organized by account, with primary badges clearly indicated. Adding a new primary contact atomically demotes the previous primary without conflicts.

### Step 3: Interactive Opportunities Pipeline & Stage Advancement (45s)
1. Click **"Opportunities"** (`/app/opportunities`).
2. Notice the interactive **Pipeline Board View** organizing deals into columns: `Lead`, `Qualified`, `Solutioning`, `Proposal`, `Negotiation`, `Closed Won`, and `Closed Lost`.
3. Toggle to the **Table View** via the view switcher button.
4. Click **"Advance"** on an opportunity in `lead` stage to move it forward to `qualified`.
5. Observe stage updated with optimistic concurrency protection.
6. Notice terminal stages enforce strict business validation:
   - Attempting to close as lost requires entering a mandatory closed reason.

### Step 4: Tasks Action Queue & Instant Undo (30s)
1. Click **"Tasks"** in the sidebar (`/app/tasks`).
2. View tasks categorized by priority (Urgent, High, Medium, Low) and overdue status badges.
3. Click the circle icon on an open task to mark it completed.
4. Observe the toast notification with an interactive **"Undo"** action.
5. Click **"Undo"** (or click the checkmark to reopen); observe the task immediately return to `open` status with updated versioning.

### Step 5: Verify Role-Based Unit Cost Isolation (30s)
1. While logged in as **Sales Representative**, navigate to **"Catalog"** (`/app/catalog`).
2. Examine the product table:
   - Notice the **"Unit Cost"** column displays `—` (hidden).
   - "New Product" creation action is not visible (read-only for sales rep).
3. Open user menu in the top right, click **"Sign out"**.
4. Back at `/login`, click "Use demo account" and select **"Catalog Reviewer (Carl Catalog)"**. Click **"Sign In"**.
5. Navigate to **"Catalog"** (`/app/catalog`):
   - Notice the **"Unit Cost"** column now clearly displays actual confidential cost figures (e.g., `₹1,850.00`).
   - The **"New Product"** button is active and functional.
   - This proves backend data isolation is enforced at the API layer, not just hidden by CSS.

---

## 4. Phase 3 Interactive Demo Walkthrough (3 Minutes)

### Step 1: Ingest Customer RFQ via Ingestion Wizard (60s)
1. Log in as **Sales Representative** (`sales@forgeflow.demo`).
2. Click **"RFQs"** in the sidebar navigation (`/app/rfqs`).
3. Notice seeded demo RFQs displaying real operational statuses:
   - `Turnaround Piping & Valves Batch A` (Needs Review, 8 lines)
   - `Boiler Overhaul Valve Requisition` (Quoted, 4 lines)
   - `Emergency Plant Shutdown Requisition` (Blocking, 4 lines with invalid/missing specs)
4. Click **"Import RFQ"** (`/app/rfqs/new`).
5. Select Target Account **"Apex Heavy Engineering Ltd."** and Opportunity **"High-Pressure Valve Assembly Package"**.
6. Set Title: `Turnaround Valves Phase 3 Sample` and Reference: `PO-REQ-2026-DEMO`.
7. Upload `backend/fixtures/demo-rfq-ambiguous.csv` via the file drag-and-drop zone.
8. Observe immediate fast preview: detected 6 rows, UTF-8 validity, and recommended canonical column mappings.
9. Click **"Continue to Mapping"**. Verify canonical field assignments (`description`, `quantity`, `unit`, `sku`).
10. Click **"Ingest & Open Review Studio"**.

### Step 2: Review Studio, Deterministic Matching & Bulk Actions (60s)
1. Land on the signature **RFQ Review Studio** (`/app/rfqs/{rfq_id}`).
2. Observe sticky summary cards: Total Lines, Resolved / Matched, Exact Matches, Needs Review, Invalid Lines.
3. Observe match status badges:
   - Green `Exact Match` for lines matching catalog SKUs or normalized aliases with 100% confidence.
   - Amber `Needs Review` for ambiguous lines requiring human judgment.
4. Click **"Bulk Accept Exact"**. Notice all high-confidence/exact matches resolve in a single transaction.
5. Filter by **"Needs Review"** tab to view remaining ambiguous line items.
6. Click **"Review"** on an ambiguous line item (e.g. `1/2" Gate Valve Screwed`).
7. Observe slide-over **Inspector Sheet**:
   - Parsed Quantity & Dimensions (e.g. `DN 15mm`, `PN 16`).
   - System Candidate Suggestions ranked by similarity score with positive match explanations and risk flags.
   - Click **"Accept"** on the top suggestion, or use the **Manual Product Lookup** to search and assign any catalog item.

### Step 3: Quotation Gate & Export (30s)
1. In Review Studio, click **"Export CSV"**. A sanitized RFC 4180 CSV downloads with formula injection neutralization applied.
2. Observe the **"Create Quotation"** button:
   - While any line remains unresolved or invalid, the button is disabled. Hovering reveals specific blocking diagnostics.
   - Once all lines are resolved (`accepted` or `unmatched`), the button activates in bright emerald.
3. Click **"Create Quotation"**. Notice the RFQ atomically converts to `quoted` status, creating a commercial draft quote header linked to the opportunity.

---

## 5. Phase 4 Interactive Demo Walkthrough (3 Minutes)

### Step 1: Browse Quotations & Commercial Governance Badges (30s)
1. Log in as **Sales Representative** (`sales@forgeflow.demo`).
2. From the Overview Dashboard, observe the active card **"Quotations & Pricing"** displaying active quote counts and click it (or navigate to `/app/quotes`).
3. View the Quotations table:
   - `QT-2026-0001` (Turnaround package for Bharat Petrochem): Grand Total ₹658,086.00 with amber **"Requires Approval"** badge.
   - `QT-2026-0002` (Fasteners package for Apex Heavy Engineering): Grand Total ₹6,336.60 with green **"Standard Limits"** badge.

### Step 2: Interactive Quote Builder, Live Arithmetic & Policy Triggers (60s)
1. Click on quote `QT-2026-0001` to open the **Quote Builder** (`/app/quotes/{quoteId}`).
2. Verify **Role-Based Cost Masking**:
   - As Sales Rep, observe the table contains columns: `Product / Description`, `Qty`, `Price (INR)`, `Disc %`, `Tax %`, and `Line Total`.
   - The confidential `Cost (INR)` column is completely absent.
   - The `Internal Margin Intelligence` box is hidden.
3. Observe the **Commercial Policy Governance** panel on the right:
   - Highlights **"Approval Required"** with two distinct triggered rules:
     - `High-Value Quotation Threshold`: Grand total ₹658,086.00 exceeds ₹500,000.00 self-approval limit.
     - `Excessive Line Discount`: Line #1 (Brass Ball Valve) discount of 8.00% exceeds 5.00% self-approval limit.
   - Clear Phase 5 seam note indicating proposal submission and approval queue workflows activate in Phase 5.
4. Edit draft lines:
   - Change Line 2 (GI Pipe) quantity from `50` to `60`.
   - Notice the amber **"Unsaved Edits"** badge appears instantly.
   - Summary totals (Gross Subtotal, Total Discount, Taxable Amount, GST, and Grand Total) recalculate live in the UI.
5. Click **"Save Draft"**:
   - The authoritative backend recalculates and stores the updated draft revision with optimistic concurrency protection.
   - A success toast confirms the save.

### Step 3: Authoritative Calculation Trace Inspector (45s)
1. In the header bar, click **"Calculation Inspector"**.
2. A slide-over sheet opens titled **"Authoritative Calculation Trace"**:
   - Displays calculator engine version (`forgeflow-quote-calculator/1.0.0`), revision number (`#1`), and input fingerprint hash.
   - Ordered arithmetic nodes display exact formula operations:
     - `quantity × unit_price` with `ROUND_HALF_UP (2 decimals)`
     - `gross_amount × discount_percent`
     - `taxable_amount × tax_rate_percent`
     - Line totals and quote-level sums.
3. Close the sheet.

### Step 4: Customer Presentation Preview Mode (30s)
1. In the header bar, click **"Customer Preview Mode"**.
2. Observe the interface switches to a client-presentation layout:
   - Prominent **"DRAFT — NOT APPROVED COMMERCIAL PROPOSAL"** banner displayed.
   - Edit input fields switch to clean typography.
   - Internal Commercial Policy Governance box is masked.
   - Action buttons (Save, Discard) are hidden to prevent accidental edits during client meetings.
3. Click **"Exit Customer Preview"** to return to drafting mode.

### Step 5: Admin Dual-Track Cost & Margin Intelligence (30s)
1. Sign out and sign in as **Administrator** (`admin@forgeflow.demo`).
2. Navigate to `/app/quotes` and open `QT-2026-0001`.
3. Observe dual-track commercial intelligence enabled for authorized leadership:
   - **"Cost (INR)"** column is now visible in the line items table (e.g. `₹2,000.00` unit cost with `15.0% mgn`).
   - **"Internal Margin Intelligence"** card displays `Total Base Cost` (`₹431,000.00`) and `Projected Gross Margin` (`22.65%`).
   - Open **"Calculation Inspector"**: internal cost and profit calculation trace nodes (`Line #1 Internal Line Cost`, `Line #1 Internal Gross Profit`) are fully auditable.

### Step 6: Review-Before-Write Change Proposals & Maker-Checker Approvals (90s)
1. Sign in as **Sales Rep** (`sales@forgeflow.demo`).
2. Navigate to `/app/quotes` and select `QT-2026-0002`.
3. In the "Change Proposals" card, click **"New Proposal"**:
   - Provide a title (e.g. `Volume Discount Revision`) and commercial justification.
   - Stage an allowlisted operation (e.g. decrease unit price or adjust line quantity).
   - Click **"Create Change Proposal"**.
4. In the proposal detail sheet, observe the before/after financial diff:
   - Notice the amber **"Maker-Checker Security Invariant"** banner explaining that authors cannot approve their own submissions.
   - Click **"Submit for Review"**.
5. Switch to **Sales Manager** (`manager@forgeflow.demo`):
   - Navigate to `/app/approvals` to review the Managerial Approval Queue.
   - Open the submitted proposal diff, review margin impact and commercial policy status.
   - Click **"Approve Proposal"**.
   - Click **"Commit to Revision"**: observe the atomic allocation of Revision $N+1$, update to `current_revision_id`, and permanent audit log entry.

### Step 7: Customer Document Exports, Watermark Governance & Tamper-Evident Ledger (60s)
1. Sign in as **Sales Rep** (`sales@forgeflow.demo`).
2. Navigate to `/app/quotes` and open approved quote `QT-2026-0004`:
   - Scroll down to the **"Customer Document Exports"** card.
   - Observe **"Export Customer PDF"** and **"Export Procurement CSV"** buttons are enabled.
   - Click **"Export Customer PDF"**: observe download of the clean, unwatermarked vector PDF generated with WeasyPrint. Open the file to verify customer-facing terms and total absence of internal costs/margins.
   - Click **"Export Procurement CSV"**: open in a text editor to verify strict RFC 4180 layout and formula injection neutralization prefixes on suspicious cells.
   - In the **"Export History & Integrity Verification"** table below, observe the recorded delivery entry with file size, timestamp, and SHA-256 cryptographic hash.
   - Click the copy button next to the SHA-256 hash to copy the tamper-evident fingerprint to clipboard.
3. Verify **Draft Watermark Governance**:
   - Navigate back to `/app/quotes` and open draft quote `QT-2026-0001`.
   - Scroll down to the **"Customer Document Exports"** card:
     - Observe **"Export Customer PDF"** and **"Export Procurement CSV"** are disabled with the lock message: *"Customer-ready unwatermarked PDF and CSV exports require managerial approval."*
     - Click **"Download Watermarked Draft Preview"**: download and inspect the preview PDF; verify the prominent diagonal watermark: **"DRAFT — NOT APPROVED COMMERCIAL PROPOSAL"** stamped across every page.
