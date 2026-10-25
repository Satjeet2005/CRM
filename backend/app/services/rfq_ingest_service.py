import csv
import hashlib
import io
import re
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext
from app.config import settings
from app.domain.rfq.adapter import build_matcher_catalog
from app.domain.rfq.matcher import ProposedMatcher
from app.domain.rfq.normalizer import normalize_line
from app.domain.rfq.types import MatchResult
from app.models.catalog import CatalogAlias, CatalogProduct
from app.models.crm import Account, Opportunity
from app.models.rfq import RFQ, RFQImportJob, RFQLine, RFQMatchCandidate
from app.schemas.rfq import RFQImportPreviewResponse, RFQImportRequest, RFQResponse
from app.services.activity_service import record_activity

# Canonical recognized headers
CANONICAL_COLUMNS = [
    "description",
    "quantity",
    "sku",
    "unit",
    "specifications",
    "manufacturer",
    "manufacturer_part_number",
    "notes",
]


def detect_header_mapping(headers: List[str]) -> Tuple[Dict[str, str], List[str]]:
    """
    Auto-detect recommendations for mapping raw CSV headers to canonical fields.
    Returns (recommended_mapping, unknown_columns).
    """
    mapping: Dict[str, str] = {}
    used_headers: set[str] = set()

    clean_headers = [h.strip() for h in headers if h.strip()]

    # Patterns for canonical columns
    patterns = {
        "description": re.compile(
            r"^(item\s*)?desc(ription)?|line\s*item|particulars|details$", re.I
        ),
        "quantity": re.compile(r"^qty|quantity|count|nos$", re.I),
        "sku": re.compile(r"^sku|item\s*code|part\s*no|part\s*number|item\s*id$", re.I),
        "unit": re.compile(r"^uom|unit|measure|unit\s*of\s*measure$", re.I),
        "specifications": re.compile(r"^spec(ification)?s?|tech(nical)?\s*spec|size|rating$", re.I),
        "manufacturer": re.compile(r"^make|brand|manufacturer|mfr$", re.I),
        "manufacturer_part_number": re.compile(r"^mpn|mfr\s*part\s*no|manufacturer\s*part$", re.I),
        "notes": re.compile(r"^remarks?|notes?|comment?s$", re.I),
    }

    for canon, pat in patterns.items():
        for h in clean_headers:
            if h not in used_headers and pat.match(h):
                mapping[canon] = h
                used_headers.add(h)
                break

    unknown_columns = [h for h in clean_headers if h not in used_headers]
    return mapping, unknown_columns


def parse_csv_stream(content_str: str) -> Tuple[List[str], List[Dict[str, str]], List[str]]:
    """
    Parses CSV content safely with UTF-8 / BOM handling.
    Returns (headers, data_rows, diagnostics).
    """
    diagnostics: List[str] = []

    # Strip BOM if present
    if content_str.startswith("\ufeff"):
        content_str = content_str[1:]
        diagnostics.append("UTF-8 BOM detected and stripped")

    reader = csv.reader(io.StringIO(content_str))

    try:
        raw_header = next(reader, None)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "MALFORMED_CSV",
                "message": f"Could not parse CSV header: {str(e)}",
            },
        ) from e

    if not raw_header:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "EMPTY_CSV",
                "message": "The uploaded CSV file contains no headers or data.",
            },
        )

    headers = [h.strip() for h in raw_header]
    if not any(headers):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "EMPTY_HEADERS",
                "message": "The CSV header row has no non-empty column names.",
            },
        )

    # Check for duplicate headers
    seen_headers = set()
    for h in headers:
        if h in seen_headers:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "code": "DUPLICATE_HEADERS",
                    "message": f"CSV contains duplicate header column: '{h}'",
                },
            )
        seen_headers.add(h)

    rows: List[Dict[str, str]] = []
    line_num = 1
    for raw_row in reader:
        line_num += 1
        # Skip purely blank rows
        if not raw_row or not any(field.strip() for field in raw_row):
            continue

        row_dict = {}
        for idx, val in enumerate(raw_row):
            if idx < len(headers):
                row_dict[headers[idx]] = val.strip()
            else:
                diagnostics.append(f"Row {line_num} has extra columns beyond header count")

        rows.append(row_dict)

    return headers, rows, diagnostics


