#!/usr/bin/env bash
set -euo pipefail

# ForgeFlow Database Backup Script
# Creates a consistent, timestamped PostgreSQL custom-format dump (-Fc)
# and validates archive integrity.

BACKUP_DIR="${BACKUP_DIR:-$(pwd)/backups}"
TIMESTAMP=$(date -u +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="forgeflow_backup_${TIMESTAMP}.dump"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

mkdir -p "${BACKUP_DIR}"

POSTGRES_USER="${POSTGRES_USER:-forgeflow}"
POSTGRES_DB="${POSTGRES_DB:-forgeflow}"
CONTAINER_NAME="forgeflow-db"

echo "================================================================"
echo "          FORGEFLOW DATABASE BACKUP UTILITY                     "
echo "================================================================"
echo "Source Database: ${POSTGRES_DB}"
echo "Target File:     ${BACKUP_PATH}"
echo "Format:          PostgreSQL Custom Archive (-Fc)"
echo "----------------------------------------------------------------"

# Check if docker container is running
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "[*] Creating database dump via Docker container '${CONTAINER_NAME}'..."
    docker exec "${CONTAINER_NAME}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc > "${BACKUP_PATH}"
else
    echo "[*] Docker container not detected; executing local pg_dump..."
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -Fc -f "${BACKUP_PATH}"
fi

# Set strict permissions (owner read/write only)
chmod 600 "${BACKUP_PATH}"

# Verify archive integrity
echo "[*] Verifying archive integrity with pg_restore --list..."
if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker exec -i "${CONTAINER_NAME}" pg_restore --list < "${BACKUP_PATH}" > /dev/null
else
    pg_restore --list "${BACKUP_PATH}" > /dev/null
fi

FILE_SIZE=$(wc -c < "${BACKUP_PATH}" | tr -d ' ')
SHA256_HASH=$(sha256sum "${BACKUP_PATH}" | awk '{print $1}')

echo "----------------------------------------------------------------"
echo "BACKUP SUCCESSFUL:"
echo "  Path:        ${BACKUP_PATH}"
echo "  Size:        ${FILE_SIZE} bytes"
echo "  SHA-256:     ${SHA256_HASH}"
echo "  Integrity:   VALIDATED (TOC verified)"
echo "================================================================"
