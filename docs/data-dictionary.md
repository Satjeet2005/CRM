# ForgeFlow Data Dictionary

## 1. Core Foundation Entities (Phase 0 / Phase 1)

### `organizations`
Represents an operating business tenant within ForgeFlow.
- `id` (UUID, PK): Unique organization identifier.
- `name` (VARCHAR(255), NOT NULL): Business name (e.g. `ForgeFlow Demo Manufacturing`).
- `slug` (VARCHAR(100), UNIQUE, NOT NULL): URL-safe identifier (e.g. `forgeflow-demo`).
- `currency` (VARCHAR(10), NOT NULL, DEFAULT 'INR'): Primary reporting currency.
- `timezone` (VARCHAR(50), NOT NULL, DEFAULT 'Asia/Kolkata'): Default display timezone.
- `settings_json` (JSONB, NOT NULL, DEFAULT '{}'): Policy configurations (e.g., approval thresholds).
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.

### `users`
System user identities.
- `id` (UUID, PK): Unique user identifier.
- `email_normalized` (VARCHAR(255), UNIQUE, NOT NULL): Lowercased, trimmed email address.
- `display_name` (VARCHAR(255), NOT NULL): Human-readable name.
- `password_hash` (VARCHAR(255), NOT NULL): Argon2id password hash.
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Active status flag.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.

### `organization_memberships`
Links a user to an organization with a specific role.
- `id` (UUID, PK): Membership identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Associated organization.
- `user_id` (UUID, FK -> users.id, NOT NULL): Associated user.
- `role` (VARCHAR(50), NOT NULL): Role enum (`sales_rep`, `sales_manager`, `catalog_manager`, `admin`).
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Membership status.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC membership timestamp.
- **Constraints**: UNIQUE (`organization_id`, `user_id`).

### `sessions`
Opaque server-persisted user authentication sessions.
- `id` (UUID, PK): Session record identifier.
- `user_id` (UUID, FK -> users.id, NOT NULL): Authenticated user.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Current tenant context.
- `token_hash` (VARCHAR(64), UNIQUE, NOT NULL): SHA-256 digest of the opaque cookie token.
- `created_at` (TIMESTAMPTZ, NOT NULL): Session creation timestamp.
- `last_seen_at` (TIMESTAMPTZ, NOT NULL): Timestamp of most recent authenticated request.
- `expires_at` (TIMESTAMPTZ, NOT NULL): Absolute expiration timestamp (created_at + 12h).
- `revoked_at` (TIMESTAMPTZ, NULL): Revocation timestamp if explicitly logged out or invalidated.
- `ip_address` (VARCHAR(45), NULL): Client IP address for security auditing.
- `user_agent` (TEXT, NULL): Client browser user agent string.

---

## 2. Core CRM Entities (Phase 2)

### `accounts`
Customer and prospect enterprise entities.
- `id` (UUID, PK): Unique account identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `name` (VARCHAR(255), NOT NULL): Legal / trade account name.
- `legal_name` (VARCHAR(255), NULL): Official corporate registered name.
- `account_type` (VARCHAR(50), NOT NULL, DEFAULT 'customer'): Enum (`prospect`, `customer`, `vendor`, `partner`).
- `industry` (VARCHAR(100), NULL): Industrial sector (e.g. `Heavy Machinery`, `Oil & Gas`).
- `website` (VARCHAR(255), NULL): Organization web address.
- `phone` (VARCHAR(50), NULL): General switchboard phone number.
- `billing_email` (VARCHAR(255), NULL): Invoicing contact email.
- `billing_address_json` (JSONB, NOT NULL, DEFAULT '{}'): Structured billing address (`street`, `city`, `state`, `postal_code`, `country`).
- `shipping_address_json` (JSONB, NOT NULL, DEFAULT '{}'): Structured delivery address.
- `assigned_rep_user_id` (UUID, FK -> users.id, NULL): Account executive / primary sales rep owner.
- `status` (VARCHAR(50), NOT NULL, DEFAULT 'active'): State enum (`active`, `inactive`, `archived`).
- `custom_fields_json` (JSONB, NOT NULL, DEFAULT '{}'): Extensible tenant attributes.
- `created_by` (UUID, FK -> users.id, NULL): User who registered the account.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic locking version integer.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes**: `ix_accounts_organization_id`, `ix_accounts_name`, `ix_accounts_assigned_rep`.

