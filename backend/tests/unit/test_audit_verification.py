from sqlalchemy.orm import Session

from app.models.proposal import QuoteChangeProposal
from app.models.quote import Quote
from app.services.audit_verification import verify_database_audit_integrity


def test_audit_verification_passes_on_valid_data(db_session: Session) -> None:
    report = verify_database_audit_integrity(db_session)
    assert report.is_clean
    assert report.failed_checks == 0
    assert report.passed_checks > 0


def test_audit_verification_detects_broken_quote_pointer(db_session: Session) -> None:
    # Test pointer integrity by pointing a quote to a revision from a different quote
    quotes = db_session.query(Quote).all()
    if len(quotes) >= 2 and quotes[1].current_revision_id:
        q0 = quotes[0]
        q1 = quotes[1]
        original_rev = q0.current_revision_id
        # Assign foreign revision from quote 1 to quote 0
        q0.current_revision_id = q1.current_revision_id
        db_session.flush()

        try:
            report = verify_database_audit_integrity(db_session)
            assert not report.is_clean
            pointer_check = next(
                r
                for r in report.results
                if r.check_name == "quote_current_revision_pointer_integrity"
            )
            assert pointer_check.status == "FAIL"
            assert len(pointer_check.violations) > 0
            assert any("foreign revision" in v for v in pointer_check.violations)
        finally:
            q0.current_revision_id = original_rev
            db_session.flush()


def test_audit_verification_detects_maker_checker_violation(db_session: Session) -> None:
    p = db_session.query(QuoteChangeProposal).first()
    if p:
        original_reviewer = p.reviewer_user_id
        # Violate maker-checker: author reviews own proposal
        p.reviewer_user_id = p.proposer_user_id
        db_session.flush()

        try:
            report = verify_database_audit_integrity(db_session)
            assert not report.is_clean
            mc_check = next(
                r
                for r in report.results
                if r.check_name == "maker_checker_separation_and_rejection_mandate"
            )
            assert mc_check.status == "FAIL"
            assert any("Maker-checker violation" in v for v in mc_check.violations)
        finally:
            p.reviewer_user_id = original_reviewer
            db_session.flush()
