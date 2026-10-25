# ADR-0005: CRM Opportunity and Catalog Field Naming Reconciliation

## Status
Accepted

## Context
In `PRD.md`, Section 6.3 and Section 6.5 use explicit domain field names (`estimated_value`, `base_unit`, `sell_price`, `unit_cost`, `tax_rate_percent`, `attributes_json`), whereas Section 10.1 logical schema table includes alternate designations (such as `expected_amount`, `default_unit_price`, `specification_json`).
Duplicate fields would confuse API clients, lead to data desynchronization, and create dual sources of truth.

## Decision
1. **Opportunity Amount**: We standardize on `estimated_value NUMERIC(14,2)` non-negative as the canonical database, model, and API field name. We reject `expected_amount`.
2. **Catalog Product Fields**: We standardize on:
   - `base_unit VARCHAR(20)` (e.g. `ea`, `m`, `kg`, etc.)
   - `sell_price NUMERIC(14,4)` non-negative
   - `unit_cost NUMERIC(14,4)` non-negative (internal only, protected from unauthorized roles)
   - `tax_rate_percent NUMERIC(5,2)` constrained to 0–100, default 18.00
   - `attributes_json JSONB` for structured attributes (size, material, pressure class, etc.)
   We reject `default_unit_price`, `default_tax_rate`, and `specification_json` as duplicate column names.
3. **Internal Cost Protection**: `unit_cost` is strictly permission-gated at the Pydantic serialization layer; it is serialized only for `catalog_manager` and `admin`.

## Consequences
- Single, consistent naming across Python models, PostgreSQL schema, Pydantic schemas, and generated TypeScript types.
- High precision financial and quantity handling using PostgreSQL `NUMERIC` and Python `Decimal`.
