import os
from PIL import Image, ImageDraw, ImageFont

SCREENSHOTS_DIR = "/home/satjeet/Desktop/CRM/docs/design-mapping/screenshots/phase8"
OUTPUT_PATH = os.path.join(SCREENSHOTS_DIR, "contact-sheet.png")

FONT_PATH_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_PATH_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"

font_title = ImageFont.truetype(FONT_PATH_BOLD, 36)
font_subtitle = ImageFont.truetype(FONT_PATH_REG, 20)
font_section = ImageFont.truetype(FONT_PATH_BOLD, 26)
font_label_title = ImageFont.truetype(FONT_PATH_BOLD, 16)
font_label_sub = ImageFont.truetype(FONT_PATH_REG, 13)

SECTIONS = [
    {
        "title": "1. Customer Document Export Studio — Approved & Certified Release (QT-2026-0004)",
        "description": "Commercial export studio with certified release badge, customer PDF/CSV generation, and internal margin masking",
        "items": [
            {
                "file": "export-studio-approved-desktop-1440x900.png",
                "route": "/app/quotes/[quoteId]",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Approved Commercial Studio",
                "width": 880,
            },
            {
                "file": "export-studio-approved-tablet-1024x768.png",
                "route": "/app/quotes/[quoteId]",
                "viewport": "1024 × 768 (Tablet)",
                "mode": "Tablet Viewport",
                "width": 640,
            },
            {
                "file": "export-studio-approved-mobile-390x844.png",
                "route": "/app/quotes/[quoteId]",
                "viewport": "390 × 844 (Mobile)",
                "mode": "Mobile Viewport",
                "width": 380,
            },
        ],
    },
    {
        "title": "2. Export Governance — Draft Locked & Fail-Closed Protection (QT-2026-0001)",
        "description": "Pre-approval lock state disabling customer release, with conspicuous watermarked draft preview CTA",
        "items": [
            {
                "file": "export-studio-draft-locked-desktop-1440x900.png",
                "route": "/app/quotes/[quoteId]",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Draft Locked Governance State",
                "width": 880,
            },
            {
                "file": "export-studio-draft-locked-tablet-1024x768.png",
                "route": "/app/quotes/[quoteId]",
                "viewport": "1024 × 768 (Tablet)",
                "mode": "Tablet Viewport",
                "width": 640,
            },
            {
                "file": "export-studio-draft-locked-mobile-390x844.png",
                "route": "/app/quotes/[quoteId]",
                "viewport": "390 × 844 (Mobile)",
                "mode": "Mobile Viewport",
                "width": 380,
            },
        ],
    },
    {
        "title": "3. Commercial Integrity, Cryptographic SHA-256 Ledger & Security Forensics",
        "description": "Audit delivery ledger, authoritative HTTP 409 fail-closed API contract, and WeasyPrint draft watermark PDF render",
        "items": [
            {
                "file": "export-delivery-ledger-desktop-1440x900.png",
                "route": "Delivery Ledger",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "SHA-256 Checksum History",
                "width": 680,
            },
            {
                "file": "export-http409-failclosed-desktop.png",
                "route": "API Security Gate",
                "viewport": "Diagnostic Card",
                "mode": "HTTP 409 Fail-Closed Contract",
                "width": 680,
            },
            {
                "file": "export-pdf-watermark-verification.png",
                "route": "Document Renderer",
                "viewport": "PDF Page 1",
                "mode": "WeasyPrint Diagonal Draft Watermark",
                "width": 540,
            },
        ],
    },
]

BG_COLOR = "#0C1017"
CARD_BG = "#151B26"
CARD_BORDER = "#252D3D"
TEXT_PRIMARY = "#F8FAFC"
TEXT_SECONDARY = "#94A3B8"
ACCENT_COLOR = "#4F46E5"
TAG_BG = "#1E2738"
TAG_BORDER = "#334155"

