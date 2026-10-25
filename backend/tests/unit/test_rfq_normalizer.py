"""
Tests for deterministic normalizer and spec extraction in ForgeFlow.
"""

from decimal import Decimal

import pytest

from app.domain.rfq.normalizer import (
    extract_specifications,
    normalize_line,
    parse_quantity,
)


# 1. QUANTITY PARSING TESTS
@pytest.mark.parametrize(
    "qty_str,canonical_unit,expected_val",
    [
        ("123", "nos", Decimal("123")),
        ("12.5", "mtr", Decimal("12.5")),
        ("12.345", "kg", Decimal("12.345")),
        ("1,000", "nos", Decimal("1000")),
        ("1,00,000", "nos", Decimal("100000")),
        ("10,00,000", "nos", Decimal("1000000")),
        ("१२५", "nos", Decimal("125")),
        ("२.५", "mtr", Decimal("2.5")),
    ],
)
def test_accepted_quantity_formats(qty_str, canonical_unit, expected_val):
    val, issues = parse_quantity(qty_str, canonical_unit)
    assert val == expected_val
    assert len(issues) == 0


@pytest.mark.parametrize(
    "qty_str",
    [
        "1,5",  # comma decimal rejected
        "1e3",  # scientific notation rejected
        "1E3",
        "0",  # zero rejected
        "0.0",
        "-5",  # negative rejected
        "-10.5",
        "1000001",  # > 1,000,000 rejected
        "12.3456",  # > 3 decimal places rejected
        "abc",  # unparseable text
        "1,0000",  # invalid grouping
    ],
)
def test_rejected_quantity_formats(qty_str):
    val, issues = parse_quantity(qty_str, "nos")
    assert val is None
    assert any(i.code == "INVALID_QUANTITY" for i in issues)


def test_fractional_count_unit():
    val, issues = parse_quantity("12.5", "nos")
    assert val == Decimal("12.5")
    assert any(i.code == "FRACTIONAL_COUNT" for i in issues)

    val, issues = parse_quantity("0.5", "box")
    assert val == Decimal("0.5")
    assert any(i.code == "FRACTIONAL_COUNT" for i in issues)

    # Decimal for continuous units is valid without issue
    val, issues = parse_quantity("12.5", "mtr")
    assert val == Decimal("12.5")
    assert len(issues) == 0


# 2. FREE-TEXT TRAILING QUANTITY RULES (1-5)
def test_trailing_rule_1_number_and_unit():
    res = normalize_line("GI Pipe 25mm Class B 10 mtr")
    assert res.quantity == Decimal("10")
    assert res.unit == "mtr"
    assert "MISSING_QUANTITY" not in res.issue_codes
    assert "MISSING_UNIT" not in res.issue_codes


def test_trailing_rule_2_number_only_missing_unit():
    res = normalize_line("GI Socket Coupling 20mm Class B 50")
    assert res.quantity == Decimal("50")
    assert res.unit is None
    assert "MISSING_UNIT" in res.issue_codes


def test_trailing_rule_3_dimension_at_end_missing_quantity():
    res = normalize_line("MS Hex Bolt M12 x 50")
    assert res.quantity is None
    assert "MISSING_QUANTITY" in res.issue_codes


def test_trailing_rule_4_missing_quantity():
    res = normalize_line("MS Hex Nut M10 nos")
    assert res.quantity is None
    assert "MISSING_QUANTITY" in res.issue_codes


def test_trailing_rule_5_unrecognized_trailing_word():
    res = normalize_line("PVC Pipe 50mm Class A 30 bundles")
    assert res.quantity is None
    assert "MISSING_QUANTITY" in res.issue_codes


def test_delimited_input_unknown_unit():
    res = normalize_line("PVC Pipe 50mm Class A|30|bundles")
    assert res.quantity == Decimal("30")
    assert res.unit is None
    assert "UNKNOWN_UNIT" in res.issue_codes


# 3. SPEC EXTRACTION TESTS
def test_spec_extraction_metric_mm():
    spec, _, issues = extract_specifications("GI Pipe 25mm Class B")
    assert spec.get("size_mm") == "25"
    assert spec.get("class") == "B"
    assert spec.get("material") == "GI"
    assert len(issues) == 0


def test_spec_extraction_metric_cm():
    spec, _, _ = extract_specifications("GI Pipe 2.5 cm Class B")
    assert spec.get("size_mm") == "25"


def test_spec_extraction_inch_integer_and_decimal():
    spec, _, _ = extract_specifications("GI Pipe 1 inch Class B")
    assert spec.get("size_mm") == "25.4"

    spec, _, _ = extract_specifications('GI Pipe 2" Class B')
    assert spec.get("size_mm") == "50.8"


def test_spec_extraction_inch_fraction():
    spec, _, _ = extract_specifications("Copper Tubing 1/2 inch")
    assert spec.get("size_mm") == "12.7"

    spec, _, _ = extract_specifications('Copper Tubing 1/4"')
    assert spec.get("size_mm") == "6.35"

    spec, _, _ = extract_specifications("Copper Tubing 3/4 in")
    assert spec.get("size_mm") == "19.05"


def test_spec_extraction_inch_mixed_fraction():
    spec, _, _ = extract_specifications("GI Pipe 1 1/2 inch Class B")
    assert spec.get("size_mm") == "38.1"


def test_spec_extraction_unicode_fraction():
    spec, _, _ = extract_specifications('GI Pipe ½" Class B')
    assert spec.get("size_mm") == "12.7"

    spec, _, _ = extract_specifications('GI Pipe 1½" Class B')
    assert spec.get("size_mm") == "38.1"


def test_spec_extraction_washer_hole_size():
    spec, _, _ = extract_specifications("MS Plain Washer M12")
    assert spec.get("size_mm") == "12"
    assert "thread" not in spec


def test_spec_extraction_bolt_thread_length_grade():
    spec, _, _ = extract_specifications("MS Hex Bolt M12x50 Grade 4.6")
    assert spec.get("material") == "MS"
    assert spec.get("thread") == "M12"
    assert spec.get("length_mm") == "50"
    assert spec.get("grade") == "4.6"


def test_spec_conflict_in_request():
    _, _, issues = extract_specifications("GI Pipe 15mm 25mm Class A")
    assert any(i.code == "SPEC_CONFLICT_IN_REQUEST" for i in issues)

    _, _, issues = extract_specifications("Pipe MS GI 15mm")
    assert any(i.code == "SPEC_CONFLICT_IN_REQUEST" for i in issues)


def test_transliteration_and_stop_words():
    res = normalize_line("Tamba Paip 25mm 10 mtr")
    assert res.description_normalized == "pipe"
    assert res.spec["material"] == "CU"
    assert "material:CU" in res.tokens
    assert "pipe" in res.tokens
    assert "size:25" in res.tokens
