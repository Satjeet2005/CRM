import json
import logging
import os
import unicodedata
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.dependencies import AuthenticatedContext
from app.auth.password import hash_password
from app.auth.rbac import Role, get_role_permissions
from app.config import settings
from app.domain.quotes.calculator import QuoteLineInput, calculate_quote
from app.domain.quotes.policies import QuotePolicyConfig, evaluate_quote_policies
from app.models.catalog import CatalogAlias, CatalogProduct
from app.models.crm import Account, Activity, Contact, Opportunity, Task
from app.models.export import QuoteCustomerDelivery
from app.models.membership import OrganizationMembership
from app.models.organization import Organization
from app.models.proposal import QuoteChangeProposal
from app.models.quote import Quote, QuoteRevision, QuoteRevisionLine
from app.models.rfq import RFQ
from app.models.user import User
from app.schemas.proposals import (
    ApprovalDecisionRequest,
    CreateProposalRequest,
    ProposalOperationSchema,
)
from app.schemas.rfq import RFQImportRequest
from app.services.approval_service import reject_proposal
from app.services.proposal_service import create_proposal, submit_proposal
from app.services.rfq_ingest_service import import_rfq_csv

logger = logging.getLogger(__name__)

DEMO_PASSWORD = "ForgeFlowDemo!2026"

DEMO_USERS = [
    {
        "email": "sales@forgeflow.demo",
        "display_name": "Sarah Sales",
        "role": Role.SALES_REP,
    },
    {
        "email": "manager@forgeflow.demo",
        "display_name": "Marcus Manager",
        "role": Role.SALES_MANAGER,
    },
    {
        "email": "catalog@forgeflow.demo",
        "display_name": "Cora Catalog",
        "role": Role.CATALOG_MANAGER,
    },
    {
        "email": "admin@forgeflow.demo",
        "display_name": "Alex Admin",
        "role": Role.ADMIN,
    },
]


def normalize_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKC", text.strip().lower())
    return " ".join(normalized.split())


