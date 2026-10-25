# ForgeFlow Database Backup & Disaster Recovery Guide

This document details the automated backup procedures, integrity verification protocols, isolated disaster recovery rehearsals, and backup retention policies for ForgeFlow.

---

## 1. Backup Architecture & Specification

ForgeFlow uses PostgreSQL's custom archive format (`pg_dump -Fc`), which provides:
1. **Built-in Compression**: Fast, compact storage using zlib compression.
2. **Table-of-Contents (TOC) Integrity**: The archive includes a directory of schema and data tables, enabling `pg_restore --list` validation without restoring data.
3. **Selective Restore Capability**: Enables fine-grained restoration of individual tables, schemas, or complete databases.
4. **Consistency**: Runs in single-transaction snapshot isolation (`--no-owner --no-privileges`).

### Storage & Security
- **Directory**: `./backups/`
- **Filename Convention**: `forgeflow_backup_YYYYMMDD_HHMMSS.dump`
- **File Permissions**: Strictly set to `chmod 600` (readable only by owning system user).
- **Integrity Digest**: Automatically computes and stores a companion `YYYYMMDD_HHMMSS.dump.sha256` checksum.

---

## 2. Taking a Production Backup

### Standard Execution
Backups are triggered via the standard Makefile target:
```bash
make backup
```

### Direct Script Execution
```bash
./scripts/backup.sh
```

### Process Lifecycle
1. Connects to the active PostgreSQL container (`forgeflow-db` via `docker compose exec -T db`).
2. Runs `pg_dump -U forgeflow -Fc -d forgeflow`.
3. Verifies archive TOC structure using `pg_restore --list`.
4. Writes file with permissions `600`.
5. Computes and outputs SHA-256 hash.

### Verification of Backup Archive
To inspect the archive contents without restoring:
```bash
pg_restore --list backups/forgeflow_backup_20261025_090000.dump | head -n 30
```

---

## 3. Automated Restore Rehearsal (`make restore-test`)

Disaster recovery cannot be trusted without empirical restore rehearsals. ForgeFlow provides an isolated rehearsal tool that verifies backup recoverability without affecting active production or test databases.

### Execution
```bash
make restore-test
```
Or with an explicit backup archive:
```bash
BACKUP_FILE=backups/forgeflow_backup_20261025_090000.dump ./scripts/restore_test.sh
```

### Isolation & Safety Guarantees
1. **Isolated Target Database**: Restores exclusively into an ephemeral database named `forgeflow_restore_rehearsal`.
2. **Zero Blast Radius**: Never modifies `forgeflow` (active application) or `forgeflow_test` (automated tests).
3. **Automated Verification**:
   - Executes `pg_restore --clean --if-exists -d forgeflow_restore_rehearsal`.
   - Validates that the restored Alembic migration head matches `0006_customer_exports`.
   - Validates non-zero table row counts across core business models (`organizations`, `users`, `quotes`, `quote_revisions`, `catalog_items`, `activities`).
4. **Deterministic Teardown**: Automatically drops `forgeflow_restore_rehearsal` upon completion, leaving no residual database artifacts.

---

## 4. Production Disaster Recovery Runbook (Full Restore)

In the event of catastrophic data corruption or infrastructure loss, follow these steps to restore production:

### Step 1: Preflight Verification
Confirm archive integrity against its companion digest:
```bash
sha256sum -c backups/forgeflow_backup_YYYYMMDD_HHMMSS.dump.sha256
```

### Step 2: Stop Inbound Application Traffic
Stop backend service to avoid concurrent writes during restore:
```bash
docker compose stop backend frontend
```

### Step 3: Terminate Active DB Connections
```bash
docker compose exec db psql -U postgres -c "
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'forgeflow' AND pid <> pg_backend_pid();"
```

### Step 4: Drop and Recreate Production Database
```bash
docker compose exec db dropdb -U postgres --if-exists forgeflow
docker compose exec db createdb -U postgres -O forgeflow forgeflow
```

### Step 5: Restore Database Archive
```bash
cat backups/forgeflow_backup_YYYYMMDD_HHMMSS.dump | \
  docker compose exec -T db pg_restore -U forgeflow -d forgeflow --no-owner --no-privileges
```

### Step 6: Verify Database Integrity
Run the read-only audit verification suite:
```bash
make verify-audit
```

### Step 7: Restart Application Services
```bash
docker compose up -d
make smoke
```

---

## 5. Recovery Time & Point Objectives (RTO / RPO)

- **Target Recovery Point Objective (RPO)**: <= 1 hour (via hourly automated cron backups).
- **Target Recovery Time Objective (RTO)**: <= 10 minutes (restoring 100MB database snapshot takes < 15 seconds).
- **Recommended Schedule**:
  - Daily full backup retained for 30 days.
  - Hourly snapshots retained for 48 hours.
  - Weekly offsite replication to S3-compatible encrypted cold storage.
