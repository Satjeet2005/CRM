"""
Proposed deterministic matching engine for RFQ line items.
Conforms to PRD Section 6.6, Section 10.1, Section 11.5, and PRD_DECISIONS.md D1, D3, D11, D13.
"""

from typing import Any, Dict, List, Optional, Set

from app.domain.rfq.normalizer import (
    normalize_line,
)
from app.domain.rfq.types import Candidate, MatchResult, NormalizedLine
from app.domain.rfq.units import check_unit_compatibility


def dice_similarity(r_tokens: Set[str], c_tokens: Set[str]) -> float:
    """Calculate Dice similarity coefficient: 2 * |R ∩ C| / (|R| + |C|)."""
    if not r_tokens or not c_tokens:
        return 0.0
    intersection = len(r_tokens & c_tokens)
    return (2.0 * intersection) / (len(r_tokens) + len(c_tokens))


class ProposedMatcher:
    def __init__(self, catalog: List[Dict[str, Any]], config: Optional[Dict[str, Any]] = None):
        cfg = config or {}
        self.catalog = sorted(catalog, key=lambda x: str(x.get("sku", "")))
        self.k: int = int(cfg.get("K", 5))
        self.t_min_candidate: float = float(cfg.get("T_MIN_CANDIDATE", 0.30))
        self.t_propose: float = float(cfg.get("T_PROPOSE", 0.60))
        self.t_margin: float = float(cfg.get("T_MARGIN", 0.10))

        # Pre-tokenize catalog products
        self.catalog_items: List[Dict[str, Any]] = []
        for item in self.catalog:
            sku = str(item.get("sku", ""))
            name = str(item.get("name", ""))
            category = str(item.get("category", ""))
            uom = str(item.get("uom", ""))
            product_id = str(item.get("product_id") or item.get("id", ""))
            mpn = str(item.get("manufacturer_part_number") or item.get("mpn", ""))
            attributes = item.get("attributes", {}) or {}
            aliases = item.get("aliases", []) or []

            # Spec tokens from attributes
            spec_tokens = set()
            if "material" in attributes:
                spec_tokens.add(f"material:{attributes['material']}")
            if "class" in attributes:
                spec_tokens.add(f"class:{attributes['class']}")
            if "grade" in attributes:
                spec_tokens.add(f"grade:{attributes['grade']}")
            if "thread" in attributes:
                spec_tokens.add(f"thread:{attributes['thread']}")
            if "length_mm" in attributes:
                spec_tokens.add(f"length:{attributes['length_mm']}")
            if "size_mm" in attributes:
                spec_tokens.add(f"size:{attributes['size_mm']}")

            norm_name = normalize_line(name)
            name_token_set = set(norm_name.tokens) | spec_tokens

            alias_token_sets = []
            for alias in aliases:
                norm_alias = normalize_line(str(alias))
                alias_token_sets.append(set(norm_alias.tokens) | spec_tokens)

            self.catalog_items.append(
                {
                    "sku": sku,
                    "name": name,
                    "category": category,
                    "uom": uom,
                    "product_id": product_id,
                    "mpn": mpn,
                    "attributes": attributes,
                    "aliases": aliases,
                    "name_tokens": name_token_set,
                    "alias_token_sets": alias_token_sets,
                }
            )

    def match(
        self, line: NormalizedLine, hint_sku: Optional[str] = None, hint_mpn: Optional[str] = None
    ) -> MatchResult:
        r_tokens = set(line.tokens)

        # 0. Check explicit exact SKU or exact MPN hint or token
        exact_sku_item = None
        exact_mpn_item = None

        clean_hint_sku = hint_sku.strip().upper() if hint_sku else ""
        clean_hint_mpn = hint_mpn.strip().upper() if hint_mpn else ""

        # Check raw text for exact SKU pattern or hints
        for item in self.catalog_items:
            i_sku = item["sku"].upper()
            i_mpn = item["mpn"].upper() if item["mpn"] else ""

            if clean_hint_sku and clean_hint_sku == i_sku:
                exact_sku_item = item
                break
            if clean_hint_mpn and clean_hint_mpn == i_mpn:
                exact_mpn_item = item
                break

            # If raw description equals or contains exact SKU
            desc_upper = line.description_raw.upper()
            if i_sku in desc_upper.split():
                exact_sku_item = item
                break
            if i_mpn and i_mpn in desc_upper.split():
                exact_mpn_item = item
                break

        if not r_tokens and not exact_sku_item and not exact_mpn_item:
            return MatchResult(
                system_outcome="unmatched",
                candidates=[],
                reason_codes=["NO_CANDIDATE"],
                match_status="unmatched",
            )

        # 1. Score all catalog products
        scored = []
        for item in self.catalog_items:
            is_exact_sku = item is exact_sku_item
            is_exact_mpn = item is exact_mpn_item

            if is_exact_sku or is_exact_mpn:
                sim_rounded = 1.0
                match_method = "exact_sku" if is_exact_sku else "exact_mpn"
                scored.append((sim_rounded, match_method, item))
                continue

            sim_name = dice_similarity(r_tokens, item["name_tokens"])
            sim_aliases = [dice_similarity(r_tokens, a_tok) for a_tok in item["alias_token_sets"]]
            best_alias = max(sim_aliases) if sim_aliases else 0.0

            if best_alias > sim_name:
                best_sim = best_alias
                match_method = "alias"
            else:
                best_sim = sim_name
                match_method = "similarity"

            sim_rounded = round(best_sim, 4)
            if sim_rounded >= self.t_min_candidate:
                scored.append((sim_rounded, match_method, item))

        if not scored:
            return MatchResult(
                system_outcome="unmatched",
                candidates=[],
                reason_codes=["NO_CANDIDATE"],
                match_status="unmatched",
            )

        # 2. Total ordering: descending similarity, ascending SKU
        scored.sort(key=lambda x: (-x[0], x[2]["sku"]))
        top_scored = scored[: self.k]

        # 3. Per-candidate checks: spec conflict and unit check
        candidates: List[Candidate] = []
        for score, method, item in top_scored:
            sku = item["sku"]
            name = item["name"]
            uom = item["uom"]
            product_id = item["product_id"]
            attributes = item["attributes"]
            flags: List[str] = []
            disqualified = False

            # Spec conflict check
            for req_attr, req_val in line.spec.items():
                cand_val = attributes.get(req_attr)
                if cand_val is None or cand_val != req_val:
                    flags.append(f"SPEC_CONFLICT:{req_attr}")
                    disqualified = True

            # Unit check
            _, unit_flag = check_unit_compatibility(line.unit, uom)
            if unit_flag:
                flags.append(unit_flag)

            candidates.append(
                Candidate(
                    sku=sku,
                    name=name,
                    similarity=score,
                    disqualified=disqualified,
                    flags=flags,
                    uom=uom,
                    product_id=product_id,
                    attributes=attributes,
                    match_method=method,
                )
            )

        # 4. Plausible set P
        p_candidates = [c for c in candidates if not c.disqualified]
        if not p_candidates:
            return MatchResult(
                system_outcome="unmatched",
                candidates=candidates,
                reason_codes=["NO_COMPATIBLE_CANDIDATE"],
                match_status="unmatched",
            )

        # 5. Near-tie group G = candidates in P with s1 - s_c < T_MARGIN
        top_p = p_candidates[0]
        s1 = top_p.similarity
        g_candidates = [c for c in p_candidates if (s1 - c.similarity) < self.t_margin]

        # 6. Decision procedure: collect abstention reasons
        reasons: List[str] = []

        # Near-tie / missing discriminator
        if len(g_candidates) >= 2:
            g_all_attrs: Set[str] = set()
            for c in g_candidates:
                g_all_attrs.update(c.attributes.keys())
            unspecified_attrs = [a for a in g_all_attrs if a not in line.spec]
            differ_on_unspecified = False
            for a in unspecified_attrs:
                vals = set(c.attributes.get(a) for c in g_candidates if a in c.attributes)
                if len(vals) > 1:
                    differ_on_unspecified = True
                    break

            if differ_on_unspecified:
                reasons.append("SPEC_MISSING_DISCRIMINATOR")
            else:
                reasons.append("MULTIPLE_CANDIDATES")

        # Low similarity
        if s1 < self.t_propose:
            reasons.append("LOW_SIMILARITY")

        # Blocking request issues
        for code in line.issue_codes:
            if code in (
                "MISSING_QUANTITY",
                "MISSING_UNIT",
                "UNKNOWN_UNIT",
                "UNIT_CONFLICT",
                "FRACTIONAL_COUNT",
                "SPEC_CONFLICT_IN_REQUEST",
            ):
                if code not in reasons:
                    reasons.append(code)

        # Unit incompatibility with top candidate in P
        if "UNIT_INCOMPATIBLE" in top_p.flags:
            if "UNIT_INCOMPATIBLE" not in reasons:
                reasons.append("UNIT_INCOMPATIBLE")

        # Close textual match with spec conflict cannot override to propose a lower candidate
        if candidates[0].disqualified:
            if "SPEC_CONFLICT" not in reasons:
                reasons.append("SPEC_CONFLICT")

        if reasons:
            return MatchResult(
                system_outcome="ambiguous",
                candidates=candidates,
                reason_codes=reasons,
                match_status="needs_review",
            )

        # No abstention reasons: proposed candidate
        is_exact = (
            top_p.similarity == 1.0
            and not top_p.flags
            and top_p.match_method in ("exact_sku", "exact_mpn", "similarity", "alias")
        )
        status = "exact_match" if is_exact else "suggested"

        return MatchResult(
            system_outcome="proposed",
            candidates=candidates,
            reason_codes=[],
            match_status=status,
        )