def seed_demo_data(db: Session) -> None:
    """
    Idempotently seeds ForgeFlow synthetic demo data for Phase 2.
    Strictly disallowed unless DEMO_MODE=true.
    """
    if not settings.DEMO_MODE:
        raise RuntimeError("DEMO_MODE is false! Cannot seed synthetic demo data in non-demo mode.")

    logger.info("Seeding synthetic demo organization, users, CRM, and catalog data...")

    # 1. Organization
    org_slug = "forgeflow-demo"
    stmt_org = select(Organization).where(Organization.slug == org_slug)
    org = db.execute(stmt_org).scalar_one_or_none()
    if not org:
        org = Organization(
            name="ForgeFlow Demo Manufacturing",
            slug=org_slug,
            currency="INR",
            timezone="Asia/Kolkata",
            settings_json={
                "line_discount_approval_percent": "5.00",
                "quote_total_approval_inr": "500000.00",
                "minimum_gross_margin_percent": "15.00",
                "approval_discount_threshold_percent": "5.00",
            },
        )
        db.add(org)
        db.flush()
        logger.info(f"Created demo organization: {org.name} (id={org.id})")
    else:
        org_settings = dict(org.settings_json or {})
        org_settings.setdefault("line_discount_approval_percent", "5.00")
        org_settings.setdefault("quote_total_approval_inr", "500000.00")
        org_settings.setdefault("minimum_gross_margin_percent", "15.00")
        org_settings.setdefault("approval_discount_threshold_percent", "5.00")
        org.settings_json = org_settings
        db.flush()

    # 2. Users and Memberships
    hashed_pwd = hash_password(DEMO_PASSWORD)
    user_map: dict[str, User] = {}

    for user_info in DEMO_USERS:
        email = user_info["email"].lower()
        stmt_user = select(User).where(User.email_normalized == email)
        user = db.execute(stmt_user).scalar_one_or_none()

        if not user:
            user = User(
                email_normalized=email,
                display_name=user_info["display_name"],
                password_hash=hashed_pwd,
                is_active=True,
            )
            db.add(user)
            db.flush()
            logger.info(f"Created demo user: {user.display_name} ({user.email_normalized})")
        else:
            user.password_hash = hashed_pwd
            user.is_active = True
            db.flush()

        stmt_mem = select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.user_id == user.id,
        )
        mem = db.execute(stmt_mem).scalar_one_or_none()
        if not mem:
            mem = OrganizationMembership(
                organization_id=org.id,
                user_id=user.id,
                role=user_info["role"],
                is_active=True,
            )
            db.add(mem)
            db.flush()
        else:
            mem.role = user_info["role"]
            mem.is_active = True
            db.flush()

        user_map[user_info["role"]] = user

    sales_rep = user_map[Role.SALES_REP]
    sales_manager = user_map[Role.SALES_MANAGER]
    catalog_mgr = user_map[Role.CATALOG_MANAGER]

    now = datetime.now(timezone.utc)
    today = now.date()

    # 3. Exactly 10 Synthetic Accounts
    accounts_data = [
        (
            "Apex Heavy Engineering Ltd.",
            "Apex Heavy Engineering Private Limited",
            "customer",
            "Oil & Gas",
            "https://apex.example",
            "+91 22 2555 0101",
            "procurement@apex.example",
            "Mumbai, Maharashtra",
        ),
        (
            "Vanguard Fluid Systems Pvt Ltd.",
            "Vanguard Fluid Systems Technologies Ltd.",
            "customer",
            "Chemical Processing",
            "https://vanguard.example",
            "+91 20 2740 0202",
            "orders@vanguard.example",
            "Pune, Maharashtra",
        ),
        (
            "Bharat Petrochem Equipment Corp.",
            "Bharat Petrochemical Equipment Corporation",
            "customer",
            "Refining",
            "https://bharatpetrochem.example",
            "+91 265 233 0303",
            "supply@bharatpetrochem.example",
            "Vadodara, Gujarat",
        ),
        (
            "Delta Valve & Automation Technologies",
            "Delta Valve Technologies India Ltd.",
            "partner",
            "Industrial Automation",
            "https://deltavalve.example",
            "+91 44 2822 0404",
            "sales@deltavalve.example",
            "Chennai, Tamil Nadu",
        ),
        (
            "Sterling Precision Tools & Dies",
            "Sterling Precision Toolmakers Ltd.",
            "prospect",
            "Automotive",
            "https://sterlingtools.example",
            "+91 124 455 0505",
            "enquiries@sterlingtools.example",
            "Gurugram, Haryana",
        ),
        (
            "Kaveri Turbomachinery Solutions",
            "Kaveri Turbomachinery Infrastructure Pvt Ltd.",
            "customer",
            "Power Generation",
            "https://kaveri.example",
            "+91 80 2660 0606",
            "projects@kaveri.example",
            "Bengaluru, Karnataka",
        ),
        (
            "Himalaya Steel Fabricators",
            "Himalaya Heavy Steel Structures Ltd.",
            "supplier",
            "Metallurgy",
            "https://himalayasteel.example",
            "+91 33 2280 0707",
            "contact@himalayasteel.example",
            "Kolkata, West Bengal",
        ),
        (
            "Zenith Process Piping & Instrumentation",
            "Zenith Process Piping Solutions Ltd.",
            "customer",
            "Pharmaceuticals",
            "https://zenithpiping.example",
            "+91 40 2300 0808",
            "purchase@zenithpiping.example",
            "Hyderabad, Telangana",
        ),
        (
            "Orion Marine Engineering Works",
            "Orion Marine Shipbuilders Ltd.",
            "prospect",
            "Shipbuilding",
            "https://orionmarine.example",
            "+91 484 266 0909",
            "info@orionmarine.example",
            "Kochi, Kerala",
        ),
        (
            "Titan Industrial Fasteners Ltd.",
            "Titan Fastener Components Manufacturing Ltd.",
            "supplier",
            "Hardware",
            "https://titanfasteners.example",
            "+91 161 250 1010",
            "sales@titanfasteners.example",
            "Ludhiana, Punjab",
        ),
    ]

    account_map: dict[str, Account] = {}
    for name, legal, acc_type, ind, web, phone, email, city in accounts_data:
        acc = db.execute(
            select(Account).where(Account.organization_id == org.id, Account.name == name)
        ).scalar_one_or_none()
        if not acc:
            acc = Account(
                organization_id=org.id,
                name=name,
                legal_name=legal,
                account_type=acc_type,
                industry=ind,
                website=web,
                phone=phone,
                email=email,
                billing_address_json={"city": city, "country": "India"},
                shipping_address_json={"city": city, "country": "India"},
                notes=f"Synthetic demo {acc_type} account for ForgeFlow industrial operations.",
                owner_user_id=sales_rep.id if acc_type == "customer" else sales_manager.id,
                status="active",
                created_by=sales_rep.id,
                version=1,
            )
            db.add(acc)
            db.flush()
        account_map[name] = acc

    # 4. Exactly 16 Synthetic Contacts
    contacts_data = [
        (
            "Apex Heavy Engineering Ltd.",
            "Rajesh",
            "Kumar",
            "Chief Procurement Officer",
            "rajesh.kumar@apex.example",
            "+91 98200 11001",
            True,
        ),
        (
            "Apex Heavy Engineering Ltd.",
            "Sunita",
            "Deshmukh",
            "Senior Piping Engineer",
            "sunita.d@apex.example",
            "+91 98200 11002",
            False,
        ),
        (
            "Vanguard Fluid Systems Pvt Ltd.",
            "Priya",
            "Sharma",
            "Director of Supply Chain",
            "priya.sharma@vanguard.example",
            "+91 98400 22001",
            True,
        ),
        (
            "Vanguard Fluid Systems Pvt Ltd.",
            "Vikram",
            "Mehta",
            "Lead Project Manager",
            "vikram.m@vanguard.example",
            "+91 98400 22002",
            False,
        ),
        (
            "Bharat Petrochem Equipment Corp.",
            "Arun",
            "Patel",
            "General Manager - Sourcing",
            "arun.patel@bharatpetrochem.example",
            "+91 98980 33001",
            True,
        ),
        (
            "Bharat Petrochem Equipment Corp.",
            "Kavita",
            "Shah",
            "Quality Assurance Lead",
            "kavita.s@bharatpetrochem.example",
            "+91 98980 33002",
            False,
        ),
        (
            "Delta Valve & Automation Technologies",
            "Suresh",
            "Raman",
            "VP Technical Partnerships",
            "suresh.r@deltavalve.example",
            "+91 94440 44001",
            True,
        ),
        (
            "Sterling Precision Tools & Dies",
            "Amit",
            "Bansal",
            "Managing Director",
            "amit.bansal@sterlingtools.example",
            "+91 98110 55001",
            True,
        ),
        (
            "Kaveri Turbomachinery Solutions",
            "Naveen",
            "Rao",
            "Head of Plant Engineering",
            "naveen.rao@kaveri.example",
            "+91 98450 66001",
            True,
        ),
        (
            "Kaveri Turbomachinery Solutions",
            "Deepa",
            "Iyer",
            "Procurement Specialist",
            "deepa.iyer@kaveri.example",
            "+91 98450 66002",
            False,
        ),
        (
            "Himalaya Steel Fabricators",
            "Debashis",
            "Roy",
            "Sales Director",
            "debashis.roy@himalayasteel.example",
            "+91 98300 77001",
            True,
        ),
        (
            "Himalaya Steel Fabricators",
            "Ananya",
            "Sen",
            "Metallurgical Consultant",
            "ananya.sen@himalayasteel.example",
            "+91 98300 77002",
            False,
        ),
        (
            "Zenith Process Piping & Instrumentation",
            "Mohammad",
            "Farooqui",
            "Plant Manager",
            "m.farooqui@zenithpiping.example",
            "+91 98490 88001",
            True,
        ),
        (
            "Zenith Process Piping & Instrumentation",
            "Sneha",
            "Reddy",
            "Inventory Controller",
            "sneha.reddy@zenithpiping.example",
            "+91 98490 88002",
            False,
        ),
        (
            "Orion Marine Engineering Works",
            "George",
            "Varghese",
            "Technical Superintendent",
            "george.v@orionmarine.example",
            "+91 98470 99001",
            True,
        ),
        (
            "Titan Industrial Fasteners Ltd.",
            "Harpreet",
            "Singh",
            "Commercial Head",
            "harpreet.s@titanfasteners.example",
            "+91 98140 10001",
            True,
        ),
    ]

    contact_map: dict[str, Contact] = {}
    for acc_name, first, last, title, email, phone, is_pri in contacts_data:
        acc = account_map[acc_name]
        c = db.execute(
            select(Contact).where(Contact.account_id == acc.id, Contact.email == email)
        ).scalar_one_or_none()
        if not c:
            c = Contact(
                organization_id=org.id,
                account_id=acc.id,
                first_name=first,
                last_name=last,
                job_title=title,
                email=email,
                phone=phone,
                is_primary=is_pri,
                status="active",
                created_by=sales_rep.id,
                version=1,
            )
            db.add(c)
            db.flush()
        contact_map[email] = c

    # 5. Exactly 10 Synthetic Opportunities
    opps_data = [
        (
            "Apex Heavy Engineering Ltd.",
            "rajesh.kumar@apex.example",
            "High-Pressure Valve Assembly Package",
            "lead",
            Decimal("185000.00"),
            Decimal("20.00"),
            today + timedelta(days=45),
            sales_rep.id,
            "Website RFQ",
            None,
            None,
            None,
            None,
        ),
        (
            "Apex Heavy Engineering Ltd.",
            "sunita.d@apex.example",
            "Distillation Column Spool Fabrication",
            "negotiation",
            Decimal("1450000.00"),
            Decimal("80.00"),
            today + timedelta(days=14),
            sales_manager.id,
            "Direct Referral",
            None,
            None,
            None,
            None,
        ),
        (
            "Vanguard Fluid Systems Pvt Ltd.",
            "priya.sharma@vanguard.example",
            "Cryogenic Flange & Gasket Overhaul",
            "qualified",
            Decimal("340000.00"),
            Decimal("40.00"),
            today + timedelta(days=30),
            sales_rep.id,
            "Trade Fair",
            None,
            None,
            None,
            None,
        ),
        (
            "Vanguard Fluid Systems Pvt Ltd.",
            "vikram.m@vanguard.example",
            "Secondary Steam Line Expansion",
            "lost",
            Decimal("620000.00"),
            Decimal("0.00"),
            today - timedelta(days=5),
            sales_rep.id,
            "Existing Customer",
            "timing",
            "Client project deferred to next fiscal quarter",
            None,
            now - timedelta(days=5),
        ),
        (
            "Bharat Petrochem Equipment Corp.",
            "arun.patel@bharatpetrochem.example",
            "Offshore Piping Replacement Batch 1",
            "solutioning",
            Decimal("750000.00"),
            Decimal("50.00"),
            today + timedelta(days=21),
            sales_rep.id,
            "Inbound Tender",
            None,
            None,
            None,
            None,
        ),
        (
            "Bharat Petrochem Equipment Corp.",
            "arun.patel@bharatpetrochem.example",
            "Refinery Turnaround Fastener Replenishment",
            "won",
            Decimal("580000.00"),
            Decimal("100.00"),
            today - timedelta(days=2),
            sales_manager.id,
            "Annual Contract",
            None,
            None,
            now - timedelta(days=2),
            None,
        ),
        (
            "Delta Valve & Automation Technologies",
            "suresh.r@deltavalve.example",
            "Boiler Feedwater Control Valve Retrofit",
            "proposal",
            Decimal("920000.00"),
            Decimal("65.00"),
            today + timedelta(days=10),
            sales_manager.id,
            "Partner Sourcing",
            None,
            None,
            None,
            None,
        ),
        (
            "Kaveri Turbomachinery Solutions",
            "naveen.rao@kaveri.example",
            "Automated Flow Metering Package",
            "proposal",
            Decimal("1850000.00"),
            Decimal("70.00"),
            today + timedelta(days=5),
            sales_rep.id,
            "Direct Bid",
            None,
            None,
            None,
            None,
        ),
        (
            "Zenith Process Piping & Instrumentation",
            "m.farooqui@zenithpiping.example",
            "Titanium Alloy Fitting Trial",
            "won",
            Decimal("210000.00"),
            Decimal("100.00"),
            today - timedelta(days=8),
            sales_manager.id,
            "Pharma Expansion",
            None,
            None,
            now - timedelta(days=8),
            None,
        ),
        (
            "Zenith Process Piping & Instrumentation",
            "sneha.reddy@zenithpiping.example",
            "Subsea Manifold Gasket Standardization",
            "lost",
            Decimal("480000.00"),
            Decimal("0.00"),
            today - timedelta(days=12),
            sales_rep.id,
            "Supplier Review",
            "price",
            "Competitor offered 15% discount on bulk consignment",
            None,
            now - timedelta(days=12),
        ),
    ]

    opp_map: dict[str, Opportunity] = {}
    for (
        acc_name,
        c_email,
        title,
        stg,
        val,
        prob,
        close_d,
        owner_id,
        src,
        l_reason,
        l_detail,
        won_t,
        lost_t,
    ) in opps_data:
        acc = account_map[acc_name]
        contact = contact_map[c_email]
        opp = db.execute(
            select(Opportunity).where(Opportunity.account_id == acc.id, Opportunity.name == title)
        ).scalar_one_or_none()
        if not opp:
            opp = Opportunity(
                organization_id=org.id,
                account_id=acc.id,
                primary_contact_id=contact.id,
                name=title,
                description=f"Synthetic opportunity for {title} with {acc.name}",
                stage=stg,
                estimated_value=val,
                currency_code="INR",
                probability_percent=prob,
                expected_close_date=close_d,
                owner_user_id=owner_id,
                source=src,
                loss_reason=l_reason,
                loss_detail=l_detail,
                won_at=won_t,
                lost_at=lost_t,
                created_by=sales_rep.id,
                version=1,
            )
            db.add(opp)
            db.flush()
        opp_map[title] = opp

    # 6. Exactly 18 Synthetic Tasks
    tasks_data: list[tuple[Any, ...]] = [
        # Overdue tasks (Critical)
        (
            "Send Revised Flange Specs to Bharat Petrochem",
            "Finalize technical spec sheet for offshore piping batch 1",
            "Bharat Petrochem Equipment Corp.",
            "Offshore Piping Replacement Batch 1",
            sales_rep.id,
            today - timedelta(days=3),
            "high",
            "open",
            None,
        ),
        (
            "Follow up with Zenith on Trial Fitting Delivery",
            "Verify receipt of titanium test fittings with plant QA",
            "Zenith Process Piping & Instrumentation",
            "Titanium Alloy Fitting Trial",
            sales_rep.id,
            today - timedelta(days=2),
            "normal",
            "open",
            None,
        ),
        (
            "Reconcile Material Certificate for Kaveri Turbine",
            "Ensure EN 10204 3.1 certs are verified for pressure parts",
            "Kaveri Turbomachinery Solutions",
            "Automated Flow Metering Package",
            sales_manager.id,
            today - timedelta(days=1),
            "high",
            "open",
            None,
        ),
        # Due today or upcoming (Warning/Normal)
        (
            "Review Boiler Valve Proposal Margins",
            "Conduct internal commercial margin review with Marcus",
            "Delta Valve & Automation Technologies",
            "Boiler Feedwater Control Valve Retrofit",
            sales_manager.id,
            today,
            "high",
            "open",
            None,
        ),
        (
            "Call Rajesh Kumar regarding Distillation Spools",
            "Clarify delivery timeline constraints before quote generation",
            "Apex Heavy Engineering Ltd.",
            "Distillation Column Spool Fabrication",
            sales_rep.id,
            today,
            "normal",
            "open",
            None,
        ),
        (
            "Prepare Technical Datasheet for Cryogenic Flanges",
            "Attach ASTM A182 F316 dimensions for Vanguard",
            "Vanguard Fluid Systems Pvt Ltd.",
            "Cryogenic Flange & Gasket Overhaul",
            sales_rep.id,
            today + timedelta(days=2),
            "normal",
            "open",
            None,
        ),
        (
            "Confirm Chemical Compatibility of Spiral Wound Gaskets",
            "Verify graphite filler suitability for hydrocarbon line",
            "Apex Heavy Engineering Ltd.",
            "High-Pressure Valve Assembly Package",
            sales_rep.id,
            today + timedelta(days=3),
            "normal",
            "open",
            None,
        ),
        (
            "Schedule Technical Alignment Meeting with Sourcing Lead",
            "Coordinate virtual call with Arun Patel for batch 2 planning",
            "Bharat Petrochem Equipment Corp.",
            "Offshore Piping Replacement Batch 1",
            sales_rep.id,
            today + timedelta(days=5),
            "low",
            "open",
            None,
        ),
        (
            "Audit Catalog Pressure Ratings for Class 600 Valves",
            "Validate internal test cert ratings against ASME B16.34",
            None,
            None,
            catalog_mgr.id,
            today + timedelta(days=4),
            "normal",
            "open",
            None,
        ),
        (
            "Draft Commercial Terms for Kaveri Project",
            "Outline standard 30-day payment milestone terms",
            "Kaveri Turbomachinery Solutions",
            "Automated Flow Metering Package",
            sales_rep.id,
            today + timedelta(days=6),
            "high",
            "open",
            None,
        ),
        (
            "Quarterly Supplier Performance Review - Titan Fasteners",
            "Review on-time dispatch rate and bolt grade certifications",
            "Titan Industrial Fasteners Ltd.",
            None,
            sales_manager.id,
            today + timedelta(days=7),
            "normal",
            "open",
            None,
        ),
        (
            "Update Raw Material Price Indexes in Catalog",
            "Review alloy surcharge fluctuations with procurement team",
            None,
            None,
            catalog_mgr.id,
            today + timedelta(days=8),
            "low",
            "open",
            None,
        ),
        # Completed tasks
        (
            "Initial Site Survey - Vanguard Steam Line",
            "Completed visual walk-through of secondary distribution circuit",
            "Vanguard Fluid Systems Pvt Ltd.",
            "Secondary Steam Line Expansion",
            sales_rep.id,
            today - timedelta(days=10),
            "normal",
            "completed",
            now - timedelta(days=9),
        ),
        (
            "Confirm Final Purchase Order - Fastener Consignment",
            "Customer confirmed PO receipt and dispatch clearance",
            "Bharat Petrochem Equipment Corp.",
            "Refinery Turnaround Fastener Replenishment",
            sales_manager.id,
            today - timedelta(days=4),
            "high",
            "completed",
            now - timedelta(days=3),
        ),
        (
            "Send NDA to Orion Marine Procurement",
            "Bilateral NDA signed and archived in document vault",
            "Orion Marine Engineering Works",
            None,
            sales_rep.id,
            today - timedelta(days=8),
            "normal",
            "completed",
            now - timedelta(days=7),
        ),
        (
            "Catalog Clean-up: Archive Deprecated Schedule 10 Pipes",
            "Deprecate legacy thin-wall stainless pipe SKUs",
            None,
            None,
            catalog_mgr.id,
            today - timedelta(days=5),
            "low",
            "completed",
            now - timedelta(days=4),
        ),
        (
            "Compile Loss Analysis Report for Zenith Gasket Bid",
            "Document pricing delta and competitor analysis in CRM",
            "Zenith Process Piping & Instrumentation",
            "Subsea Manifold Gasket Standardization",
            sales_rep.id,
            today - timedelta(days=14),
            "normal",
            "completed",
            now - timedelta(days=13),
        ),
        (
            "Vendor Qualification Form for Himalaya Steel",
            "Submit audited ISO 9001 certifications to supplier database",
            "Himalaya Steel Fabricators",
            None,
            sales_manager.id,
            today - timedelta(days=11),
            "low",
            "completed",
            now - timedelta(days=10),
        ),
    ]

    for title, desc, acc_name, opp_title, assignee_id, due_d, prio, stat, comp_at in tasks_data:
        acc = account_map.get(acc_name) if acc_name else None
        opp = opp_map.get(opp_title) if opp_title else None
        t = db.execute(
            select(Task).where(Task.organization_id == org.id, Task.title == title)
        ).scalar_one_or_none()
        if not t:
            t = Task(
                organization_id=org.id,
                title=title,
                description=desc,
                account_id=acc.id if acc else None,
                opportunity_id=opp.id if opp else None,
                assignee_user_id=assignee_id,
                due_date=due_d,
                priority=prio,
                status=stat,
                completed_at=comp_at,
                created_by=sales_rep.id,
                version=1,
            )
            db.add(t)
            db.flush()

    # 7. Approximately 100 Synthetic Industrial Catalog Products
    # Covering: Pipes, Fittings, Flanges, Valves, Gaskets/Seals, Fasteners, Consumables
    categories = [
        (
            "Pipes",
            [
                (
                    "PIP-CS-015-S40",
                    "Carbon Steel Seamless Pipe 15mm (1/2 in) Sch 40",
                    "ASTM A106 Gr B seamless pipe",
                    "ea",
                    Decimal("850.0000"),
                    Decimal("550.0000"),
                    Decimal("18.00"),
                    {"size": "15mm", "material": "Carbon Steel", "schedule": "Sch 40"},
                    ["1/2 in carbon steel pipe", "15mm seamless cs pipe"],
                ),
                (
                    "PIP-CS-020-S40",
                    "Carbon Steel Seamless Pipe 20mm (3/4 in) Sch 40",
                    "ASTM A106 Gr B seamless pipe",
                    "ea",
                    Decimal("1120.0000"),
                    Decimal("720.0000"),
                    Decimal("18.00"),
                    {"size": "20mm", "material": "Carbon Steel", "schedule": "Sch 40"},
                    ["3/4 in cs pipe", "20mm carbon pipe"],
                ),
                (
                    "PIP-CS-025-S40",
                    "Carbon Steel Seamless Pipe 25mm (1 in) Sch 40",
                    "ASTM A106 Gr B seamless pipe",
                    "ea",
                    Decimal("1450.0000"),
                    Decimal("950.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Carbon Steel", "schedule": "Sch 40"},
                    ["1 inch cs pipe", "25mm cs seamless"],
                ),
                (
                    "PIP-CS-040-S40",
                    "Carbon Steel Seamless Pipe 40mm (1.5 in) Sch 40",
                    "ASTM A106 Gr B seamless pipe",
                    "ea",
                    Decimal("2200.0000"),
                    Decimal("1450.0000"),
                    Decimal("18.00"),
                    {"size": "40mm", "material": "Carbon Steel", "schedule": "Sch 40"},
                    ["1.5 inch sch 40 pipe", "40mm seamless cs"],
                ),
                (
                    "PIP-CS-050-S40",
                    "Carbon Steel Seamless Pipe 50mm (2 in) Sch 40",
                    "ASTM A106 Gr B seamless pipe",
                    "ea",
                    Decimal("2950.0000"),
                    Decimal("1950.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Carbon Steel", "schedule": "Sch 40"},
                    ["2 inch cs pipe", "50mm sch 40 carbon"],
                ),
                (
                    "PIP-CS-080-S40",
                    "Carbon Steel Seamless Pipe 80mm (3 in) Sch 40",
                    "ASTM A106 Gr B seamless pipe",
                    "ea",
                    Decimal("4800.0000"),
                    Decimal("3200.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "material": "Carbon Steel", "schedule": "Sch 40"},
                    ["3 inch cs seamless", "80mm seamless carbon pipe"],
                ),
                (
                    "PIP-CS-100-S40",
                    "Carbon Steel Seamless Pipe 100mm (4 in) Sch 40",
                    "ASTM A106 Gr B seamless pipe",
                    "ea",
                    Decimal("6400.0000"),
                    Decimal("4300.0000"),
                    Decimal("18.00"),
                    {"size": "100mm", "material": "Carbon Steel", "schedule": "Sch 40"},
                    ["4 inch cs pipe", "100mm sch 40 pipe"],
                ),
                (
                    "PIP-CS-050-S80",
                    "Carbon Steel Seamless Pipe 50mm (2 in) Sch 80",
                    "ASTM A106 Gr B heavy-wall pipe",
                    "ea",
                    Decimal("3800.0000"),
                    Decimal("2500.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Carbon Steel", "schedule": "Sch 80"},
                    ["2 in heavy wall cs", "50mm sch 80 pipe"],
                ),
                (
                    "PIP-SS-025-S40",
                    "Stainless Steel Pipe 25mm (1 in) Sch 40 316L",
                    "ASTM A312 TP316L seamless pipe",
                    "ea",
                    Decimal("3600.0000"),
                    Decimal("2400.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Stainless Steel 316L", "schedule": "Sch 40"},
                    ["1 inch ss316l pipe", "25mm stainless pipe 316l"],
                ),
                (
                    "PIP-SS-050-S40",
                    "Stainless Steel Pipe 50mm (2 in) Sch 40 316L",
                    "ASTM A312 TP316L seamless pipe",
                    "ea",
                    Decimal("6900.0000"),
                    Decimal("4700.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Stainless Steel 316L", "schedule": "Sch 40"},
                    ["2 inch ss316l pipe", "50mm stainless seamless pipe"],
                ),
                (
                    "PIP-SS-080-S40",
                    "Stainless Steel Pipe 80mm (3 in) Sch 40 316L",
                    "ASTM A312 TP316L seamless pipe",
                    "ea",
                    Decimal("11500.0000"),
                    Decimal("7800.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "material": "Stainless Steel 316L", "schedule": "Sch 40"},
                    ["3 inch ss316l pipe", "80mm ss316l pipe"],
                ),
                (
                    "PIP-SS-100-S40",
                    "Stainless Steel Pipe 100mm (4 in) Sch 40 316L",
                    "ASTM A312 TP316L seamless pipe",
                    "ea",
                    Decimal("15800.0000"),
                    Decimal("10800.0000"),
                    Decimal("18.00"),
                    {"size": "100mm", "material": "Stainless Steel 316L", "schedule": "Sch 40"},
                    ["4 inch 316l pipe", "100mm stainless pipe"],
                ),
                (
                    "PIP-SS-025-S10",
                    "Stainless Steel Pipe 25mm (1 in) Sch 10 304L",
                    "ASTM A312 TP304L thin wall pipe",
                    "ea",
                    Decimal("2200.0000"),
                    Decimal("1450.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Stainless Steel 304L", "schedule": "Sch 10"},
                    ["1 in ss304 pipe", "25mm sch 10 stainless"],
                ),
                (
                    "PIP-SS-050-S10",
                    "Stainless Steel Pipe 50mm (2 in) Sch 10 304L",
                    "ASTM A312 TP304L thin wall pipe",
                    "ea",
                    Decimal("4100.0000"),
                    Decimal("2700.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Stainless Steel 304L", "schedule": "Sch 10"},
                    ["2 in ss304 pipe", "50mm sch 10 ss"],
                ),
                (
                    "PIP-AL-050-S40",
                    "Alloy 20 Seamless Pipe 50mm (2 in) Sch 40",
                    "ASTM B464 corrosion resistant pipe",
                    "ea",
                    Decimal("18500.0000"),
                    Decimal("12800.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Alloy 20", "schedule": "Sch 40"},
                    ["2 inch alloy 20 pipe", "50mm alloy20 pipe"],
                ),
            ],
        ),
        (
            "Fittings",
            [
                (
                    "FIT-EL-015-90",
                    "Buttweld 90 Deg Elbow 15mm Sch 40 CS",
                    "ASTM A234 WPB long radius elbow",
                    "ea",
                    Decimal("280.0000"),
                    Decimal("170.0000"),
                    Decimal("18.00"),
                    {"size": "15mm", "material": "Carbon Steel", "type": "90 Deg Elbow"},
                    ["1/2 in 90 elbow cs", "15mm bw elbow"],
                ),
                (
                    "FIT-EL-025-90",
                    "Buttweld 90 Deg Elbow 25mm Sch 40 CS",
                    "ASTM A234 WPB long radius elbow",
                    "ea",
                    Decimal("420.0000"),
                    Decimal("260.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Carbon Steel", "type": "90 Deg Elbow"},
                    ["1 in 90 elbow", "25mm cs elbow 90"],
                ),
                (
                    "FIT-EL-050-90",
                    "Buttweld 90 Deg Elbow 50mm Sch 40 CS",
                    "ASTM A234 WPB long radius elbow",
                    "ea",
                    Decimal("780.0000"),
                    Decimal("490.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Carbon Steel", "type": "90 Deg Elbow"},
                    ["2 inch 90 deg elbow", "50mm lr elbow cs"],
                ),
                (
                    "FIT-EL-080-90",
                    "Buttweld 90 Deg Elbow 80mm Sch 40 CS",
                    "ASTM A234 WPB long radius elbow",
                    "ea",
                    Decimal("1350.0000"),
                    Decimal("850.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "material": "Carbon Steel", "type": "90 Deg Elbow"},
                    ["3 inch elbow 90 cs", "80mm 90 elbow"],
                ),
                (
                    "FIT-EL-100-90",
                    "Buttweld 90 Deg Elbow 100mm Sch 40 CS",
                    "ASTM A234 WPB long radius elbow",
                    "ea",
                    Decimal("2100.0000"),
                    Decimal("1350.0000"),
                    Decimal("18.00"),
                    {"size": "100mm", "material": "Carbon Steel", "type": "90 Deg Elbow"},
                    ["4 inch elbow 90 cs", "100mm 90 deg elbow"],
                ),
                (
                    "FIT-EL-025-45",
                    "Buttweld 45 Deg Elbow 25mm Sch 40 CS",
                    "ASTM A234 WPB 45 deg elbow",
                    "ea",
                    Decimal("380.0000"),
                    Decimal("240.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Carbon Steel", "type": "45 Deg Elbow"},
                    ["1 in 45 elbow", "25mm 45 deg elbow"],
                ),
                (
                    "FIT-EL-050-45",
                    "Buttweld 45 Deg Elbow 50mm Sch 40 CS",
                    "ASTM A234 WPB 45 deg elbow",
                    "ea",
                    Decimal("690.0000"),
                    Decimal("440.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Carbon Steel", "type": "45 Deg Elbow"},
                    ["2 in 45 elbow", "50mm 45 elbow"],
                ),
                (
                    "FIT-TE-025-EQ",
                    "Equal Tee 25mm Sch 40 Carbon Steel",
                    "ASTM A234 WPB straight tee",
                    "ea",
                    Decimal("580.0000"),
                    Decimal("360.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Carbon Steel", "type": "Equal Tee"},
                    ["1 in equal tee cs", "25mm straight tee"],
                ),
                (
                    "FIT-TE-050-EQ",
                    "Equal Tee 50mm Sch 40 Carbon Steel",
                    "ASTM A234 WPB straight tee",
                    "ea",
                    Decimal("1150.0000"),
                    Decimal("720.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Carbon Steel", "type": "Equal Tee"},
                    ["2 in equal tee cs", "50mm buttweld tee"],
                ),
                (
                    "FIT-TE-080-EQ",
                    "Equal Tee 80mm Sch 40 Carbon Steel",
                    "ASTM A234 WPB straight tee",
                    "ea",
                    Decimal("1950.0000"),
                    Decimal("1250.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "material": "Carbon Steel", "type": "Equal Tee"},
                    ["3 in equal tee cs", "80mm buttweld tee"],
                ),
                (
                    "FIT-RD-5025-C",
                    "Concentric Reducer 50mm x 25mm Sch 40 CS",
                    "ASTM A234 WPB concentric reducer",
                    "ea",
                    Decimal("620.0000"),
                    Decimal("390.0000"),
                    Decimal("18.00"),
                    {"size": "50x25mm", "material": "Carbon Steel", "type": "Concentric Reducer"},
                    ["2x1 in conc reducer", "50x25 concentric reducer"],
                ),
                (
                    "FIT-RD-8050-C",
                    "Concentric Reducer 80mm x 50mm Sch 40 CS",
                    "ASTM A234 WPB concentric reducer",
                    "ea",
                    Decimal("1120.0000"),
                    Decimal("710.0000"),
                    Decimal("18.00"),
                    {"size": "80x50mm", "material": "Carbon Steel", "type": "Concentric Reducer"},
                    ["3x2 in reducer", "80x50 conc reducer"],
                ),
                (
                    "FIT-CP-025-CS",
                    "Pipe End Cap 25mm Sch 40 Carbon Steel",
                    "ASTM A234 WPB pipe end cap",
                    "ea",
                    Decimal("290.0000"),
                    Decimal("180.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Carbon Steel", "type": "End Cap"},
                    ["1 in pipe cap", "25mm cs cap"],
                ),
                (
                    "FIT-CP-050-CS",
                    "Pipe End Cap 50mm Sch 40 Carbon Steel",
                    "ASTM A234 WPB pipe end cap",
                    "ea",
                    Decimal("510.0000"),
                    Decimal("320.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Carbon Steel", "type": "End Cap"},
                    ["2 in pipe cap", "50mm cs cap"],
                ),
                (
                    "FIT-EL-025-SS",
                    "Stainless Steel 90 Deg Elbow 25mm 316L",
                    "ASTM A403 WP316L long radius elbow",
                    "ea",
                    Decimal("1250.0000"),
                    Decimal("820.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "Stainless Steel 316L", "type": "90 Deg Elbow"},
                    ["1 in ss316l elbow", "25mm 90 stainless elbow"],
                ),
                (
                    "FIT-EL-050-SS",
                    "Stainless Steel 90 Deg Elbow 50mm 316L",
                    "ASTM A403 WP316L long radius elbow",
                    "ea",
                    Decimal("2650.0000"),
                    Decimal("1750.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Stainless Steel 316L", "type": "90 Deg Elbow"},
                    ["2 in ss316l elbow", "50mm stainless elbow 90"],
                ),
                (
                    "FIT-TE-050-SS",
                    "Stainless Steel Equal Tee 50mm 316L",
                    "ASTM A403 WP316L straight tee",
                    "ea",
                    Decimal("3800.0000"),
                    Decimal("2550.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "Stainless Steel 316L", "type": "Equal Tee"},
                    ["2 in ss316l tee", "50mm stainless tee"],
                ),
            ],
        ),
        (
            "Flanges",
            [
                (
                    "FLG-WN-025-C150",
                    "Weld Neck Flange 25mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 weld neck flange",
                    "ea",
                    Decimal("950.0000"),
                    Decimal("620.0000"),
                    Decimal("18.00"),
                    {
                        "size": "25mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["1 in 150# wn flange", "25mm cl150 wn flange"],
                ),
                (
                    "FLG-WN-050-C150",
                    "Weld Neck Flange 50mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 weld neck flange",
                    "ea",
                    Decimal("1650.0000"),
                    Decimal("1080.0000"),
                    Decimal("18.00"),
                    {
                        "size": "50mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["2 in 150# wn flange", "50mm weld neck flange 150#"],
                ),
                (
                    "FLG-WN-080-C150",
                    "Weld Neck Flange 80mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 weld neck flange",
                    "ea",
                    Decimal("2450.0000"),
                    Decimal("1600.0000"),
                    Decimal("18.00"),
                    {
                        "size": "80mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["3 in 150# wn flange", "80mm cl150 wn flange"],
                ),
                (
                    "FLG-WN-100-C150",
                    "Weld Neck Flange 100mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 weld neck flange",
                    "ea",
                    Decimal("3400.0000"),
                    Decimal("2250.0000"),
                    Decimal("18.00"),
                    {
                        "size": "100mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["4 in 150# wn flange", "100mm weld neck 150#"],
                ),
                (
                    "FLG-WN-050-C300",
                    "Weld Neck Flange 50mm Class 300 RF CS",
                    "ASME B16.5 ASTM A105 weld neck flange",
                    "ea",
                    Decimal("2400.0000"),
                    Decimal("1550.0000"),
                    Decimal("18.00"),
                    {
                        "size": "50mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 300",
                        "facing": "RF",
                    },
                    ["2 in 300# wn flange", "50mm 300# wn flange"],
                ),
                (
                    "FLG-WN-080-C300",
                    "Weld Neck Flange 80mm Class 300 RF CS",
                    "ASME B16.5 ASTM A105 weld neck flange",
                    "ea",
                    Decimal("3800.0000"),
                    Decimal("2500.0000"),
                    Decimal("18.00"),
                    {
                        "size": "80mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 300",
                        "facing": "RF",
                    },
                    ["3 in 300# wn flange", "80mm class 300 weld neck"],
                ),
                (
                    "FLG-WN-100-C300",
                    "Weld Neck Flange 100mm Class 300 RF CS",
                    "ASME B16.5 ASTM A105 weld neck flange",
                    "ea",
                    Decimal("5600.0000"),
                    Decimal("3700.0000"),
                    Decimal("18.00"),
                    {
                        "size": "100mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 300",
                        "facing": "RF",
                    },
                    ["4 in 300# wn flange", "100mm cl300 wn flange"],
                ),
                (
                    "FLG-SO-025-C150",
                    "Slip-On Flange 25mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 slip-on flange",
                    "ea",
                    Decimal("720.0000"),
                    Decimal("470.0000"),
                    Decimal("18.00"),
                    {
                        "size": "25mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["1 in 150# so flange", "25mm slip on flange"],
                ),
                (
                    "FLG-SO-050-C150",
                    "Slip-On Flange 50mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 slip-on flange",
                    "ea",
                    Decimal("1250.0000"),
                    Decimal("820.0000"),
                    Decimal("18.00"),
                    {
                        "size": "50mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["2 in 150# so flange", "50mm slip on flange 150#"],
                ),
                (
                    "FLG-BL-025-C150",
                    "Blind Flange 25mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 blind flange",
                    "ea",
                    Decimal("680.0000"),
                    Decimal("440.0000"),
                    Decimal("18.00"),
                    {
                        "size": "25mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["1 in blind flange", "25mm cl150 blind flange"],
                ),
                (
                    "FLG-BL-050-C150",
                    "Blind Flange 50mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 blind flange",
                    "ea",
                    Decimal("1380.0000"),
                    Decimal("910.0000"),
                    Decimal("18.00"),
                    {
                        "size": "50mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["2 in blind flange 150#", "50mm blind flange"],
                ),
                (
                    "FLG-BL-080-C150",
                    "Blind Flange 80mm Class 150 RF CS",
                    "ASME B16.5 ASTM A105 blind flange",
                    "ea",
                    Decimal("2150.0000"),
                    Decimal("1420.0000"),
                    Decimal("18.00"),
                    {
                        "size": "80mm",
                        "material": "Carbon Steel",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["3 in blind flange", "80mm cl150 blind flange"],
                ),
                (
                    "FLG-WN-025-SS150",
                    "Weld Neck Flange 25mm Class 150 SS 316L",
                    "ASME B16.5 ASTM A182 F316L flange",
                    "ea",
                    Decimal("2850.0000"),
                    Decimal("1900.0000"),
                    Decimal("18.00"),
                    {
                        "size": "25mm",
                        "material": "Stainless Steel 316L",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["1 in ss316l wn flange", "25mm stainless wn flange"],
                ),
                (
                    "FLG-WN-050-SS150",
                    "Weld Neck Flange 50mm Class 150 SS 316L",
                    "ASME B16.5 ASTM A182 F316L flange",
                    "ea",
                    Decimal("4950.0000"),
                    Decimal("3300.0000"),
                    Decimal("18.00"),
                    {
                        "size": "50mm",
                        "material": "Stainless Steel 316L",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["2 in ss316l wn flange", "50mm stainless wn 150#"],
                ),
                (
                    "FLG-BL-050-SS150",
                    "Blind Flange 50mm Class 150 SS 316L",
                    "ASME B16.5 ASTM A182 F316L blind flange",
                    "ea",
                    Decimal("4100.0000"),
                    Decimal("2750.0000"),
                    Decimal("18.00"),
                    {
                        "size": "50mm",
                        "material": "Stainless Steel 316L",
                        "pressure_class": "Class 150",
                        "facing": "RF",
                    },
                    ["2 in ss316l blind flange", "50mm ss blind flange"],
                ),
            ],
        ),
        (
            "Valves",
            [
                (
                    "VLV-BL-015-C150",
                    "Floating Ball Valve 15mm Class 150 RF CS",
                    "ASME B16.34 2-piece flanged ball valve",
                    "ea",
                    Decimal("3800.0000"),
                    Decimal("2500.0000"),
                    Decimal("18.00"),
                    {"size": "15mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["1/2 in ball valve 150#", "15mm flanged ball valve"],
                ),
                (
                    "VLV-BL-025-C150",
                    "Floating Ball Valve 25mm Class 150 RF CS",
                    "ASME B16.34 2-piece flanged ball valve",
                    "ea",
                    Decimal("5600.0000"),
                    Decimal("3700.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["1 in ball valve 150#", "25mm flanged ball valve"],
                ),
                (
                    "VLV-BL-050-C150",
                    "Floating Ball Valve 50mm Class 150 RF CS",
                    "ASME B16.34 2-piece flanged ball valve",
                    "ea",
                    Decimal("9800.0000"),
                    Decimal("6500.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["2 in ball valve 150#", "50mm ball valve 150#"],
                ),
                (
                    "VLV-BL-080-C150",
                    "Floating Ball Valve 80mm Class 150 RF CS",
                    "ASME B16.34 2-piece flanged ball valve",
                    "ea",
                    Decimal("17500.0000"),
                    Decimal("11800.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["3 in ball valve 150#", "80mm flanged ball valve"],
                ),
                (
                    "VLV-BL-100-C150",
                    "Floating Ball Valve 100mm Class 150 RF CS",
                    "ASME B16.34 2-piece flanged ball valve",
                    "ea",
                    Decimal("26500.0000"),
                    Decimal("18000.0000"),
                    Decimal("18.00"),
                    {
                        "size": "100mm",
                        "material": "WCB Carbon Steel",
                        "pressure_class": "Class 150",
                    },
                    ["4 in ball valve 150#", "100mm ball valve"],
                ),
                (
                    "VLV-GT-050-C150",
                    "Cast Steel Gate Valve 50mm Class 150 RF",
                    "API 600 bolted bonnet rising stem gate valve",
                    "ea",
                    Decimal("11200.0000"),
                    Decimal("7600.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["2 in gate valve 150#", "50mm cast gate valve"],
                ),
                (
                    "VLV-GT-080-C150",
                    "Cast Steel Gate Valve 80mm Class 150 RF",
                    "API 600 bolted bonnet rising stem gate valve",
                    "ea",
                    Decimal("16800.0000"),
                    Decimal("11400.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["3 in gate valve 150#", "80mm gate valve"],
                ),
                (
                    "VLV-GT-100-C150",
                    "Cast Steel Gate Valve 100mm Class 150 RF",
                    "API 600 bolted bonnet rising stem gate valve",
                    "ea",
                    Decimal("23500.0000"),
                    Decimal("15800.0000"),
                    Decimal("18.00"),
                    {
                        "size": "100mm",
                        "material": "WCB Carbon Steel",
                        "pressure_class": "Class 150",
                    },
                    ["4 in gate valve 150#", "100mm gate valve 150#"],
                ),
                (
                    "VLV-GL-050-C150",
                    "Cast Steel Globe Valve 50mm Class 150 RF",
                    "BS 1873 bolted bonnet globe valve",
                    "ea",
                    Decimal("12800.0000"),
                    Decimal("8700.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["2 in globe valve 150#", "50mm globe valve"],
                ),
                (
                    "VLV-CK-050-C150",
                    "Swing Check Valve 50mm Class 150 RF CS",
                    "API 6D swing check non-return valve",
                    "ea",
                    Decimal("8900.0000"),
                    Decimal("6000.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["2 in check valve 150#", "50mm swing check"],
                ),
                (
                    "VLV-CK-080-C150",
                    "Swing Check Valve 80mm Class 150 RF CS",
                    "API 6D swing check non-return valve",
                    "ea",
                    Decimal("14500.0000"),
                    Decimal("9800.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "material": "WCB Carbon Steel", "pressure_class": "Class 150"},
                    ["3 in check valve 150#", "80mm swing check"],
                ),
                (
                    "VLV-BF-080-WAF",
                    "Wafer Butterfly Valve 80mm Class 150 EPDM",
                    "API 609 concentric wafer butterfly valve",
                    "ea",
                    Decimal("4900.0000"),
                    Decimal("3300.0000"),
                    Decimal("18.00"),
                    {
                        "size": "80mm",
                        "material": "Ductile Iron / SS316",
                        "pressure_class": "Class 150",
                    },
                    ["3 in wafer butterfly valve", "80mm butterfly valve"],
                ),
                (
                    "VLV-BF-100-WAF",
                    "Wafer Butterfly Valve 100mm Class 150 EPDM",
                    "API 609 concentric wafer butterfly valve",
                    "ea",
                    Decimal("6800.0000"),
                    Decimal("4500.0000"),
                    Decimal("18.00"),
                    {
                        "size": "100mm",
                        "material": "Ductile Iron / SS316",
                        "pressure_class": "Class 150",
                    },
                    ["4 in wafer butterfly valve", "100mm butterfly valve"],
                ),
                (
                    "VLV-BL-025-SS150",
                    "Ball Valve 25mm Class 150 SS 316",
                    "CF8M stainless steel flanged ball valve",
                    "ea",
                    Decimal("9200.0000"),
                    Decimal("6300.0000"),
                    Decimal("18.00"),
                    {
                        "size": "25mm",
                        "material": "Stainless Steel 316",
                        "pressure_class": "Class 150",
                    },
                    ["1 in ss316 ball valve", "25mm stainless ball valve"],
                ),
                (
                    "VLV-BL-050-SS150",
                    "Ball Valve 50mm Class 150 SS 316",
                    "CF8M stainless steel flanged ball valve",
                    "ea",
                    Decimal("16500.0000"),
                    Decimal("11200.0000"),
                    Decimal("18.00"),
                    {
                        "size": "50mm",
                        "material": "Stainless Steel 316",
                        "pressure_class": "Class 150",
                    },
                    ["2 in ss316 ball valve", "50mm stainless ball valve"],
                ),
            ],
        ),
        (
            "Gaskets & Seals",
            [
                (
                    "GSK-SW-025-C150",
                    "Spiral Wound Gasket 25mm Class 150 Graphite",
                    "ASME B16.20 316L/Graphite with CS outer ring",
                    "ea",
                    Decimal("220.0000"),
                    Decimal("125.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "pressure_class": "Class 150", "filler": "Flexible Graphite"},
                    ["1 in spiral wound gasket", "25mm 150# swg"],
                ),
                (
                    "GSK-SW-050-C150",
                    "Spiral Wound Gasket 50mm Class 150 Graphite",
                    "ASME B16.20 316L/Graphite with CS outer ring",
                    "ea",
                    Decimal("380.0000"),
                    Decimal("220.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "pressure_class": "Class 150", "filler": "Flexible Graphite"},
                    ["2 in spiral wound gasket", "50mm 150# swg"],
                ),
                (
                    "GSK-SW-080-C150",
                    "Spiral Wound Gasket 80mm Class 150 Graphite",
                    "ASME B16.20 316L/Graphite with CS outer ring",
                    "ea",
                    Decimal("580.0000"),
                    Decimal("340.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "pressure_class": "Class 150", "filler": "Flexible Graphite"},
                    ["3 in spiral wound gasket", "80mm 150# swg"],
                ),
                (
                    "GSK-SW-100-C150",
                    "Spiral Wound Gasket 100mm Class 150 Graphite",
                    "ASME B16.20 316L/Graphite with CS outer ring",
                    "ea",
                    Decimal("820.0000"),
                    Decimal("480.0000"),
                    Decimal("18.00"),
                    {"size": "100mm", "pressure_class": "Class 150", "filler": "Flexible Graphite"},
                    ["4 in spiral wound gasket", "100mm 150# swg"],
                ),
                (
                    "GSK-SW-050-C300",
                    "Spiral Wound Gasket 50mm Class 300 Graphite",
                    "ASME B16.20 316L/Graphite with CS outer ring",
                    "ea",
                    Decimal("490.0000"),
                    Decimal("290.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "pressure_class": "Class 300", "filler": "Flexible Graphite"},
                    ["2 in 300# swg", "50mm cl300 spiral gasket"],
                ),
                (
                    "GSK-SW-080-C300",
                    "Spiral Wound Gasket 80mm Class 300 Graphite",
                    "ASME B16.20 316L/Graphite with CS outer ring",
                    "ea",
                    Decimal("740.0000"),
                    Decimal("440.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "pressure_class": "Class 300", "filler": "Flexible Graphite"},
                    ["3 in 300# swg", "80mm 300# spiral gasket"],
                ),
                (
                    "GSK-PT-025-C150",
                    "PTFE Envelope Gasket 25mm Class 150",
                    "Pure virgin PTFE chemical resistant envelope",
                    "ea",
                    Decimal("320.0000"),
                    Decimal("190.0000"),
                    Decimal("18.00"),
                    {"size": "25mm", "material": "PTFE", "pressure_class": "Class 150"},
                    ["1 in ptfe gasket", "25mm teflon gasket"],
                ),
                (
                    "GSK-PT-050-C150",
                    "PTFE Envelope Gasket 50mm Class 150",
                    "Pure virgin PTFE chemical resistant envelope",
                    "ea",
                    Decimal("540.0000"),
                    Decimal("320.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "material": "PTFE", "pressure_class": "Class 150"},
                    ["2 in ptfe gasket", "50mm teflon gasket"],
                ),
                (
                    "GSK-RJ-R24-SS",
                    "Ring Joint Gasket R-24 Octagonal Soft Iron",
                    "ASME B16.20 ring type joint soft iron",
                    "ea",
                    Decimal("1650.0000"),
                    Decimal("1050.0000"),
                    Decimal("18.00"),
                    {"ring_number": "R-24", "material": "Soft Iron"},
                    ["r-24 rjt gasket", "r24 ring joint gasket"],
                ),
                (
                    "GSK-RJ-R37-SS",
                    "Ring Joint Gasket R-37 Octagonal Soft Iron",
                    "ASME B16.20 ring type joint soft iron",
                    "ea",
                    Decimal("2450.0000"),
                    Decimal("1580.0000"),
                    Decimal("18.00"),
                    {"ring_number": "R-37", "material": "Soft Iron"},
                    ["r-37 rjt gasket", "r37 ring joint gasket"],
                ),
                (
                    "SEL-OR-050-VIT",
                    "Viton O-Ring 50mm ID x 5mm C/S",
                    "FKM 75 Shore A high temp fluorocarbon o-ring",
                    "pack",
                    Decimal("650.0000"),
                    Decimal("380.0000"),
                    Decimal("18.00"),
                    {"size": "50x5mm", "material": "Viton FKM"},
                    ["50mm viton o-ring", "fkm o-ring 50mm"],
                ),
                (
                    "SEL-OR-080-VIT",
                    "Viton O-Ring 80mm ID x 5mm C/S",
                    "FKM 75 Shore A high temp fluorocarbon o-ring",
                    "pack",
                    Decimal("980.0000"),
                    Decimal("580.0000"),
                    Decimal("18.00"),
                    {"size": "80x5mm", "material": "Viton FKM"},
                    ["80mm viton o-ring", "80x5 fkm ring"],
                ),
            ],
        ),
        (
            "Fasteners",
            [
                (
                    "FST-SB-M16-L080",
                    "Stud Bolt M16 x 80mm ASTM A193 B7 with 2H Nuts",
                    "Alloy steel high temp stud with 2 heavy hex nuts",
                    "set",
                    Decimal("180.0000"),
                    Decimal("110.0000"),
                    Decimal("18.00"),
                    {"thread": "M16", "length": "80mm", "grade": "B7/2H"},
                    ["m16x80 b7 stud", "m16 stud bolt 80mm"],
                ),
                (
                    "FST-SB-M16-L100",
                    "Stud Bolt M16 x 100mm ASTM A193 B7 with 2H Nuts",
                    "Alloy steel high temp stud with 2 heavy hex nuts",
                    "set",
                    Decimal("210.0000"),
                    Decimal("130.0000"),
                    Decimal("18.00"),
                    {"thread": "M16", "length": "100mm", "grade": "B7/2H"},
                    ["m16x100 b7 stud", "m16 stud bolt 100mm"],
                ),
                (
                    "FST-SB-M20-L100",
                    "Stud Bolt M20 x 100mm ASTM A193 B7 with 2H Nuts",
                    "Alloy steel high temp stud with 2 heavy hex nuts",
                    "set",
                    Decimal("290.0000"),
                    Decimal("180.0000"),
                    Decimal("18.00"),
                    {"thread": "M20", "length": "100mm", "grade": "B7/2H"},
                    ["m20x100 b7 stud", "m20 stud bolt 100mm"],
                ),
                (
                    "FST-SB-M20-L120",
                    "Stud Bolt M20 x 120mm ASTM A193 B7 with 2H Nuts",
                    "Alloy steel high temp stud with 2 heavy hex nuts",
                    "set",
                    Decimal("340.0000"),
                    Decimal("210.0000"),
                    Decimal("18.00"),
                    {"thread": "M20", "length": "120mm", "grade": "B7/2H"},
                    ["m20x120 b7 stud", "m20 stud bolt 120mm"],
                ),
                (
                    "FST-SB-M24-L140",
                    "Stud Bolt M24 x 140mm ASTM A193 B7 with 2H Nuts",
                    "Alloy steel high temp stud with 2 heavy hex nuts",
                    "set",
                    Decimal("580.0000"),
                    Decimal("360.0000"),
                    Decimal("18.00"),
                    {"thread": "M24", "length": "140mm", "grade": "B7/2H"},
                    ["m24x140 b7 stud", "m24 stud bolt 140mm"],
                ),
                (
                    "FST-SB-M24-L160",
                    "Stud Bolt M24 x 160mm ASTM A193 B7 with 2H Nuts",
                    "Alloy steel high temp stud with 2 heavy hex nuts",
                    "set",
                    Decimal("660.0000"),
                    Decimal("410.0000"),
                    Decimal("18.00"),
                    {"thread": "M24", "length": "160mm", "grade": "B7/2H"},
                    ["m24x160 b7 stud", "m24 stud bolt 160mm"],
                ),
                (
                    "FST-SS-M16-L080",
                    "Stainless Steel Stud Bolt M16 x 80mm B8M (SS316)",
                    "Austenitic stainless steel corrosion resistant stud set",
                    "set",
                    Decimal("480.0000"),
                    Decimal("310.0000"),
                    Decimal("18.00"),
                    {"thread": "M16", "length": "80mm", "grade": "B8M (SS316)"},
                    ["m16x80 ss316 stud", "ss316 m16 stud"],
                ),
                (
                    "FST-SS-M20-L100",
                    "Stainless Steel Stud Bolt M20 x 100mm B8M (SS316)",
                    "Austenitic stainless steel corrosion resistant stud set",
                    "set",
                    Decimal("780.0000"),
                    Decimal("510.0000"),
                    Decimal("18.00"),
                    {"thread": "M20", "length": "100mm", "grade": "B8M (SS316)"},
                    ["m20x100 ss316 stud", "ss316 m20 stud"],
                ),
                (
                    "FST-HX-M12-L040",
                    "Hex Head Bolt M12 x 40mm Grade 8.8 Galvanized",
                    "High tensile zinc plated hex bolt with nut",
                    "box",
                    Decimal("850.0000"),
                    Decimal("520.0000"),
                    Decimal("18.00"),
                    {"thread": "M12", "length": "40mm", "grade": "8.8"},
                    ["m12x40 hex bolt", "m12 galvanized bolt"],
                ),
                (
                    "FST-HX-M16-L050",
                    "Hex Head Bolt M16 x 50mm Grade 8.8 Galvanized",
                    "High tensile zinc plated hex bolt with nut",
                    "box",
                    Decimal("1250.0000"),
                    Decimal("780.0000"),
                    Decimal("18.00"),
                    {"thread": "M16", "length": "50mm", "grade": "8.8"},
                    ["m16x50 hex bolt", "m16 galvanized bolt"],
                ),
                (
                    "FST-NT-M16-2H",
                    "Heavy Hex Nut M16 ASTM A194 2H Plain",
                    "High temperature carbon steel heavy hex nut",
                    "box",
                    Decimal("450.0000"),
                    Decimal("270.0000"),
                    Decimal("18.00"),
                    {"thread": "M16", "grade": "2H"},
                    ["m16 2h nut", "m16 heavy hex nut"],
                ),
                (
                    "FST-NT-M20-2H",
                    "Heavy Hex Nut M20 ASTM A194 2H Plain",
                    "High temperature carbon steel heavy hex nut",
                    "box",
                    Decimal("680.0000"),
                    Decimal("420.0000"),
                    Decimal("18.00"),
                    {"thread": "M20", "grade": "2H"},
                    ["m20 2h nut", "m20 heavy hex nut"],
                ),
                (
                    "FST-WS-M16-FL",
                    "Flat Washer M16 Heavy Duty Hardened Steel",
                    "ASTM F436 hardened circular washer",
                    "box",
                    Decimal("280.0000"),
                    Decimal("160.0000"),
                    Decimal("18.00"),
                    {"size": "M16", "type": "Flat Washer"},
                    ["m16 flat washer", "m16 hardened washer"],
                ),
                (
                    "FST-WS-M20-FL",
                    "Flat Washer M20 Heavy Duty Hardened Steel",
                    "ASTM F436 hardened circular washer",
                    "box",
                    Decimal("390.0000"),
                    Decimal("230.0000"),
                    Decimal("18.00"),
                    {"size": "M20", "type": "Flat Washer"},
                    ["m20 flat washer", "m20 hardened washer"],
                ),
            ],
        ),
        (
            "Consumables",
            [
                (
                    "CNS-TS-500-PT",
                    "PTFE Thread Seal Tape Heavy Duty 12mm x 12m",
                    "High density gas-approved PTFE sealing tape",
                    "box",
                    Decimal("450.0000"),
                    Decimal("240.0000"),
                    Decimal("18.00"),
                    {"width": "12mm", "material": "PTFE"},
                    ["teflon tape", "thread seal tape"],
                ),
                (
                    "CNS-LP-250-CP",
                    "Copper Anti-Seize Paste 500g Tub",
                    "High temperature lubricant and anti-seize compound",
                    "ea",
                    Decimal("1250.0000"),
                    Decimal("780.0000"),
                    Decimal("18.00"),
                    {"temp_range": "-30C to 1100C", "type": "Anti-Seize"},
                    ["copper anti seize", "copper paste 500g"],
                ),
                (
                    "CNS-FP-050-PL",
                    "Plastic Flange Protector Cap 50mm (2 in)",
                    "Protective snap-fit yellow polyethylene flange cover",
                    "pack",
                    Decimal("320.0000"),
                    Decimal("160.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "type": "Flange Protector"},
                    ["2 in flange protector", "50mm plastic flange cover"],
                ),
                (
                    "CNS-FP-080-PL",
                    "Plastic Flange Protector Cap 80mm (3 in)",
                    "Protective snap-fit yellow polyethylene flange cover",
                    "pack",
                    Decimal("480.0000"),
                    Decimal("240.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "type": "Flange Protector"},
                    ["3 in flange protector", "80mm plastic flange cover"],
                ),
                (
                    "CNS-PC-050-CS",
                    "Cushioned Pipe Clamp 50mm Zinc Plated",
                    "Rubber lined heavy duty sound absorbing pipe clamp",
                    "ea",
                    Decimal("290.0000"),
                    Decimal("160.0000"),
                    Decimal("18.00"),
                    {"size": "50mm", "type": "Pipe Clamp"},
                    ["50mm pipe clamp", "2 in cushioned clamp"],
                ),
                (
                    "CNS-PC-080-CS",
                    "Cushioned Pipe Clamp 80mm Zinc Plated",
                    "Rubber lined heavy duty sound absorbing pipe clamp",
                    "ea",
                    Decimal("420.0000"),
                    Decimal("240.0000"),
                    Decimal("18.00"),
                    {"size": "80mm", "type": "Pipe Clamp"},
                    ["80mm pipe clamp", "3 in cushioned clamp"],
                ),
                (
                    "CNS-GS-310-SI",
                    "High-Temp RTV Silicone Gasket Maker 310ml",
                    "Sensor safe red silicone sealant for exhaust & pump flanges",
                    "ea",
                    Decimal("680.0000"),
                    Decimal("390.0000"),
                    Decimal("18.00"),
                    {"volume": "310ml", "type": "RTV Silicone"},
                    ["red rtv silicone", "gasket maker 310ml"],
                ),
                (
                    "CNS-DG-500-CL",
                    "Industrial Citrus Degreaser Spray 500ml",
                    "Heavy duty solvent degreaser for pipe thread prep",
                    "ea",
                    Decimal("520.0000"),
                    Decimal("290.0000"),
                    Decimal("18.00"),
                    {"volume": "500ml", "type": "Degreaser"},
                    ["citrus degreaser", "pipe cleaner spray"],
                ),
            ],
        ),
    ]

    for cat_name, product_list in categories:
        for sku, name, desc, unit, price, cost, tax, attrs, aliases in product_list:
            prod = db.execute(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id, CatalogProduct.sku == sku
                )
            ).scalar_one_or_none()
            if not prod:
                prod = CatalogProduct(
                    organization_id=org.id,
                    sku=sku,
                    name=name,
                    description=desc,
                    category=cat_name,
                    manufacturer="ForgeFlow Premier Components",
                    manufacturer_part_number=f"FF-{sku}",
                    base_unit=unit,
                    sell_price=price,
                    unit_cost=cost,
                    tax_rate_percent=tax,
                    stock_status="in_stock",
                    attributes_json=attrs,
                    is_active=True,
                    created_by=catalog_mgr.id,
                    version=1,
                )
                db.add(prod)
                db.flush()

            # Seed Aliases
            for alias_str in aliases:
                norm = normalize_text(alias_str)
                existing_al = db.execute(
                    select(CatalogAlias).where(
                        CatalogAlias.product_id == prod.id,
                        CatalogAlias.normalized_alias == norm,
                    )
                ).scalar_one_or_none()
                if not existing_al:
                    al = CatalogAlias(
                        organization_id=org.id,
                        product_id=prod.id,
                        alias_text=alias_str,
                        normalized_alias=norm,
                        created_by=catalog_mgr.id,
                    )
                    db.add(al)

    # 7b. Seed Standard Industrial Catalog Products and Aliases (Adapted from upstream RFQ normalizer)
    fixture_path = os.path.join(
        os.path.dirname(__file__), "..", "..", "fixtures", "catalog_standard_industrial.json"
    )
    if os.path.exists(fixture_path):
        with open(fixture_path, "r", encoding="utf-8") as f:
            upstream_items = json.load(f)

        for item in upstream_items:
            sku = item["sku"]
            prod = db.execute(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id, CatalogProduct.sku == sku
                )
            ).scalar_one_or_none()
            if not prod:
                cat = item.get("category", "General").capitalize()
                price = Decimal("1250.0000")
                cost = Decimal("850.0000")
                if "pipe" in cat.lower():
                    price = Decimal("2100.0000")
                    cost = Decimal("1400.0000")
                elif "bolt" in sku.lower():
                    price = Decimal("85.0000")
                    cost = Decimal("45.0000")
                elif "valv" in sku.lower():
                    price = Decimal("3400.0000")
                    cost = Decimal("2200.0000")

                prod = CatalogProduct(
                    organization_id=org.id,
                    sku=sku,
                    name=item["name"],
                    description=f"Standard industrial {item['name']} per national/ISO standards",
                    category=cat,
                    manufacturer="Standard Industrial Supplies",
                    manufacturer_part_number=f"STD-{sku}",
                    base_unit=item.get("uom", "ea"),
                    sell_price=price,
                    unit_cost=cost,
                    tax_rate_percent=Decimal("18.00"),
                    stock_status="in_stock",
                    attributes_json=item.get("attributes", {}),
                    is_active=True,
                    created_by=catalog_mgr.id,
                    version=1,
                )
                db.add(prod)
                db.flush()

            for alias_str in item.get("aliases", []):
                norm = normalize_text(alias_str)
                existing_al = db.execute(
                    select(CatalogAlias).where(
                        CatalogAlias.product_id == prod.id,
                        CatalogAlias.normalized_alias == norm,
                    )
                ).scalar_one_or_none()
                if not existing_al:
                    al = CatalogAlias(
                        organization_id=org.id,
                        product_id=prod.id,
                        alias_text=alias_str,
                        normalized_alias=norm,
                        created_by=catalog_mgr.id,
                    )
                    db.add(al)

    # 8. Seed Activities
    # Add representative timeline events for accounts and opportunities
    seed_activities = [
        (
            "account",
            account_map["Apex Heavy Engineering Ltd."].id,
            "account_created",
            "Account 'Apex Heavy Engineering Ltd.' created during onboarding",
            sales_rep.id,
            now - timedelta(days=60),
        ),
        (
            "account",
            account_map["Vanguard Fluid Systems Pvt Ltd."].id,
            "account_created",
            "Account 'Vanguard Fluid Systems Pvt Ltd.' created from trade fair lead",
            sales_rep.id,
            now - timedelta(days=45),
        ),
        (
            "opportunity",
            opp_map["Offshore Piping Replacement Batch 1"].id,
            "opportunity_created",
            "Opportunity 'Offshore Piping Replacement Batch 1' (₹750,000.00) created",
            sales_rep.id,
            now - timedelta(days=25),
        ),
        (
            "opportunity",
            opp_map["Offshore Piping Replacement Batch 1"].id,
            "stage_change",
            "Stage changed from 'lead' to 'qualified'",
            sales_rep.id,
            now - timedelta(days=20),
        ),
        (
            "opportunity",
            opp_map["Offshore Piping Replacement Batch 1"].id,
            "stage_change",
            "Stage changed from 'qualified' to 'solutioning'",
            sales_rep.id,
            now - timedelta(days=15),
        ),
        (
            "opportunity",
            opp_map["Refinery Turnaround Fastener Replenishment"].id,
            "stage_change",
            "Stage marked 'won' with executive PO approval override",
            sales_manager.id,
            now - timedelta(days=2),
        ),
        (
            "opportunity",
            opp_map["Subsea Manifold Gasket Standardization"].id,
            "stage_change",
            "Stage marked 'lost'. Reason: price",
            sales_rep.id,
            now - timedelta(days=12),
        ),
    ]

    for etype, eid, ev_type, summ, actor_id, occ_at in seed_activities:
        act = (
            db.execute(
                select(Activity).where(
                    Activity.organization_id == org.id,
                    Activity.entity_type == etype,
                    Activity.entity_id == eid,
                    Activity.event_type == ev_type,
                    Activity.summary == summ,
                )
            )
            .scalars()
            .first()
        )
        if not act:
            act = Activity(
                organization_id=org.id,
                actor_user_id=actor_id,
                entity_type=etype,
                entity_id=eid,
                event_type=ev_type,
                summary=summ,
                metadata_json={"seeded": True},
                occurred_at=occ_at,
            )
            db.add(act)

    db.commit()

    # 9. Phase 3 Synthetic Demo RFQs
    # Idempotently seed 3 coherent RFQs linked to existing Phase 2 accounts and opportunities
    sales_rep_membership = db.execute(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == sales_rep.id,
            OrganizationMembership.organization_id == org.id,
        )
    ).scalar_one()

    rfq_ctx = AuthenticatedContext(
        user=sales_rep,
        organization=org,
        membership=sales_rep_membership,
        permissions=get_role_permissions(Role.SALES_REP),
    )

    demo_rfqs: list[dict[str, Any]] = [
        # RFQ 1: Mostly Exact Match (~85% exact matches, ready for bulk acceptance)
        {
            "title": "Turnaround Piping & Valves Batch A",
            "opp_name": "Offshore Piping Replacement Batch 1",
            "account_name": "Bharat Petrochem Equipment Corp.",
            "customer_reference": "BPEC-RFQ-2026-901",
            "filename": "turnaround_piping_batch_a.csv",
            "csv_content": """Item Description,Quantity,UOM,Customer Ref
GI Pipe 15mm Class A,50,mtr,CL-A-15
GI Pipe 20mm Class A,40,mtr,CL-A-20
GI Pipe 25mm Class A,30,mtr,CL-A-25
GI Pipe 32mm Class A,20,mtr,CL-A-32
GI Pipe 40mm Class A,15,mtr,CL-A-40
GI Pipe 50mm Class A,10,mtr,CL-A-50
Brass Ball Valve Screwed 15mm,10,nos,VLV-BR-15
Brass Ball Valve Screwed 20mm,8,nos,VLV-BR-20
Brass Ball Valve Screwed 25mm,12,nos,VLV-BR-25
GI 90 Degree Elbow 20mm Class B,25,nos,FIT-ELB-20
PTFE Thread Seal Tape 12mm x 10m,50,roll,CONS-TAPE
MS Hex Bolt M12x50,100,nos,FAST-B12-50
""",
            "header_mapping": {
                "description": "Item Description",
                "quantity": "Quantity",
                "unit": "UOM",
                "manufacturer_part_number": "Customer Ref",
            },
        },
        # RFQ 2: Needs Review (Ambiguous multi-candidate ties, missing grade/class)
        {
            "title": "Subsea Wellhead Fasteners & Valves Package",
            "opp_name": "Cryogenic Flange & Gasket Overhaul",
            "account_name": "Vanguard Fluid Systems Pvt Ltd.",
            "customer_reference": "VFS-RFQ-8812",
            "filename": "subsea_wellhead_fasteners.csv",
            "csv_content": """Item Description,Quantity,UOM,Notes
MS Hex Bolt M12x50,200,nos,Standard hex bolt missing grade
MS Hex Bolt M16x60,150,nos,Hex bolt missing grade specification
Brass Ball Valve Screwed 50mm,12,nos,Isolation valve
GI Pipe 15mm,50,mtr,Piping line missing class
PVC Pipe 20mm,30,mtr,Drainage line missing class
MS Plain Washer M12,300,nos,Standard plain washer
Special High Temp Viton O-Ring 50mm,20,nos,Viton seal ring
GI Socket Coupling 25mm Class B,40,nos,Fitting coupling
""",
            "header_mapping": {
                "description": "Item Description",
                "quantity": "Quantity",
                "unit": "UOM",
                "notes": "Notes",
            },
        },
        # RFQ 3: Blocking / Edge-Case (Contains invalid line with negative quantity and unresolvable item)
        {
            "title": "Emergency Plant Shutdown Requisition",
            "opp_name": "High-Pressure Valve Assembly Package",
            "account_name": "Apex Heavy Engineering Ltd.",
            "customer_reference": "APEX-EMERG-449",
            "filename": "emergency_shutdown_req.csv",
            "csv_content": """Item Description,Quantity,UOM,Notes
GI Pipe 25mm Class A,20,mtr,Urgent bypass line
Brass Gate Valve Screwed 25mm,5,nos,Isolation gate valve
Defective Replacement Impeller,-10,nos,Invalid negative quantity line
Custom High Pressure Titanium Flange,1,ea,Item completely absent from catalog
PTFE Thread Seal Tape 12mm x 10m,20,roll,Thread sealant
""",
            "header_mapping": {
                "description": "Item Description",
                "quantity": "Quantity",
                "unit": "UOM",
                "notes": "Notes",
            },
        },
    ]

    for rfq_info in demo_rfqs:
        existing_rfq = db.execute(
            select(RFQ).where(
                RFQ.organization_id == org.id,
                RFQ.title == rfq_info["title"],
            )
        ).scalar_one_or_none()

        if not existing_rfq:
            opp = opp_map[rfq_info["opp_name"]]
            acc = account_map[rfq_info["account_name"]]

            payload = RFQImportRequest(
                account_id=acc.id,
                opportunity_id=opp.id,
                title=rfq_info["title"],
                customer_reference=rfq_info["customer_reference"],
                filename=rfq_info["filename"],
                csv_content=rfq_info["csv_content"],
                header_mapping=rfq_info["header_mapping"],
                duplicate_override=True,
            )
            import_rfq_csv(db, rfq_ctx, payload)

    # 10. Seed Phase 4 Quotation Fixtures
    seed_demo_quotes(db, org, sales_rep, account_map, opp_map)

    # 11. Seed Phase 5 Proposal & Approval Fixtures
    seed_demo_proposals(db, org, sales_rep, sales_manager)

    logger.info("Successfully seeded Phase 2, 3, 4 & 5 synthetic demo data!")


def seed_demo_quotes(
    db: Session,
    org: Organization,
    sales_rep: User,
    account_map: dict[str, Account],
    opp_map: dict[str, Opportunity],
) -> None:
    policy_config = QuotePolicyConfig.from_dict(org.settings_json)

    # Pre-seed Quote 1: High value (>₹500,000) & line discount >5% (exercising both policies), Costed
    q1 = db.scalar(
        select(Quote).where(Quote.organization_id == org.id, Quote.quote_number == "QT-2026-0001")
    )
    if not q1:
        acc1 = account_map.get("Bharat Petrochem Equipment Corp.")
        opp1 = opp_map.get("Offshore Piping Replacement Batch 1")
        if acc1 and opp1:
            prod1 = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id,
                    CatalogProduct.sku == "VALV-BALL-BR-50",
                )
            )
            prod2 = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id,
                    CatalogProduct.sku == "PIPE-GI-CL-A-50",
                )
            )

            rfq1 = db.scalar(
                select(RFQ).where(
                    RFQ.organization_id == org.id,
                    RFQ.opportunity_id == opp1.id,
                )
            )

            now = datetime.now(timezone.utc)
            q1 = Quote(
                organization_id=org.id,
                quote_number="QT-2026-0001",
                rfq_id=rfq1.id if rfq1 else None,
                opportunity_id=opp1.id,
                account_id=acc1.id,
                status="draft",
                created_by=sales_rep.id,
                version=1,
                notes="Offshore piping high-pressure package with bulk valve discount.",
                payment_terms="Net 30",
                delivery_terms="Ex-Works Mumbai",
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=3),
            )
            db.add(q1)
            db.flush()

            calc_inputs = [
                QuoteLineInput(
                    line_id=str(uuid.uuid4()),
                    line_order=1,
                    sku=prod1.sku if prod1 else "VALV-BALL-BR-50",
                    name=prod1.name if prod1 else "Brass Ball Valve Screwed 50mm",
                    description=(
                        prod1.description
                        if (prod1 and prod1.description)
                        else "Brass Ball Valve Screwed 50mm"
                    ),
                    unit="nos",
                    quantity=Decimal("200.0000"),
                    unit_price=Decimal("2800.00"),
                    discount_percent=Decimal("8.00"),
                    tax_rate_percent=Decimal("18.00"),
                    unit_cost=prod1.unit_cost
                    if (prod1 and prod1.unit_cost)
                    else Decimal("2000.00"),
                    catalog_product_id=str(prod1.id) if prod1 else None,
                ),
                QuoteLineInput(
                    line_id=str(uuid.uuid4()),
                    line_order=2,
                    sku=prod2.sku if prod2 else "PIPE-GI-CL-A-50",
                    name=prod2.name if prod2 else "GI Pipe 50mm Class A",
                    description=(
                        prod2.description
                        if (prod2 and prod2.description)
                        else "GI Pipe 50mm Class A"
                    ),
                    unit="mtr",
                    quantity=Decimal("50.0000"),
                    unit_price=Decimal("850.00"),
                    discount_percent=Decimal("0.00"),
                    tax_rate_percent=Decimal("18.00"),
                    unit_cost=prod2.unit_cost if (prod2 and prod2.unit_cost) else Decimal("620.00"),
                    catalog_product_id=str(prod2.id) if prod2 else None,
                ),
            ]

            calc_res = calculate_quote(calc_inputs, currency="INR")
            policy_res = evaluate_quote_policies(calc_res, policy_config)
            calc_snapshot = calc_res.to_snapshot_json()
            calc_snapshot["policy_evaluation"] = policy_res.to_dict()

            rev1 = QuoteRevision(
                organization_id=org.id,
                quote_id=q1.id,
                revision_number=1,
                parent_revision_id=None,
                currency="INR",
                snapshot_json={
                    "account_id": str(acc1.id),
                    "opportunity_id": str(opp1.id),
                    "terms": {"payment_terms": "Net 30", "delivery_terms": "Ex-Works Mumbai"},
                },
                calculation_snapshot_json=calc_snapshot,
                calculator_version=calc_res.calculator_version,
                input_fingerprint=calc_res.input_fingerprint,
                created_by=sales_rep.id,
                commit_reason="Initial high-value turnaround quote draft",
                is_committed=False,
                version=1,
                created_at=now - timedelta(days=3),
                updated_at=now - timedelta(days=3),
            )
            db.add(rev1)
            db.flush()

            prod_map_1 = {1: prod1, 2: prod2}
            for lc in calc_res.lines:
                prod = prod_map_1.get(lc.line_order)
                rline = QuoteRevisionLine(
                    organization_id=org.id,
                    revision_id=rev1.id,
                    line_order=lc.line_order,
                    catalog_product_id=prod.id if prod else None,
                    sku=lc.sku,
                    product_name=lc.name,
                    description=lc.description,
                    unit=lc.unit,
                    quantity=lc.quantity,
                    unit_price=lc.unit_price,
                    discount_percent=lc.discount_percent,
                    tax_rate_percent=lc.tax_rate_percent,
                    unit_cost=lc.unit_cost,
                    gross_amount=lc.gross_amount,
                    discount_amount=lc.discount_amount,
                    taxable_amount=lc.taxable_amount,
                    tax_amount=lc.tax_amount,
                    line_total=lc.line_total,
                    line_cost=lc.line_cost,
                    line_gross_profit=lc.line_gross_profit,
                    margin_percent=lc.margin_percent,
                    created_at=now - timedelta(days=3),
                    updated_at=now - timedelta(days=3),
                )
                db.add(rline)

            q1.current_revision_id = rev1.id
            db.flush()

    # Pre-seed Quote 2: Standard value (<500k), Uncosted items (testing null margin isolation), No triggers
    q2 = db.scalar(
        select(Quote).where(Quote.organization_id == org.id, Quote.quote_number == "QT-2026-0002")
    )
    if not q2:
        acc2 = account_map.get("Apex Heavy Engineering Ltd.")
        opp2 = opp_map.get("High-Pressure Valve Assembly Package")
        if acc2 and opp2:
            prod3 = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id,
                    CatalogProduct.sku == "FAST-BOLT-M12-50",
                )
            )
            prod4 = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id,
                    CatalogProduct.sku == "CONS-TAPE-PTFE-12",
                )
            )

            now = datetime.now(timezone.utc)
            q2 = Quote(
                organization_id=org.id,
                quote_number="QT-2026-0002",
                rfq_id=None,
                opportunity_id=opp2.id,
                account_id=acc2.id,
                status="draft",
                created_by=sales_rep.id,
                version=1,
                notes="Standard replacement fasteners package with uncosted consumables.",
                payment_terms="Net 45",
                delivery_terms="Door Delivery Pune",
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            )
            db.add(q2)
            db.flush()

            calc_inputs_2 = [
                QuoteLineInput(
                    line_id=str(uuid.uuid4()),
                    line_order=1,
                    sku=prod3.sku if prod3 else "FAST-BOLT-M12-50",
                    name=prod3.name if prod3 else "MS Hex Bolt M12x50",
                    description=(
                        prod3.description if (prod3 and prod3.description) else "MS Hex Bolt M12x50"
                    ),
                    unit="nos",
                    quantity=Decimal("100.0000"),
                    unit_price=Decimal("45.00"),
                    discount_percent=Decimal("0.00"),
                    tax_rate_percent=Decimal("18.00"),
                    unit_cost=None,
                    catalog_product_id=str(prod3.id) if prod3 else None,
                ),
                QuoteLineInput(
                    line_id=str(uuid.uuid4()),
                    line_order=2,
                    sku=prod4.sku if prod4 else "CONS-TAPE-PTFE-12",
                    name=prod4.name if prod4 else "PTFE Thread Seal Tape 12mm x 10m",
                    description=(
                        prod4.description
                        if (prod4 and prod4.description)
                        else "PTFE Thread Seal Tape 12mm x 10m"
                    ),
                    unit="roll",
                    quantity=Decimal("50.0000"),
                    unit_price=Decimal("65.00"),
                    discount_percent=Decimal("2.00"),
                    tax_rate_percent=Decimal("18.00"),
                    unit_cost=None,
                    catalog_product_id=str(prod4.id) if prod4 else None,
                ),
            ]

            calc_res_2 = calculate_quote(calc_inputs_2, currency="INR")
            policy_res_2 = evaluate_quote_policies(calc_res_2, policy_config)
            calc_snapshot_2 = calc_res_2.to_snapshot_json()
            calc_snapshot_2["policy_evaluation"] = policy_res_2.to_dict()

            rev2 = QuoteRevision(
                organization_id=org.id,
                quote_id=q2.id,
                revision_number=1,
                parent_revision_id=None,
                currency="INR",
                snapshot_json={
                    "account_id": str(acc2.id),
                    "opportunity_id": str(opp2.id),
                    "terms": {"payment_terms": "Net 45", "delivery_terms": "Door Delivery Pune"},
                },
                calculation_snapshot_json=calc_snapshot_2,
                calculator_version=calc_res_2.calculator_version,
                input_fingerprint=calc_res_2.input_fingerprint,
                created_by=sales_rep.id,
                commit_reason="Initial standard fastener quote draft",
                is_committed=False,
                version=1,
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            )
            db.add(rev2)
            db.flush()

            prod_map_2 = {1: prod3, 2: prod4}
            for lc in calc_res_2.lines:
                prod = prod_map_2.get(lc.line_order)
                rline = QuoteRevisionLine(
                    organization_id=org.id,
                    revision_id=rev2.id,
                    line_order=lc.line_order,
                    catalog_product_id=prod.id if prod else None,
                    sku=lc.sku,
                    product_name=lc.name,
                    description=lc.description,
                    unit=lc.unit,
                    quantity=lc.quantity,
                    unit_price=lc.unit_price,
                    discount_percent=lc.discount_percent,
                    tax_rate_percent=lc.tax_rate_percent,
                    unit_cost=lc.unit_cost,
                    gross_amount=lc.gross_amount,
                    discount_amount=lc.discount_amount,
                    taxable_amount=lc.taxable_amount,
                    tax_amount=lc.tax_amount,
                    line_total=lc.line_total,
                    line_cost=lc.line_cost,
                    line_gross_profit=lc.line_gross_profit,
                    margin_percent=lc.margin_percent,
                    created_at=now - timedelta(days=1),
                    updated_at=now - timedelta(days=1),
                )
                db.add(rline)

            q2.current_revision_id = rev2.id
            db.flush()

    # Pre-seed Quote 3: Initial quote pending managerial approval
    q3 = db.scalar(
        select(Quote).where(Quote.organization_id == org.id, Quote.quote_number == "QT-2026-0003")
    )
    if not q3:
        acc1 = account_map.get("Bharat Petrochem Equipment Corp.")
        opp1 = opp_map.get("Offshore Piping Replacement Batch 1")
        if acc1 and opp1:
            prod1 = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id,
                    CatalogProduct.sku == "VALV-BALL-BR-50",
                )
            )

            now = datetime.now(timezone.utc)
            q3 = Quote(
                organization_id=org.id,
                quote_number="QT-2026-0003",
                rfq_id=None,
                opportunity_id=opp1.id,
                account_id=acc1.id,
                status="pending_approval",
                created_by=sales_rep.id,
                version=1,
                notes="Standard valve package with special discount awaiting managerial sign-off.",
                payment_terms="Net 30",
                delivery_terms="Ex-Works Mumbai",
                created_at=now - timedelta(days=2),
                updated_at=now - timedelta(days=2),
            )
            db.add(q3)
            db.flush()

            calc_inputs_3 = [
                QuoteLineInput(
                    line_id=str(uuid.uuid4()),
                    line_order=1,
                    sku=prod1.sku if prod1 else "VALV-BALL-BR-50",
                    name=prod1.name if prod1 else "Forged Brass Ball Valve 50mm",
                    description=(
                        prod1.description
                        if (prod1 and prod1.description)
                        else "Forged Brass Ball Valve 50mm"
                    ),
                    unit="nos",
                    quantity=Decimal("50.0000"),
                    unit_price=Decimal("1200.00"),
                    discount_percent=Decimal("8.00"),
                    tax_rate_percent=Decimal("18.00"),
                    unit_cost=Decimal("850.00"),
                    catalog_product_id=str(prod1.id) if prod1 else None,
                ),
            ]

            calc_res_3 = calculate_quote(calc_inputs_3, currency="INR")
            policy_res_3 = evaluate_quote_policies(calc_res_3, policy_config)
            calc_snapshot_3 = calc_res_3.to_snapshot_json()
            calc_snapshot_3["policy_evaluation"] = policy_res_3.to_dict()

            rev3 = QuoteRevision(
                organization_id=org.id,
                quote_id=q3.id,
                revision_number=1,
                parent_revision_id=None,
                currency="INR",
                snapshot_json={
                    "account_id": str(acc1.id),
                    "opportunity_id": str(opp1.id),
                    "terms": {"payment_terms": "Net 30", "delivery_terms": "Ex-Works Mumbai"},
                },
                calculation_snapshot_json=calc_snapshot_3,
                calculator_version=calc_res_3.calculator_version,
                input_fingerprint=calc_res_3.input_fingerprint,
                created_by=sales_rep.id,
                commit_reason="Initial quote submission requiring approval",
                is_committed=False,
                version=1,
                created_at=now - timedelta(days=2),
                updated_at=now - timedelta(days=2),
            )
            db.add(rev3)
            db.flush()

            for lc in calc_res_3.lines:
                rline = QuoteRevisionLine(
                    organization_id=org.id,
                    revision_id=rev3.id,
                    line_order=lc.line_order,
                    catalog_product_id=prod1.id if prod1 else None,
                    sku=lc.sku,
                    product_name=lc.name,
                    description=lc.description,
                    unit=lc.unit,
                    quantity=lc.quantity,
                    unit_price=lc.unit_price,
                    discount_percent=lc.discount_percent,
                    tax_rate_percent=lc.tax_rate_percent,
                    unit_cost=lc.unit_cost,
                    gross_amount=lc.gross_amount,
                    discount_amount=lc.discount_amount,
                    taxable_amount=lc.taxable_amount,
                    tax_amount=lc.tax_amount,
                    line_total=lc.line_total,
                    line_cost=lc.line_cost,
                    line_gross_profit=lc.line_gross_profit,
                    margin_percent=lc.margin_percent,
                    created_at=now - timedelta(days=2),
                    updated_at=now - timedelta(days=2),
                )
                db.add(rline)

            q3.current_revision_id = rev3.id
            db.flush()

    # Pre-seed Quote 4: Approved Quote with committed revision and existing customer delivery record
    q4 = db.scalar(
        select(Quote).where(Quote.organization_id == org.id, Quote.quote_number == "QT-2026-0004")
    )
    if not q4:
        acc4 = account_map.get("Delta Valve & Automation Technologies")
        opp4 = opp_map.get("Boiler Feedwater Control Valve Retrofit")
        if acc4 and opp4:
            prod_valve = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id,
                    CatalogProduct.sku == "VALV-BALL-BR-50",
                )
            )
            prod_seal = db.scalar(
                select(CatalogProduct).where(
                    CatalogProduct.organization_id == org.id,
                    CatalogProduct.sku == "CONS-TAPE-PTFE-12",
                )
            )

            now = datetime.now(timezone.utc)
            q4 = Quote(
                organization_id=org.id,
                quote_number="QT-2026-0004",
                rfq_id=None,
                opportunity_id=opp4.id,
                account_id=acc4.id,
                status="approved",
                created_by=sales_rep.id,
                version=1,
                notes="Approved commercial quotation for industrial valve retrofit with standard delivery terms.",
                payment_terms="Net 30 Days",
                delivery_terms="Ex-Works Chennai",
                valid_until=(now + timedelta(days=30)).date(),
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            )
            db.add(q4)
            db.flush()

            calc_inputs_4 = [
                QuoteLineInput(
                    line_id=str(uuid.uuid4()),
                    line_order=1,
                    sku=prod_valve.sku if prod_valve else "VALV-BALL-BR-50",
                    name=prod_valve.name if prod_valve else "Forged Brass Ball Valve 50mm",
                    description=(
                        prod_valve.description
                        if (prod_valve and prod_valve.description)
                        else "Forged Brass Ball Valve 50mm PN25"
                    ),
                    unit="nos",
                    quantity=Decimal("20.0000"),
                    unit_price=Decimal("1200.00"),
                    discount_percent=Decimal("0.00"),
                    tax_rate_percent=Decimal("18.00"),
                    unit_cost=Decimal("850.00"),
                    catalog_product_id=str(prod_valve.id) if prod_valve else None,
                ),
                QuoteLineInput(
                    line_id=str(uuid.uuid4()),
                    line_order=2,
                    sku=prod_seal.sku if prod_seal else "CONS-TAPE-PTFE-12",
                    name=prod_seal.name if prod_seal else "PTFE Thread Seal Tape",
                    description=(
                        prod_seal.description
                        if (prod_seal and prod_seal.description)
                        else "PTFE Thread Seal Tape 12mm x 10m"
                    ),
                    unit="rolls",
                    quantity=Decimal("50.0000"),
                    unit_price=Decimal("45.00"),
                    discount_percent=Decimal("0.00"),
                    tax_rate_percent=Decimal("18.00"),
                    unit_cost=Decimal("25.00"),
                    catalog_product_id=str(prod_seal.id) if prod_seal else None,
                ),
            ]

            calc_res_4 = calculate_quote(calc_inputs_4, currency="INR")
            calc_snapshot_4 = calc_res_4.to_snapshot_json()

            rev4 = QuoteRevision(
                organization_id=org.id,
                quote_id=q4.id,
                revision_number=1,
                parent_revision_id=None,
                currency="INR",
                snapshot_json={
                    "account_id": str(acc4.id),
                    "opportunity_id": str(opp4.id),
                    "terms": {"payment_terms": "Net 30 Days", "delivery_terms": "Ex-Works Chennai"},
                },
                calculation_snapshot_json=calc_snapshot_4,
                calculator_version=calc_res_4.calculator_version,
                input_fingerprint=calc_res_4.input_fingerprint,
                created_by=sales_rep.id,
                commit_reason="Initial quote approved by sales management",
                is_committed=True,
                version=1,
                created_at=now - timedelta(days=1),
                updated_at=now - timedelta(days=1),
            )
            db.add(rev4)
            db.flush()

            for lc in calc_res_4.lines:
                prod_fk = (
                    prod_valve.id
                    if (lc.sku == "VALV-BALL-BR-50" and prod_valve)
                    else (prod_seal.id if prod_seal else None)
                )
                rline = QuoteRevisionLine(
                    organization_id=org.id,
                    revision_id=rev4.id,
                    line_order=lc.line_order,
                    catalog_product_id=prod_fk,
                    sku=lc.sku,
                    product_name=lc.name,
                    description=lc.description,
                    unit=lc.unit,
                    quantity=lc.quantity,
                    unit_price=lc.unit_price,
                    discount_percent=lc.discount_percent,
                    tax_rate_percent=lc.tax_rate_percent,
                    unit_cost=lc.unit_cost,
                    gross_amount=lc.gross_amount,
                    discount_amount=lc.discount_amount,
                    taxable_amount=lc.taxable_amount,
                    tax_amount=lc.tax_amount,
                    line_total=lc.line_total,
                    line_cost=lc.line_cost,
                    line_gross_profit=lc.line_gross_profit,
                    margin_percent=lc.margin_percent,
                    created_at=now - timedelta(days=1),
                    updated_at=now - timedelta(days=1),
                )
                db.add(rline)

            q4.current_revision_id = rev4.id
            db.flush()

            # Pre-seed sample customer delivery record
            sample_delivery = QuoteCustomerDelivery(
                organization_id=org.id,
                quote_id=q4.id,
                revision_id=rev4.id,
                exported_by_user_id=sales_rep.id,
                export_type="pdf",
                sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                recipient_email="suresh.r@deltavalve.example",
                watermarked=False,
                created_at=now - timedelta(hours=3),
            )
            db.add(sample_delivery)
            db.flush()

    db.commit()


def seed_demo_proposals(
    db: Session,
    org: Organization,
    sales_rep: User,
    sales_manager: User,
) -> None:
    sales_mem = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.user_id == sales_rep.id,
        )
    )
    mgr_mem = db.scalar(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == org.id,
            OrganizationMembership.user_id == sales_manager.id,
        )
    )
    if not sales_mem or not mgr_mem:
        return

    sales_ctx = AuthenticatedContext(
        user=sales_rep,
        organization=org,
        membership=sales_mem,
        permissions=get_role_permissions(Role.SALES_REP),
    )
    mgr_ctx = AuthenticatedContext(
        user=sales_manager,
        organization=org,
        membership=mgr_mem,
        permissions=get_role_permissions(Role.SALES_MANAGER),
    )

    q1 = db.scalar(
        select(Quote).where(Quote.organization_id == org.id, Quote.quote_number == "QT-2026-0001")
    )
    q2 = db.scalar(
        select(Quote).where(Quote.organization_id == org.id, Quote.quote_number == "QT-2026-0002")
    )

    # 1. Draft Proposal on QT-2026-0001
    if (
        q1
        and q1.current_revision
        and q1.current_revision.lines
        and q1.current_revision_id is not None
    ):
        existing_draft = db.scalar(
            select(QuoteChangeProposal).where(
                QuoteChangeProposal.organization_id == org.id,
                QuoteChangeProposal.quote_id == q1.id,
                QuoteChangeProposal.status == "draft",
            )
        )
        if not existing_draft:
            line = q1.current_revision.lines[0]
            create_proposal(
                db=db,
                ctx=sales_ctx,
                quote_id=q1.id,
                payload=CreateProposalRequest(
                    quote_id=q1.id,
                    base_revision_id=q1.current_revision_id,
                    title="Draft Line Discount Optimization",
                    justification="Exploring competitive volume discount for valve line.",
                    operations=[
                        ProposalOperationSchema(
                            type="set_line_discount_percent",
                            target_line_id=line.id,
                            value="6.50",
                        )
                    ],
                ),
            )

    # 2. Pending Review Proposal on QT-2026-0002
    if (
        q2
        and q2.current_revision
        and q2.current_revision.lines
        and q2.current_revision_id is not None
    ):
        existing_pending = db.scalar(
            select(QuoteChangeProposal).where(
                QuoteChangeProposal.organization_id == org.id,
                QuoteChangeProposal.quote_id == q2.id,
                QuoteChangeProposal.status == "pending_review",
            )
        )
        if not existing_pending:
            line2 = q2.current_revision.lines[0]
            prop = create_proposal(
                db=db,
                ctx=sales_ctx,
                quote_id=q2.id,
                payload=CreateProposalRequest(
                    quote_id=q2.id,
                    base_revision_id=q2.current_revision_id,
                    title="Bulk Fasteners Package Discount",
                    justification="Special pricing for annual maintenance contract volume commitment.",
                    operations=[
                        ProposalOperationSchema(
                            type="set_line_discount_percent",
                            target_line_id=line2.id,
                            value="7.00",
                        )
                    ],
                ),
            )
            submit_proposal(db, sales_ctx, prop.id)

    # 3. Rejected Proposal on QT-2026-0001
    if (
        q1
        and q1.current_revision
        and q1.current_revision.lines
        and q1.current_revision_id is not None
    ):
        existing_rejected = db.scalar(
            select(QuoteChangeProposal).where(
                QuoteChangeProposal.organization_id == org.id,
                QuoteChangeProposal.quote_id == q1.id,
                QuoteChangeProposal.status == "rejected",
            )
        )
        if not existing_rejected:
            line = q1.current_revision.lines[0]
            prop_rej = create_proposal(
                db=db,
                ctx=sales_ctx,
                quote_id=q1.id,
                payload=CreateProposalRequest(
                    quote_id=q1.id,
                    base_revision_id=q1.current_revision_id,
                    title="Aggressive Volume Discount (12%)",
                    justification="Customer requested deep discount for upfront cash payment.",
                    operations=[
                        ProposalOperationSchema(
                            type="set_line_discount_percent",
                            target_line_id=line.id,
                            value="12.00",
                        )
                    ],
                ),
            )
            submit_proposal(db, sales_ctx, prop_rej.id)
            reject_proposal(
                db=db,
                ctx=mgr_ctx,
                proposal_id=prop_rej.id,
                request=ApprovalDecisionRequest(
                    decision="rejected",
                    rejection_reason="Discount of 12% breaches minimum gross margin policy (<15%). Counter-offer at 6% maximum.",
                ),
            )

    db.commit()


if __name__ == "__main__":
    from app.db.session import SessionLocal

    logging.basicConfig(level=logging.INFO)
    logger.info("Starting Phase 2 demo data seeding...")
    with SessionLocal() as session:
        seed_demo_data(session)
    logger.info("Demo data seeding completed successfully.")
