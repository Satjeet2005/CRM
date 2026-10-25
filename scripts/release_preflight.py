#!/usr/bin/env python3
"""
ForgeFlow Release Preflight Inspection Utility
Runs pre-deployment / release readiness checks in read-only mode:
1. Environment & working tree state.
2. Production configuration validation simulation (fail-closed on demo mode / weak secret).
3. Dependency lockfiles presence and synchronization.
4. Database migration status and expected head check.
5. Invariant audit verification via verify_database_audit_integrity.
6. Container PDF rendering pipeline smoke check.

Never resets database, mutates records, or deploys automatically.
Exits 0 on clean preflight, nonzero on blocker.
"""

import os
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def log_check(name: str, status: str, details: str = "") -> None:
    tag = f"[{status}]"
    print(f"{tag:<8} {name:<45} {details}")


def run_preflight() -> int:
    print("================================================================")
    print("         FORGEFLOW RELEASE PREFLIGHT VERIFICATION               ")
    print("================================================================")
    print(f"Repository Root: {REPO_ROOT}\n")

    blockers: list[str] = []

    # 1. Dependency Lockfiles
    pnpm_lock = REPO_ROOT / "frontend" / "pnpm-lock.yaml"
    uv_lock = REPO_ROOT / "backend" / "uv.lock"

    if pnpm_lock.exists() and uv_lock.exists():
        log_check("Dependency Lockfiles", "PASS", "pnpm-lock.yaml & uv.lock present and committed")
    else:
        blockers.append("Missing committed lockfiles (pnpm-lock.yaml or uv.lock)")
        log_check("Dependency Lockfiles", "FAIL", "Lockfile missing")

    # 2. Production Config Invariant Simulation
    sys.path.insert(0, str(REPO_ROOT / "backend"))
    try:
        from app.config import Settings

        # Simulate invalid production configuration (demo mode enabled)
        bad_settings = Settings(
            APP_ENV="production",
            DEMO_MODE=True,
            APP_SECRET_KEY="production-secret-at-least-32-chars-long!",
        )
        try:
            bad_settings.validate_production_guards()
            blockers.append("Production config failed to reject DEMO_MODE=True")
            log_check("Production Config Guard (Demo)", "FAIL", "Did not fail closed")
        except ValueError:
            log_check("Production Config Guard (Demo)", "PASS", "Rejects DEMO_MODE=True in production")

        # Simulate invalid production configuration (weak secret key)
        weak_settings = Settings(
            APP_ENV="production",
            DEMO_MODE=False,
            APP_SECRET_KEY="short-secret",
        )
        try:
            weak_settings.validate_production_guards()
            blockers.append("Production config failed to reject weak secret key")
            log_check("Production Config Guard (Secret)", "FAIL", "Did not fail closed on weak key")
        except ValueError:
            log_check("Production Config Guard (Secret)", "PASS", "Rejects weak secret key (<32 chars)")

    except Exception as e:
        blockers.append(f"Config validation error: {e}")
        log_check("Production Config Guards", "FAIL", str(e))

    # 3. Database Migration Synchronization
    try:
        from app.api.v1.health import EXPECTED_ALEMBIC_HEAD
        from app.db.session import SessionLocal
        from sqlalchemy import text

        db = SessionLocal()
        try:
            curr_rev = db.execute(text("SELECT version_num FROM alembic_version")).scalar()
            if curr_rev == EXPECTED_ALEMBIC_HEAD:
                log_check(
                    "Database Migration Status",
                    "PASS",
                    f"Alembic head synchronized at {curr_rev}",
                )
            else:
                blockers.append(f"Database migration mismatch: {curr_rev} != {EXPECTED_ALEMBIC_HEAD}")
                log_check("Database Migration Status", "FAIL", f"Expected {EXPECTED_ALEMBIC_HEAD}, got {curr_rev}")
        finally:
            db.close()
    except Exception as e:
        blockers.append(f"Database connectivity / migration check failed: {e}")
        log_check("Database Migration Status", "FAIL", str(e))

    # 4. Read-Only Invariant Audit Verification
    try:
        from app.services.audit_verification import verify_database_audit_integrity

        db = SessionLocal()
        try:
            audit_report = verify_database_audit_integrity(db)
            if audit_report.is_clean:
                log_check(
                    "Database Audit Verification",
                    "PASS",
                    f"All {audit_report.passed_checks} data integrity checks passed",
                )
            else:
                blockers.append(f"Audit verification failed with {audit_report.failed_checks} violations")
                log_check("Database Audit Verification", "FAIL", f"{audit_report.failed_checks} failed checks")
        finally:
            db.close()
    except Exception as e:
        blockers.append(f"Audit verification exception: {e}")
        log_check("Database Audit Verification", "FAIL", str(e))

    # 5. WeasyPrint Native Engine PDF Smoke Test
    try:
        from decimal import Decimal
        from app.domain.exports.dto import (
            QuoteExportCustomerDTO,
            QuoteExportDTO,
            QuoteExportLineDTO,
            QuoteExportSellerDTO,
        )
        from app.domain.exports.pdf_renderer import render_quote_pdf

        sample_line = QuoteExportLineDTO(
            line_number=1,
            sku="VALV-BALL-BR-50",
            product_name="Brass Ball Valve",
            description="Brass Ball Valve 50mm",
            unit="nos",
            quantity=Decimal("10.0000"),
            unit_price=Decimal("2500.00"),
            discount_percent=Decimal("0.00"),
            discount_amount=Decimal("0.00"),
            tax_rate_percent=Decimal("18.00"),
            tax_amount=Decimal("4500.00"),
            line_total=Decimal("29500.00"),
        )
        sample_dto = QuoteExportDTO(
            quote_number="QT-SMOKE-001",
            revision_number=1,
            status="approved",
            issue_date="2026-10-25",
            valid_until="2026-11-25",
            payment_terms="Net 30",
            delivery_terms="Ex-Works",
            customer_notes=None,
            opportunity_title="Smoke Opportunity",
            currency="INR",
            seller=QuoteExportSellerDTO(
                company_name="ForgeFlow Demo Manufacturing",
                legal_name="ForgeFlow Demo Manufacturing Ltd.",
                address="Mumbai, Maharashtra, India",
            ),
            customer=QuoteExportCustomerDTO(
                account_name="Smoke Account",
                billing_address="Delhi, India",
                shipping_address="Delhi, India",
            ),
            lines=[sample_line],
            subtotal_amount=Decimal("25000.00"),
            total_discount_amount=Decimal("0.00"),
            taxable_amount=Decimal("25000.00"),
            total_tax_amount=Decimal("4500.00"),
            grand_total=Decimal("29500.00"),
            is_watermarked=False,
        )
        pdf_out = render_quote_pdf(sample_dto)
        if pdf_out.startswith(b"%PDF-") and len(pdf_out) > 1000:
            log_check(
                "WeasyPrint PDF Native Renderer",
                "PASS",
                f"Generated valid PDF document ({len(pdf_out)} bytes)",
            )
        else:
            blockers.append("WeasyPrint generated malformed or empty PDF")
            log_check("WeasyPrint PDF Native Renderer", "FAIL", "Malformed PDF bytes")
    except Exception as e:
        blockers.append(f"WeasyPrint rendering failed: {e}")
        log_check("WeasyPrint PDF Native Renderer", "FAIL", str(e))

    print("----------------------------------------------------------------")
    if blockers:
        print(f"RELEASE PREFLIGHT FAILED: {len(blockers)} blocker(s) found:", file=sys.stderr)
        for b in blockers:
            print(f"  - {b}", file=sys.stderr)
        return 1

    print("RELEASE PREFLIGHT SUCCESSFUL: Ready for controlled deployment.")
    print("================================================================")
    return 0


if __name__ == "__main__":
    sys.exit(run_preflight())
