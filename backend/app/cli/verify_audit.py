import sys

from app.db.session import SessionLocal
from app.services.audit_verification import verify_database_audit_integrity


def main() -> int:
    print("================================================================")
    print("    FORGEFLOW AUDIT & BUSINESS-HISTORY INTEGRITY VERIFIER       ")
    print("================================================================")
    print("Mode: Read-only invariant analysis against active database\n")

    db = SessionLocal()
    try:
        report = verify_database_audit_integrity(db)

        for res in report.results:
            status_tag = f"[{res.status}]"
            print(f"{status_tag:<8} {res.check_name}")
            print(f"         {res.details}")
            if res.violations:
                print("         VIOLATIONS:")
                for v in res.violations:
                    print(f"           - {v}")
            print()

        print("----------------------------------------------------------------")
        print(
            f"SUMMARY: {report.passed_checks}/{report.total_checks} checks passed, "
            f"{report.failed_checks} failed, {report.uncheckable_checks} uncheckable."
        )
        print("----------------------------------------------------------------")

        if not report.is_clean:
            print("AUDIT VERIFICATION FAILED: Data integrity invariants violated.", file=sys.stderr)
            return 1

        print("AUDIT VERIFICATION SUCCESSFUL: All business invariants verified clean.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