def preview_rfq_csv(filename: str, csv_content: str) -> RFQImportPreviewResponse:
    """
    Stateless preview of RFQ CSV content without database persistence.
    """
    # Enforce size limits before parsing
    content_bytes = csv_content.encode("utf-8")
    if len(content_bytes) > settings.MAX_RFQ_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"File size exceeds maximum allowable limit of {settings.MAX_RFQ_FILE_SIZE_BYTES} bytes (5 MiB).",
            },
        )

    headers, data_rows, diagnostics = parse_csv_stream(csv_content)

    if len(data_rows) > settings.MAX_RFQ_DATA_ROWS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "TOO_MANY_ROWS",
                "message": f"CSV contains {len(data_rows)} data rows, exceeding the maximum allowed limit of {settings.MAX_RFQ_DATA_ROWS} rows.",
            },
        )

    rec_mapping, unknown_cols = detect_header_mapping(headers)

    sample_rows = data_rows[:10]
    total_data_rows = len(data_rows)

    valid_count = 0
    warn_count = 0
    err_count = 0

    desc_col = rec_mapping.get("description")
    qty_col = rec_mapping.get("quantity")

    for r in data_rows:
        d_val = r.get(desc_col, "") if desc_col else ""
        q_val = r.get(qty_col, "") if qty_col else ""

        if not d_val:
            err_count += 1
        elif not q_val:
            warn_count += 1
        else:
            valid_count += 1

    is_importable = total_data_rows > 0 and err_count < total_data_rows

    return RFQImportPreviewResponse(
        filename=filename,
        detected_headers=headers,
        recommended_mapping=rec_mapping,
        sample_rows=sample_rows,
        total_data_rows=total_data_rows,
        valid_rows_count=valid_count,
        warning_rows_count=warn_count,
        error_rows_count=err_count,
        blank_rows_count=0,
        duplicate_rows_count=0,
        unknown_columns=unknown_cols,
        diagnostics=diagnostics,
        is_importable=is_importable,
    )


def generate_rfq_number(db: Session, organization_id: uuid.UUID) -> str:
    """Generates sequential human-readable RFQ number unique to the organization."""
    year = datetime.now(timezone.utc).year
    prefix = f"RFQ-{year}-"

    latest = db.scalar(
        select(RFQ.rfq_number)
        .where(RFQ.organization_id == organization_id, RFQ.rfq_number.like(f"{prefix}%"))
        .order_by(RFQ.rfq_number.desc())
        .limit(1)
    )

    if latest:
        try:
            num = int(latest.split("-")[-1]) + 1
        except ValueError:
            num = 1
    else:
        num = 1

    return f"{prefix}{num:04d}"