### `contacts`
Individual buyer or technical points of contact linked to accounts.
- `id` (UUID, PK): Unique contact identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `account_id` (UUID, FK -> accounts.id, NOT NULL): Associated customer enterprise.
- `first_name` (VARCHAR(100), NOT NULL): First name.
- `last_name` (VARCHAR(100), NOT NULL): Last name.
- `job_title` (VARCHAR(150), NULL): Functional role or technical title.
- `email` (VARCHAR(255), NOT NULL): Contact work email.
- `phone` (VARCHAR(50), NULL): Direct phone line / mobile.
- `is_primary` (BOOLEAN, NOT NULL, DEFAULT FALSE): Primary account contact flag.
- `notes` (TEXT, NULL): Internal technical or commercial notes.
- `status` (VARCHAR(50), NOT NULL, DEFAULT 'active'): State enum (`active`, `inactive`, `archived`).
- `created_by` (UUID, FK -> users.id, NULL): User who created the contact.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic concurrency version counter.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - `ix_contacts_organization_id`, `ix_contacts_account_id`, `ix_contacts_email`.
  - Partial Unique Index: `uq_contacts_account_primary` on `(account_id) WHERE (is_primary = true)`.

### `opportunities`
Commercial sales deals tracking pipeline stage progression and revenue potential.
- `id` (UUID, PK): Unique opportunity identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `account_id` (UUID, FK -> accounts.id, NOT NULL): Target customer account.
- `primary_contact_id` (UUID, FK -> contacts.id, NULL): Primary buyer contact for deal.
- `assigned_rep_user_id` (UUID, FK -> users.id, NULL): Sales representative managing the deal.
- `name` (VARCHAR(255), NOT NULL): Opportunity title.
- `description` (TEXT, NULL): Operational and engineering scope summary.
- `stage` (VARCHAR(50), NOT NULL, DEFAULT 'lead'): Strict pipeline stage enum:
  - `lead`, `qualified`, `solutioning`, `proposal`, `negotiation`, `closed_won`, `closed_lost`.
- `estimated_value` (NUMERIC(14, 2), NOT NULL, DEFAULT 0.00): Deal value in tenant currency.
- `currency` (VARCHAR(10), NOT NULL, DEFAULT 'INR'): Deal currency code.
- `probability_percent` (INTEGER, NOT NULL, DEFAULT 10): 0–100 probability weighting.
- `expected_close_date` (DATE, NULL): Projected contract execution date.
- `actual_close_date` (DATE, NULL): Recorded closing date (required for terminal stages).
- `closed_reason` (TEXT, NULL): Win justification or required loss reason.
- `created_by` (UUID, FK -> users.id, NULL): Creator user identifier.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic locking version.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - `ix_opportunities_organization_id`, `ix_opportunities_account_id`, `ix_opportunities_stage`, `ix_opportunities_assigned_rep`.
  - Check constraint: `ck_opp_probability` enforcing `probability_percent BETWEEN 0 AND 100`.

### `tasks`
Operational action items and follow-ups assigned to team members.
- `id` (UUID, PK): Unique task identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `account_id` (UUID, FK -> accounts.id, NULL): Linked customer account.
- `opportunity_id` (UUID, FK -> opportunities.id, NULL): Linked sales opportunity.
- `assigned_to_user_id` (UUID, FK -> users.id, NULL): Task assignee.
- `title` (VARCHAR(255), NOT NULL): Task headline.
- `description` (TEXT, NULL): Detailed instructions or context.
- `due_date` (DATE, NULL): Calendar deadline.
- `priority` (VARCHAR(20), NOT NULL, DEFAULT 'medium'): Priority level (`low`, `medium`, `high`, `urgent`).
- `status` (VARCHAR(20), NOT NULL, DEFAULT 'open'): Completion status (`open`, `completed`, `cancelled`).
- `completed_at` (TIMESTAMPTZ, NULL): UTC completion timestamp.
- `created_by` (UUID, FK -> users.id, NULL): Task creator.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic locking version.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes**: `ix_tasks_organization_id`, `ix_tasks_assigned_to`, `ix_tasks_status_due_date`, `ix_tasks_account_id`, `ix_tasks_opportunity_id`.

