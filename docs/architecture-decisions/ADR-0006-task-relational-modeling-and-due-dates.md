# ADR-0006: Task Relational Modeling and Due Date Precision

## Status
Accepted

## Context
PRD Section 10.1 specifies relational links for tasks (`account_id`, `opportunity_id`, `quote_id`), while generic phase notes mentioned `related_entity_type` / `related_entity_id`.
In addition, task due date representation must support day-level overdue evaluation in the organization's business timezone (`Asia/Kolkata`).

## Decision
1. **Referential Integrity**: Tasks use explicit foreign keys for implemented entities:
   - `account_id UUID REFERENCES accounts(id) ON DELETE SET NULL`
   - `opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL`
   - Optional `quote_id` foreign key is deferred until Phase 4 when quote tables are introduced.
   - We reject untyped polymorphic string IDs as the sole link because they cannot enforce foreign key integrity in PostgreSQL.
2. **Due Date Precision**: Tasks use `due_date DATE` representing the calendar date by which the task is due.
3. **Overdue Calculation**: Overdue logic compares `due_date` against current calendar date in the organization's timezone (`Asia/Kolkata` for ForgeFlow demo). A task is overdue if `status = 'open'` and `due_date < current_date_in_tz`.

## Consequences
- Clean foreign key referential integrity in PostgreSQL.
- Fast index lookups on `(organization_id, due_date)` and `(organization_id, assignee_user_id, status)`.
- Overdue evaluation is deterministic and daylight-safe.