def import_rfq_csv(
    db: Session,
    ctx: AuthenticatedContext,
    payload: RFQImportRequest,
    request_id: Optional[str] = None,
) -> RFQResponse:
    """
    Atomic, transactional ingestion of an RFQ CSV file.
    Validates tenant, account, opportunity, mapping, normalization, and candidate matching.
    """
    # 1. Byte limit check
    content_bytes = payload.csv_content.encode("utf-8")
    if len(content_bytes) > settings.MAX_RFQ_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "PAYLOAD_TOO_LARGE",
                "message": f"Upload size {len(content_bytes)} bytes exceeds limit of {settings.MAX_RFQ_FILE_SIZE_BYTES} bytes.",
            },
        )

    # 2. Content hash & Duplicate detection
    content_hash = hashlib.sha256(content_bytes).hexdigest()

    existing_dup = (
        db.execute(
            select(RFQ).where(
                RFQ.organization_id == ctx.organization.id,
                RFQ.source_file_hash == content_hash,
            )
        )
        .scalars()
        .first()
    )

    if existing_dup and not payload.duplicate_override:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "DUPLICATE_RFQ_IMPORT",
                "message": f"A file with identical content hash was already imported as RFQ '{existing_dup.rfq_number}'. Set duplicate_override=true to import anyway.",
                "existing_rfq_id": str(existing_dup.id),
                "existing_rfq_number": existing_dup.rfq_number,
            },
        )

    # 3. Verify Account and Opportunity
    account = db.execute(
        select(Account).where(
            Account.id == payload.account_id,
            Account.organization_id == ctx.organization.id,
        )
    ).scalar_one_or_none()

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "ACCOUNT_NOT_FOUND",
                "message": "Referenced account does not exist or belongs to another organization.",
            },
        )

    opportunity = db.execute(
        select(Opportunity).where(
            Opportunity.id == payload.opportunity_id,
            Opportunity.organization_id == ctx.organization.id,
        )
    ).scalar_one_or_none()

    if not opportunity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "OPPORTUNITY_NOT_FOUND",
                "message": "Referenced opportunity does not exist or belongs to another organization.",
            },
        )

    if opportunity.account_id != account.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "OPPORTUNITY_ACCOUNT_MISMATCH",
                "message": f"Opportunity '{opportunity.name}' belongs to a different account than '{account.name}'.",
            },
        )

    # 4. Parse CSV
    headers, data_rows, diagnostics = parse_csv_stream(payload.csv_content)

    if len(data_rows) > settings.MAX_RFQ_DATA_ROWS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "TOO_MANY_ROWS",
                "message": f"CSV exceeds maximum allowed {settings.MAX_RFQ_DATA_ROWS} data rows.",
            },
        )

    if not data_rows:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "EMPTY_CSV_DATA",
                "message": "No valid data rows found in CSV.",
            },
        )

    # 5. Verify header mapping contains required fields
    desc_col = payload.header_mapping.get("description")
    if not desc_col or desc_col not in headers:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "MISSING_REQUIRED_MAPPING",
                "message": "Header mapping must include a valid 'description' column matching a CSV header.",
            },
        )

    qty_col = payload.header_mapping.get("quantity")
    sku_col = payload.header_mapping.get("sku")
    unit_col = payload.header_mapping.get("unit")
    spec_col = payload.header_mapping.get("specifications")
    mfr_col = payload.header_mapping.get("manufacturer")
    mpn_col = payload.header_mapping.get("manufacturer_part_number")
    notes_col = payload.header_mapping.get("notes")

    # 6. Load Catalog snapshot for matching
    catalog_products = (
        db.execute(
            select(CatalogProduct).where(
                CatalogProduct.organization_id == ctx.organization.id,
                CatalogProduct.is_active.is_(True),
            )
        )
        .scalars()
        .all()
    )

    catalog_aliases = (
        db.execute(
            select(CatalogAlias).where(
                CatalogAlias.organization_id == ctx.organization.id,
            )
        )
        .scalars()
        .all()
    )

    matcher_catalog = build_matcher_catalog(catalog_products, catalog_aliases)
    matcher = ProposedMatcher(matcher_catalog)

    # 7. Create RFQ Header record
    rfq_number = generate_rfq_number(db, ctx.organization.id)
    now = datetime.now(timezone.utc)

    rfq = RFQ(
        organization_id=ctx.organization.id,
        rfq_number=rfq_number,
        account_id=account.id,
        opportunity_id=opportunity.id,
        title=payload.title,
        customer_reference=payload.customer_reference,
        source_filename=payload.filename,
        source_file_hash=content_hash,
        source_file_size=len(content_bytes),
        total_lines=len(data_rows),
        header_mapping_json=payload.header_mapping,
        import_diagnostics_json={"diagnostics": diagnostics},
        status="needs_review",
        assigned_rep_user_id=ctx.user.id,
        created_by=ctx.user.id,
        candidate_set_version=1,
        version=1,
        imported_at=now,
    )
    db.add(rfq)
    db.flush()

    # 8. Process and Normalize each row
    lines_created = []
    exact_matches_count = 0
    needs_review_count = 0
    invalid_count = 0

    for idx, r in enumerate(data_rows, start=1):
        raw_desc = r.get(desc_col, "").strip()
        raw_q = r.get(qty_col, "").strip() if qty_col else None
        raw_u = r.get(unit_col, "").strip() if unit_col else None
        raw_s = r.get(sku_col, "").strip() if sku_col else None
        raw_spec = r.get(spec_col, "").strip() if spec_col else None
        raw_mfr = r.get(mfr_col, "").strip() if mfr_col else None
        raw_mpn = r.get(mpn_col, "").strip() if mpn_col else None
        raw_notes = r.get(notes_col, "").strip() if notes_col else None

        # Check normalization
        if not raw_desc:
            norm_status = "invalid"
            match_status = "unmatched"
            normalized_desc = ""
            norm_res = None
            parsed_q = None
            can_u = None
            spec_dict: Dict[str, Any] = {}
            diag_dict: Dict[str, Any] = {"error": "Missing item description"}
            invalid_count += 1
        else:
            norm_res = normalize_line(
                raw_input=raw_desc,
                quantity_input=raw_q,
                unit_input=raw_u,
            )
            normalized_desc = norm_res.description_normalized
            parsed_q = norm_res.quantity
            can_u = norm_res.unit
            spec_dict = dict(norm_res.spec)
            diag_dict = {
                "issues": [
                    {"code": i.code, "severity": i.severity, "detail": i.detail}
                    for i in norm_res.issues
                ]
            }

            if norm_res.has_blocking_issues:
                norm_status = "invalid"
                invalid_count += 1
            elif norm_res.issues:
                norm_status = "warning"
            else:
                norm_status = "valid"

            # Match catalog candidates
            match_res: MatchResult = matcher.match(
                line=norm_res,
                hint_sku=raw_s,
                hint_mpn=raw_mpn,
            )
            match_status = match_res.match_status

            if match_status == "exact_match":
                exact_matches_count += 1
            else:
                needs_review_count += 1

        rfq_line = RFQLine(
            organization_id=ctx.organization.id,
            rfq_id=rfq.id,
            source_row_number=idx,
            raw_sku=raw_s,
            raw_description=raw_desc,
            raw_quantity=raw_q,
            raw_unit=raw_u,
            raw_specifications=raw_spec,
            raw_manufacturer=raw_mfr,
            raw_part_number=raw_mpn,
            raw_notes=raw_notes,
            raw_fields_json=r,
            normalized_description=normalized_desc,
            parsed_quantity=parsed_q,
            canonical_unit=can_u,
            specifications_json=spec_dict,
            diagnostics_json=diag_dict,
            normalization_status=norm_status,
            match_status=match_status,
            version=1,
        )
        db.add(rfq_line)
        db.flush()
        lines_created.append(rfq_line)

        # Persist Candidates for this line
        if norm_res and match_res and match_res.candidates:
            for rank_idx, c in enumerate(match_res.candidates, start=1):
                # find product UUID
                prod_uuid = None
                if c.product_id:
                    try:
                        prod_uuid = uuid.UUID(c.product_id)
                    except ValueError:
                        pass

                if not prod_uuid:
                    prod = next((p for p in catalog_products if p.sku == c.sku), None)
                    if prod:
                        prod_uuid = prod.id

                if prod_uuid:
                    cand = RFQMatchCandidate(
                        organization_id=ctx.organization.id,
                        rfq_line_id=rfq_line.id,
                        product_id=prod_uuid,
                        rank=rank_idx,
                        match_method=c.match_method,
                        similarity_score=Decimal(str(c.similarity)),
                        is_disqualified=c.disqualified,
                        flags_json=c.flags,
                        reasons_json=match_res.reason_codes if rank_idx == 1 else [],
                        explanation_json={"attributes": c.attributes, "flags": c.flags},
                        matcher_version="1.0.0-final",
                        candidate_set_version=1,
                    )
                    db.add(cand)

    # 9. Record Import Job audit
    import_job = RFQImportJob(
        organization_id=ctx.organization.id,
        rfq_id=rfq.id,
        status="completed",
        source_filename=payload.filename,
        source_file_hash=content_hash,
        source_file_size=len(content_bytes),
        row_count=len(data_rows),
        error_count=invalid_count,
        validation_report_json={
            "total_rows": len(data_rows),
            "exact_matches": exact_matches_count,
            "needs_review": needs_review_count,
            "invalid": invalid_count,
        },
        request_id=request_id,
        created_by=ctx.user.id,
        completed_at=datetime.now(timezone.utc),
    )
    db.add(import_job)

    # 10. Record Activity
    record_activity(
        db=db,
        organization_id=ctx.organization.id,
        entity_type="rfq",
        entity_id=rfq.id,
        event_type="rfq_imported",
        summary=f"RFQ '{rfq.rfq_number}' ({len(data_rows)} lines) imported by {ctx.user.display_name}",
        metadata_json={"filename": payload.filename, "rows": len(data_rows)},
        actor_user_id=ctx.user.id,
    )

    db.commit()
    db.refresh(rfq)

    # Build response
    resp = RFQResponse.model_validate(rfq)
    resp.account_name = account.name
    resp.opportunity_name = opportunity.name
    resp.assigned_rep_name = ctx.user.display_name
    resp.resolved_lines_count = 0
    resp.needs_review_lines_count = needs_review_count
    resp.invalid_lines_count = invalid_count
    resp.exact_matches_count = exact_matches_count
    resp.is_ready_to_quote = False
    if invalid_count > 0:
        resp.blocking_reasons.append(f"{invalid_count} lines have invalid normalization errors")
    if needs_review_count > 0:
        resp.blocking_reasons.append(f"{needs_review_count} lines require review or confirmation")

    return resp