### `activities`
Immutable chronological audit and operational timeline events across CRM entities.
- `id` (UUID, PK): Unique activity record identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `actor_user_id` (UUID, FK -> users.id, NULL): User performing the action.
- `entity_type` (VARCHAR(50), NOT NULL): Target entity (`account`, `contact`, `opportunity`, `task`, `catalog_product`).
- `entity_id` (UUID, NOT NULL): Target entity primary key identifier.
- `event_type` (VARCHAR(50), NOT NULL): Event code (`account_created`, `stage_change`, `task_completed`, etc.).
- `summary` (VARCHAR(500), NOT NULL): Human-readable event description.
- `metadata_json` (JSONB, NOT NULL, DEFAULT '{}'): Contextual snapshot (e.g., old/new stage values).
- `occurred_at` (TIMESTAMPTZ, NOT NULL): UTC event occurrence timestamp.
- **Indexes**: `ix_activities_organization_id`, `ix_activities_entity`, `ix_activities_occurred_at`.

---

## 3. Industrial Catalog Entities (Phase 2)

### `catalog_products`
Authoritative master catalog of industrial equipment, components, and standard units.
- `id` (UUID, PK): Product identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `sku` (VARCHAR(100), NOT NULL): Internal stock keeping unit code (e.g. `VALV-BAL-SS-001`).
- `name` (VARCHAR(255), NOT NULL): Standard product name.
- `description` (TEXT, NULL): Engineering and material specifications.
- `category` (VARCHAR(100), NOT NULL): Industrial taxonomy category (`Valves`, `Pipes`, `Flanges`, `Pumps`, `Instrumentation`, `Fasteners`).
- `manufacturer` (VARCHAR(150), NULL): Primary manufacturer / brand.
- `manufacturer_part_number` (VARCHAR(150), NULL): MPN.
- `base_unit` (VARCHAR(20), NOT NULL, DEFAULT 'each'): Standard measurement unit (`each`, `meter`, `set`, `kg`).
- `sell_price` (NUMERIC(14, 2), NOT NULL): Base customer list selling price.
- `unit_cost` (NUMERIC(14, 2), NULL): Internal production/procurement cost. **Restricted field**: masked / hidden via RBAC from `sales_rep` and `sales_manager`; only visible to `catalog_manager` and `admin`.
- `tax_rate_percent` (NUMERIC(5, 2), NOT NULL, DEFAULT 18.00): Standard GST/tax rate.
- `stock_status` (VARCHAR(50), NOT NULL, DEFAULT 'in_stock'): Inventory status (`in_stock`, `low_stock`, `out_of_stock`, `discontinued`).
- `attributes_json` (JSONB, NOT NULL, DEFAULT '{}'): Industrial attributes (`dn_mm`, `pn_rating`, `material`, `flange_standard`, etc.).
- `is_active` (BOOLEAN, NOT NULL, DEFAULT TRUE): Active in catalog.
- `created_by` (UUID, FK -> users.id, NULL): User who introduced item.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic locking version.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - `ix_catalog_products_org_sku`: UNIQUE (`organization_id`, `sku`).
  - `ix_catalog_products_category`, `ix_catalog_products_name`.

### `catalog_aliases`
Deterministic mappings connecting customer RFQ colloquial terms to catalog products.
- `id` (UUID, PK): Alias identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `product_id` (UUID, FK -> catalog_products.id, NOT NULL): Target catalog product.
- `alias_text` (VARCHAR(255), NOT NULL): Raw customer phrasing (e.g. `2" SS Ball Valve 150#`).
- `normalized_alias` (VARCHAR(255), NOT NULL): Canonical lowercased whitespace-normalized string.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- **Indexes & Constraints**:
  - `ix_catalog_aliases_org_norm`: UNIQUE (`organization_id`, `normalized_alias`).
  - `ix_catalog_aliases_product`: `(product_id)`.

