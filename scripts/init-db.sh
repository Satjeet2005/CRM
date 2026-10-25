#!/bin/sh
set -e

# Create test database if it does not exist
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE forgeflow_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'forgeflow_test')\gexec
    GRANT ALL PRIVILEGES ON DATABASE forgeflow_test TO "$POSTGRES_USER";
EOSQL