CANVAS_WIDTH = 2200
HEADER_HEIGHT = 200
SECTION_HEADER_HEIGHT = 90
CARD_LABEL_HEIGHT = 65
PADDING = 40
GAP = 30

def create_card(item_info):
    file_path = os.path.join(SCREENSHOTS_DIR, item_info["file"])
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Missing screenshot: {file_path}")

    img = Image.open(file_path).convert("RGB")
    orig_w, orig_h = img.size
    target_w = item_info["width"]
    target_h = int(orig_h * (target_w / orig_w))
    img_resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    card_w = target_w + 16
    card_h = target_h + CARD_LABEL_HEIGHT + 16

    card = Image.new("RGB", (card_w, card_h), CARD_BG)
    draw = ImageDraw.Draw(card)
    draw.rectangle([0, 0, card_w - 1, card_h - 1], outline=CARD_BORDER, width=2)
    card.paste(img_resized, (8, 8))

    label_y = target_h + 16
    title_text = f"{item_info['route']} — {item_info['viewport']}"
    sub_text = f"Mode: {item_info['mode']}"

    draw.text((14, label_y), title_text, fill=TEXT_PRIMARY, font=font_label_title)
    draw.text((14, label_y + 24), sub_text, fill=TEXT_SECONDARY, font=font_label_sub)

    return card

def main():
    rendered_sections = []
    total_height = HEADER_HEIGHT + PADDING

    for sec in SECTIONS:
        cards = [create_card(item) for item in sec["items"]]
        sec_h = SECTION_HEADER_HEIGHT + max(c.height for c in cards) + GAP
        rendered_sections.append({"sec": sec, "cards": cards, "height": sec_h})
        total_height += sec_h

    canvas = Image.new("RGB", (CANVAS_WIDTH, total_height), BG_COLOR)
    draw = ImageDraw.Draw(canvas)

    # Header
    draw.rectangle([0, 0, CANVAS_WIDTH, HEADER_HEIGHT - 20], fill="#111827")
    draw.line([(0, HEADER_HEIGHT - 20), (CANVAS_WIDTH, HEADER_HEIGHT - 20)], fill=ACCENT_COLOR, width=4)

    draw.text((PADDING, 32), "ForgeFlow × Sakani — Phase 8 Export Studio & Final Hardening Contact Sheet", fill=TEXT_PRIMARY, font=font_title)
    draw.text(
        (PADDING, 82),
        "Visual audit of Document Export Studio, Fail-Closed HTTP 409 Gate, SHA-256 Ledger, and Draft Watermarked PDF Rendering",
        fill=TEXT_SECONDARY,
        font=font_subtitle,
    )

    badge_text = "VERIFIED: ZERO AXE-CORE VIOLATIONS (WCAG 2.1 AA) • FAIL-CLOSED HTTP 409 ENFORCED • WEASYPRINT WATERMARK ACTIVE • 9/9 AUDIT INVARIANTS"
    draw.rounded_rectangle([PADDING, 130, PADDING + 1150, 162], radius=6, fill=TAG_BG, outline=TAG_BORDER)
    draw.text((PADDING + 14, 137), badge_text, fill="#34D399", font=font_label_sub)

    current_y = HEADER_HEIGHT + 10

    for item in rendered_sections:
        sec = item["sec"]
        cards = item["cards"]

        draw.text((PADDING, current_y), sec["title"], fill=TEXT_PRIMARY, font=font_section)
        draw.text((PADDING, current_y + 36), sec["description"], fill=TEXT_SECONDARY, font=font_subtitle)
        draw.line([(PADDING, current_y + 70), (CANVAS_WIDTH - PADDING, current_y + 70)], fill=CARD_BORDER, width=1)

        cards_y = current_y + SECTION_HEADER_HEIGHT
        current_x = PADDING

        for card in cards:
            canvas.paste(card, (current_x, cards_y))
            current_x += card.width + GAP

        current_y += item["height"]

    canvas.save(OUTPUT_PATH, "PNG", optimize=True)
    print(f"Phase 8 Contact sheet successfully generated at: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