---

## 4. RFQ Ingestion, Matching & Review Studio Entities (Phase 3)

### `rfqs`
Master RFQ container representing an ingested customer requisition spreadsheet.
- `id` (UUID, PK): Unique RFQ identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `account_id` (UUID, FK -> accounts.id, NOT NULL): Target customer account.
- `opportunity_id` (UUID, FK -> opportunities.id, NOT NULL): Target CRM opportunity.
- `rfq_number` (VARCHAR(64), NOT NULL): Deterministic human-readable RFQ identifier (e.g. `RFQ-2026-0001`).
- `title` (VARCHAR(255), NOT NULL): Requisition title.
- `customer_reference` (VARCHAR(100), NULL): Customer PO or tender reference number.
- `status` (VARCHAR(50), NOT NULL, DEFAULT 'draft'): Lifecycle status (`draft`, `in_review`, `quoted`, `archived`).
- `source_filename` (VARCHAR(255), NOT NULL): Uploaded file name.
- `content_hash` (VARCHAR(64), NOT NULL): SHA-256 hash of raw CSV content for duplicate file prevention.
- `total_lines` (INTEGER, NOT NULL, DEFAULT 0): Total count of parsed line items.
- `matched_lines` (INTEGER, NOT NULL, DEFAULT 0): Lines with confirmed product resolution (`accepted` or `exact_match`).
- `created_by` (UUID, FK -> users.id, NOT NULL): Creator user identifier.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic locking concurrency version.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - `ix_rfqs_org_rfq_number`: UNIQUE (`organization_id`, `rfq_number`).
  - `ix_rfqs_org_content_hash`: `(organization_id`, `content_hash)`.
  - `ix_rfqs_opportunity_id`, `ix_rfqs_account_id`.

### `rfq_import_jobs`
Audit record of the raw file ingestion job and detected column mappings.
- `id` (UUID, PK): Job identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `rfq_id` (UUID, FK -> rfqs.id, NOT NULL): Target RFQ.
- `filename` (VARCHAR(255), NOT NULL): Stored filename.
- `file_size_bytes` (INTEGER, NOT NULL): File size in bytes (capped at 5 MiB).
- `row_count` (INTEGER, NOT NULL): Total parsed CSV rows (capped at 500).
- `header_mapping_json` (JSONB, NOT NULL, DEFAULT '{}'): Persisted mapping from raw headers to canonical fields.
- `diagnostics_json` (JSONB, NOT NULL, DEFAULT '{}'): Diagnostic warnings or errors.
- `status` (VARCHAR(50), NOT NULL, DEFAULT 'completed'): Job status (`completed`, `failed`).
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC timestamp.

### `rfq_lines`
Individual line item extracted from the imported customer spreadsheet.
- `id` (UUID, PK): Line item identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `rfq_id` (UUID, FK -> rfqs.id, NOT NULL): Associated RFQ container.
- `source_row_number` (INTEGER, NOT NULL): Original 1-indexed row number in the CSV.
- `raw_description` (TEXT, NOT NULL): Customer item description text.
- `raw_quantity` (VARCHAR(100), NULL): Unparsed raw quantity string.
- `raw_unit` (VARCHAR(50), NULL): Unparsed raw unit string.
- `raw_data_json` (JSONB, NOT NULL, DEFAULT '{}'): Complete raw CSV row payload.
- `normalized_description` (TEXT, NULL): Lowercased, cleaned, token-normalized description.
- `normalized_quantity` (NUMERIC(14, 4), NULL): Parsed decimal quantity.
- `normalized_unit` (VARCHAR(50), NULL): Standardized unit of measure (`mtr`, `nos`, `pcs`, `set`, `kg`, etc.).
- `dimensions_json` (JSONB, NOT NULL, DEFAULT '{}'): Extracted industrial dimensions (`dn_mm`, `pn_bar`, `od_mm`, `sch`, etc.).
- `normalization_status` (VARCHAR(50), NOT NULL, DEFAULT 'valid'): Normalization validity (`valid`, `warning`, `invalid`).
- `match_status` (VARCHAR(50), NOT NULL, DEFAULT 'unmatched'): Current matching status (`exact_match`, `high_confidence`, `ambiguous`, `unmatched`, `matched`).
- `selected_product_id` (UUID, FK -> catalog_products.id, NULL): Confirmed resolved catalog product.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Line optimistic locking version.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes**: `ix_rfq_lines_rfq_id`, `ix_rfq_lines_match_status`.

