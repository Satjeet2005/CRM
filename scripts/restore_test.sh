#!/usr/bin/env bash
set -euo pipefail

# ForgeFlow Restore Rehearsal & Data Recovery Verification
# Restores a backup file ONLY into an isolated, disposable destination database.
# Strictly refuses to overwrite primary or active test databases.

BACKUP_PATH="${1:-}"
BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"

if [ -z "${BACKUP_PATH}" ]; then
    # Pick latest backup file
    BACKUP_PATH=$(ls -t "${BACKUP_DIR}"/forgeflow_backup_*.dump 2>/dev/null | head -n 1 || true)
fi

if [ -z "${BACKUP_PATH}" ] || [ ! -f "${BACKUP_PATH}" ]; then
    echo "ERROR: No valid backup file found to rehearse. Run 'make backup' first or provide a file path." >&2
    exit 1
fi

REHEARSAL_DB="forgeflow_restore_rehearsal"
POSTGRES_USER="${POSTGRES_USER:-forgeflow}"
CONTAINER_NAME="forgeflow-db"

# Safety invariant guard: strictly forbid overwriting primary or test DB
if [ "${REHEARSAL_DB}" = "forgeflow" ] || [ "${REHEARSAL_DB}" = "forgeflow_test" ]; then
    echo "FATAL SECURITY VIOLATION: Rehearsal database cannot be '${REHEARSAL_DB}'!" >&2
    exit 1
fi

echo "================================================================"
echo "      FORGEFLOW ISOLATED RESTORE REHEARSAL UTILITY              "
echo "================================================================"
echo "Source Backup:       ${BACKUP_PATH}"
echo "Isolated Target DB:  ${REHEARSAL_DB}"
echo "----------------------------------------------------------------"

# Check docker container
USE_DOCKER=false
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    USE_DOCKER=true
fi

run_sql() {
    local sql="$1"
    if [ "$USE_DOCKER" = true ]; then
        docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d postgres -t -A -c "${sql}"
    else
        psql -U "${POSTGRES_USER}" -d postgres -t -A -c "${sql}"
    fi
}

run_rehearsal_sql() {
    local sql="$1"
    if [ "$USE_DOCKER" = true ]; then
        docker exec "${CONTAINER_NAME}" psql -U "${POSTGRES_USER}" -d "${REHEARSAL_DB}" -t -A -c "${sql}"
    else
        psql -U "${POSTGRES_USER}" -d "${REHEARSAL_DB}" -t -A -c "${sql}"
    fi
}

# 1. Clean previous rehearsal DB if exists
echo "[*] Initializing clean isolated rehearsal database '${REHEARSAL_DB}'..."
run_sql "DROP DATABASE IF EXISTS ${REHEARSAL_DB};"
run_sql "CREATE DATABASE ${REHEARSAL_DB};"

# 2. Restore custom dump into isolated DB
echo "[*] Executing pg_restore into isolated destination..."
if [ "$USE_DOCKER" = true ]; then
    docker exec -i "${CONTAINER_NAME}" pg_restore -U "${POSTGRES_USER}" -d "${REHEARSAL_DB}" --no-owner --no-privileges < "${BACKUP_PATH}" || true
else
    pg_restore -U "${POSTGRES_USER}" -d "${REHEARSAL_DB}" --no-owner --no-privileges "${BACKUP_PATH}" || true
fi

# 3. Verify restored data counts
echo "[*] Verifying entity counts in restored database..."

ORG_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM organizations;")
ACC_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM accounts;")
CAT_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM catalog_products;")
RFQ_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM rfqs;")
QUOTE_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM quotes;")
REV_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM quote_revisions;")
PROP_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM quote_change_proposals;")
DELIV_COUNT=$(run_rehearsal_sql "SELECT count(*) FROM quote_customer_deliveries;")
MIGRATION_HEAD=$(run_rehearsal_sql "SELECT version_num FROM alembic_version;")

echo "  - Organizations:           ${ORG_COUNT}"
echo "  - Customer Accounts:       ${ACC_COUNT}"
echo "  - Catalog Products:        ${CAT_COUNT}"
echo "  - RFQs:                    ${RFQ_COUNT}"
echo "  - Quotations:              ${QUOTE_COUNT}"
echo "  - Quote Revisions:         ${REV_COUNT}"
echo "  - Change Proposals:        ${PROP_COUNT}"
echo "  - Customer Deliverables:   ${DELIV_COUNT}"
echo "  - Alembic Migration Head:  ${MIGRATION_HEAD}"

# Invariant check: counts must be non-zero for seeded backup
if [ "${ORG_COUNT}" -eq 0 ] || [ "${ACC_COUNT}" -eq 0 ] || [ "${QUOTE_COUNT}" -eq 0 ]; then
    echo "ERROR: Restored database contains empty essential tables!" >&2
    exit 1
fi

if [ "${MIGRATION_HEAD}" != "0006_customer_exports" ]; then
    echo "ERROR: Restored database migration head '${MIGRATION_HEAD}' does not match expected release head!" >&2
    exit 1
fi

# 4. Cleanup temporary rehearsal database
echo "[*] Cleaning up isolated rehearsal database..."
run_sql "DROP DATABASE IF EXISTS ${REHEARSAL_DB};"

echo "----------------------------------------------------------------"
echo "RESTORE REHEARSAL SUCCESSFUL:"
echo "  Backup archive restored and verified cleanly in isolation."
echo "  Source database remained untouched."
echo "================================================================"
