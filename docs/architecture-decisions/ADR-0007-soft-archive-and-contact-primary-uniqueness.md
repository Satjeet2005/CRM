# ADR-0007: Soft Archive Semantics and Contact Primary Uniqueness

## Status
Accepted

## Context
B2B operational systems must preserve full auditability and relationship history. Hard deleting accounts, contacts, opportunities, or catalog products destroys historical business context and breaks references.
Furthermore, each account must have at most one primary contact at any given time, resilient against concurrent updates.

## Decision
1. **Soft Archive**:
   - Accounts, contacts, and catalog products feature a `status` column (`active` or `archived`).
   - Hard deletion is prohibited for normal CRUD operations.
   - Archiving an account retains historical records, but excludes the archived entity from selectors for new opportunities and quotes.
2. **Contact Primary Uniqueness**:
   - Enforced in PostgreSQL via a partial unique index:
     `CREATE UNIQUE INDEX uq_contacts_account_primary ON contacts (account_id) WHERE is_primary = true AND status = 'active';`
   - Promoting a contact to primary atomically demotes the previous primary within the same database transaction.

## Consequences
- Preserves referential integrity for quotes, RFQs, tasks, and activities.
- Prevents split-brain primary contact states even during concurrent API calls.