### `rfq_match_candidates`
Ranked catalog product candidate matches computed for an RFQ line.
- `id` (UUID, PK): Match candidate identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `rfq_line_id` (UUID, FK -> rfq_lines.id, NOT NULL): Associated RFQ line.
- `product_id` (UUID, FK -> catalog_products.id, NOT NULL): Matched catalog product.
- `rank` (INTEGER, NOT NULL): Candidate rank order (1 = highest score).
- `similarity_score` (NUMERIC(5, 4), NOT NULL): Normalized similarity score (0.0000 to 1.0000).
- `match_method` (VARCHAR(50), NOT NULL): Algorithm used (`exact_alias`, `exact_sku`, `token_similarity`, `fuzzy`).
- `is_disqualified` (BOOLEAN, NOT NULL, DEFAULT FALSE): Disqualification flag.
- `reasons_json` (JSONB, NOT NULL, DEFAULT '[]'): Human-readable positive match explanations.
- `flags_json` (JSONB, NOT NULL, DEFAULT '[]'): Warning or risk flags.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC timestamp.

### `rfq_line_decisions`
Audit trail of human review actions taken on an RFQ line.
- `id` (UUID, PK): Decision record identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `rfq_line_id` (UUID, FK -> rfq_lines.id, NOT NULL): Target RFQ line.
- `decision_type` (VARCHAR(50), NOT NULL): Review action (`accept_suggestion`, `choose_product`, `mark_unmatched`, `revert`).
- `product_id` (UUID, FK -> catalog_products.id, NULL): Associated catalog product.
- `candidate_id` (UUID, FK -> rfq_match_candidates.id, NULL): Associated candidate if accepted from suggestions.
- `decided_by` (UUID, FK -> users.id, NOT NULL): User who executed the decision.
- `notes` (TEXT, NULL): Reviewer remarks or audit notes.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC timestamp.

---

## 4. Quotation Engine Entities (Phase 4)

### `quotes`
Commercial quotation container tracking state, versioning, customer terms, and linkage to RFQs and CRM Opportunities.
- `id` (UUID, PK): Unique quotation identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Multi-tenant boundary.
- `rfq_id` (UUID, FK -> rfqs.id, NULL): Originating RFQ container if converted from normalizer.
- `opportunity_id` (UUID, FK -> opportunities.id, NOT NULL): Associated CRM deal.
- `account_id` (UUID, FK -> accounts.id, NOT NULL): Target enterprise customer account.
- `quote_number` (VARCHAR(64), NOT NULL): Unique human-readable quote code (e.g. `QT-2026-0001`).
- `status` (VARCHAR(50), NOT NULL, DEFAULT 'draft'): Commercial lifecycle status (`draft`, `in_review`, `approved`, `sent`, `accepted`, `rejected`, `superseded`).
- `created_by` (UUID, FK -> users.id, NOT NULL): Authoring sales representative or admin.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic locking concurrency version.
- `notes` (TEXT, NULL): Internal notes and commercial conditions.
- `current_revision_id` (UUID, FK -> quote_revisions.id, NULL): Pointer to the active, authoritative revision.
- `valid_until` (TIMESTAMPTZ, NULL): Commercial offer expiration date.
- `payment_terms` (VARCHAR(255), NOT NULL, DEFAULT 'Net 30'): Agreed commercial payment terms.
- `delivery_terms` (VARCHAR(255), NOT NULL, DEFAULT 'Ex-Works'): Shipping and incoterms delivery condition.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - UNIQUE (`organization_id`, `quote_number`)
  - `ix_quotes_organization_id`, `ix_quotes_rfq_id`, `ix_quotes_opportunity_id`, `ix_quotes_account_id`, `ix_quotes_status`

### `quote_revisions`
Immutable / version-tracked commercial revisions preserving calculation traces, arithmetic snapshots, and policy evaluations.
- `id` (UUID, PK): Unique revision identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `quote_id` (UUID, FK -> quotes.id, NOT NULL): Parent quotation record.
- `revision_number` (INTEGER, NOT NULL): Sequential revision number (1, 2, 3...).
- `parent_revision_id` (UUID, FK -> quote_revisions.id, NULL): Preceding revision from which this revision branched or was updated.
- `currency` (VARCHAR(10), NOT NULL, DEFAULT 'INR'): Pricing currency code.
- `snapshot_json` (JSONB, NOT NULL, DEFAULT '{}'): Snapshot of account, opportunity, customer terms, and metadata at time of revision creation.
- `calculation_snapshot_json` (JSONB, NOT NULL, DEFAULT '{}'): Authoritative snapshot of line calculations, subtotal, total discount, taxable subtotal, total taxes, grand total, cost/margin totals, trace graph, and policy evaluation result.
- `calculator_version` (VARCHAR(64), NOT NULL, DEFAULT 'forgeflow-quote-calculator/1.0.0'): Semver string of the pure-Python calculation engine that computed the totals.
- `input_fingerprint` (VARCHAR(64), NOT NULL): Deterministic SHA-256 hash of canonical sorted input lines (detects stale calculations and verifies calculation immutability).
- `created_by` (UUID, FK -> users.id, NOT NULL): User who initiated or committed the revision.
- `commit_reason` (TEXT, NULL): Changelog summary or reason for revision (e.g. "Draft updated and recalculated").
- `is_committed` (BOOLEAN, NOT NULL, DEFAULT FALSE): True when formally submitted or approved; false for mutable draft working revisions.
- `version` (INTEGER, NOT NULL, DEFAULT 1): Optimistic concurrency integer.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - UNIQUE (`quote_id`, `revision_number`)
  - `ix_quote_revisions_organization_id`, `ix_quote_revisions_quote_id`

### `quote_revision_lines`
Individual itemized line items belonging to a specific revision with explicit Decimal arithmetic fields and server-side RBAC cost masking.
- `id` (UUID, PK): Unique line item identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `revision_id` (UUID, FK -> quote_revisions.id, NOT NULL): Associated quote revision.
- `line_order` (INTEGER, NOT NULL): 1-indexed display and calculation ordering.
- `rfq_line_id` (UUID, FK -> rfq_lines.id, NULL): Traceability link to original RFQ line if converted.
- `catalog_product_id` (UUID, FK -> catalog_products.id, NULL): Associated catalog product item.
- `sku` (VARCHAR(100), NOT NULL): Product SKU code.
- `product_name` (VARCHAR(255), NOT NULL): Commercial item name.
- `description` (TEXT, NOT NULL): Detailed specifications or delivery scope.
- `unit` (VARCHAR(50), NOT NULL, DEFAULT 'nos'): Commercial unit of measure (`nos`, `mtr`, `roll`, `kg`, etc.).
- `quantity` (NUMERIC(14, 4), NOT NULL): Decimal quantity with 4 decimal places.
- `unit_price` (NUMERIC(14, 2), NOT NULL): Customer unit selling price.
- `discount_percent` (NUMERIC(5, 2), NOT NULL, DEFAULT 0.00): Line discount percentage (0.00% to 100.00%).
- `tax_rate_percent` (NUMERIC(5, 2), NOT NULL, DEFAULT 18.00): Applicable tax / GST percentage rate.
- `unit_cost` (NUMERIC(14, 2), NULL): Internal unit base cost (server-side RBAC masked for unauthorized roles).
- `gross_amount` (NUMERIC(14, 2), NOT NULL): Rounded `quantity * unit_price` (ROUND_HALF_UP).
- `discount_amount` (NUMERIC(14, 2), NOT NULL): Rounded `gross_amount * discount_percent / 100`.
- `taxable_amount` (NUMERIC(14, 2), NOT NULL): Exact `gross_amount - discount_amount`.
- `tax_amount` (NUMERIC(14, 2), NOT NULL): Rounded `taxable_amount * tax_rate_percent / 100`.
- `line_total` (NUMERIC(14, 2), NOT NULL): Exact `taxable_amount + tax_amount`.
- `line_cost` (NUMERIC(14, 2), NULL): Internal line cost (server-side RBAC masked).
- `line_gross_profit` (NUMERIC(14, 2), NULL): `taxable_amount - line_cost` (server-side RBAC masked).
- `margin_percent` (NUMERIC(5, 2), NULL): Profit margin percentage (server-side RBAC masked).
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - UNIQUE (`revision_id`, `line_order`)
  - `ix_quote_revision_lines_organization_id`, `ix_quote_revision_lines_revision_id`

---

## 5. Phase 5 Proposal & Governance Entities

### `quote_change_proposals`
Isolated review-before-write change proposals against committed quotation revisions. Proposals never mutate active quotes or revisions until reviewed, approved, and atomically committed.
- `id` (UUID, PK): Unique change proposal identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `quote_id` (UUID, FK -> quotes.id, NOT NULL): Target quotation.
- `proposal_number` (VARCHAR(64), NOT NULL): Deterministic human-readable proposal identifier (`PROP-{quote_number}-{seq}`).
- `base_revision_id` (UUID, FK -> quote_revisions.id, NOT NULL): Target revision against which changes are staged and diffed.
- `base_version` (INTEGER, NOT NULL): Base revision number for optimistic concurrency detection.
- `title` (VARCHAR(255), NOT NULL): Descriptive proposal title.
- `proposer_reason` (TEXT, NOT NULL): Mandatory commercial justification rationale.
- `status` (VARCHAR(32), NOT NULL, DEFAULT 'draft'): Proposal lifecycle state (`draft`, `pending_review`, `approved`, `committed`, `rejected`, `cancelled`, `stale`).
- `proposed_changes_json` (JSONB, NOT NULL, DEFAULT '[]'): Ordered sequence of allowlisted mutation operations.
- `diff_summary_json` (JSONB, NOT NULL, DEFAULT '{}'): Authoritative server-side diff including modified, added, removed, and unchanged lines with financial impact deltas.
- `base_snapshot_json` (JSONB, NOT NULL, DEFAULT '{}'): Frozen snapshot of base revision lines, terms, and calculations at proposal creation.
- `proposed_calc_snapshot_json` (JSONB, NOT NULL, DEFAULT '{}'): Authoritative snapshot of proposed calculations and policy evaluation results.
- `policy_snapshot_json` (JSONB, NOT NULL, DEFAULT '{}'): Evaluation of commercial governance policies against proposed numbers.
- `proposer_user_id` (UUID, FK -> users.id, NOT NULL): User who authored the change proposal.
- `reviewer_user_id` (UUID, FK -> users.id, NULL): Manager or administrator who reviewed the proposal.
- `reviewer_comment` (TEXT, NULL): Mandatory rejection comment or optional approval note.
- `decided_at` (TIMESTAMPTZ, NULL): UTC timestamp of approval/rejection decision.
- `committed_revision_id` (UUID, FK -> quote_revisions.id, NULL): Revision $N+1$ created upon atomic commit.
- `committed_at` (TIMESTAMPTZ, NULL): UTC timestamp of commit.
- `idempotency_key` (VARCHAR(128), NULL): Client-provided token preventing duplicate proposal submissions.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC creation timestamp.
- `updated_at` (TIMESTAMPTZ, NOT NULL): UTC modification timestamp.
- **Indexes & Constraints**:
  - `ix_quote_proposals_org_id`, `ix_quote_proposals_quote_id`, `ix_quote_proposals_status`, `ix_quote_proposals_proposer`.

### `quote_approval_decisions`
Immutable maker-checker governance audit log recording every approval or rejection decision.
- `id` (UUID, PK): Unique decision identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `quote_id` (UUID, FK -> quotes.id, NOT NULL): Associated quotation.
- `proposal_id` (UUID, FK -> quote_change_proposals.id, NULL): Proposal reviewed (or null if initial quote approval).
- `base_revision_id` (UUID, FK -> quote_revisions.id, NOT NULL): Base revision evaluated.
- `base_version` (INTEGER, NOT NULL): Base version number.
- `reviewer_user_id` (UUID, FK -> users.id, NOT NULL): Authenticated manager/admin decider.
- `decision` (VARCHAR(32), NOT NULL): Outcome enum (`approved`, `rejected`).
- `decision_comment` (TEXT, NULL): Recorded comment or reason.
- `policy_snapshot_json` (JSONB, NOT NULL, DEFAULT '{}'): Frozen policy evaluation at moment of decision.
- `created_revision_id` (UUID, FK -> quote_revisions.id, NULL): Resulting committed revision ID if applicable.
- `decided_at` (TIMESTAMPTZ, NOT NULL): UTC decision timestamp.
- `idempotency_key` (VARCHAR(128), NULL): Client idempotency token.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC audit creation timestamp.
- **Indexes**:
  - `ix_quote_approvals_org_id`, `ix_quote_approvals_quote_id`, `ix_quote_approvals_proposal_id`.

---

## 6. Phase 6 Customer Exports & Audit Ledger

### `export_events`
Audit log recording every export attempt (PDF, CSV, preview, successful, or failed) for forensic compliance and security monitoring.
- `id` (UUID, PK): Unique export attempt event identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Multi-tenant boundary.
- `quote_id` (UUID, FK -> quotes.id, NOT NULL): Target quotation.
- `revision_id` (UUID, FK -> quote_revisions.id, NULL): Associated revision snapshot if resolved.
- `export_format` (VARCHAR(16), NOT NULL): Format requested (`pdf` or `csv`).
- `is_watermarked` (BOOLEAN, NOT NULL, DEFAULT FALSE): Whether the document received draft watermarking.
- `user_id` (UUID, FK -> users.id, NOT NULL): Actor who triggered the export.
- `success` (BOOLEAN, NOT NULL): Whether the generation completed successfully.
- `failure_reason` (TEXT, NULL): Reason for abort or failure if applicable.
- `content_sha256` (VARCHAR(64), NULL): SHA-256 hexadecimal hash of generated payload.
- `byte_size` (INTEGER, NULL): Size of output document in bytes.
- `template_version` (VARCHAR(64), NULL): Template and renderer version stamp (e.g. `forgeflow-quotation-template/1.0.0`).
- `metadata_json` (JSONB, NOT NULL, DEFAULT '{}'): Diagnostic runtime context (client IP, user agent, etc.).
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC timestamp of export event.
- **Indexes**:
  - `ix_export_events_org_id`, `ix_export_events_quote_id`, `ix_export_events_user_id`.

### `quote_customer_deliveries`
Tamper-evident delivery registry recording authoritative, approved documents rendered for customer distribution.
- `id` (UUID, PK): Unique customer delivery record identifier.
- `organization_id` (UUID, FK -> organizations.id, NOT NULL): Tenant boundary.
- `quote_id` (UUID, FK -> quotes.id, NOT NULL): Target quotation.
- `revision_id` (UUID, FK -> quote_revisions.id, NOT NULL): Committed revision bound to deliverable.
- `export_format` (VARCHAR(16), NOT NULL): Deliverable format (`pdf` or `csv`).
- `filename` (VARCHAR(255), NOT NULL): Normalized RFC 6266 filename delivered to client.
- `content_sha256` (VARCHAR(64), NOT NULL): Cryptographic byte-level SHA-256 fingerprint.
- `byte_size` (INTEGER, NOT NULL): Byte count of delivered file.
- `template_version` (VARCHAR(64), NOT NULL): Template identifier (e.g. `forgeflow-quotation-template/1.0.0`).
- `delivered_by_user_id` (UUID, FK -> users.id, NOT NULL): User who generated/delivered the document.
- `recipient_email` (VARCHAR(255), NULL): Customer email if distributed.
- `metadata_json` (JSONB, NOT NULL, DEFAULT '{}'): Delivery context metadata.
- `created_at` (TIMESTAMPTZ, NOT NULL): UTC delivery timestamp.
- **Indexes & Constraints**:
  - `ix_quote_customer_deliveries_org_id`, `ix_quote_customer_deliveries_quote_id`, `ix_quote_customer_deliveries_sha256`.

---

## 7. Planned Future Entities (Phase 7)

- System integration, operational auditing, and production log telemetry.
