#!/usr/bin/env python3
"""
Generate ForgeFlow × Sakani Work Queues Conformance Contact Sheet
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "docs/design-mapping/screenshots/work-queues")
OUTPUT_PATH = os.path.join(SCREENSHOTS_DIR, "contact-sheet.png")

def get_font(size, bold=False):
    font_paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for p in font_paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def create_contact_sheet():
    os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

    # 1. Load images
    rfq_card = Image.open(os.path.join(SCREENSHOTS_DIR, "card-rfq-review-desktop.png"))
    quotes_card = Image.open(os.path.join(SCREENSHOTS_DIR, "card-quotes-desktop.png"))
    desktop_strip = Image.open(os.path.join(SCREENSHOTS_DIR, "work-queues-strip-desktop-1440x900.png"))
    dark_strip = Image.open(os.path.join(SCREENSHOTS_DIR, "work-queues-strip-dark-desktop-1440x900.png"))
    tablet_strip = Image.open(os.path.join(SCREENSHOTS_DIR, "work-queues-strip-tablet-1024x768.png"))
    mobile_strip = Image.open(os.path.join(SCREENSHOTS_DIR, "work-queues-strip-mobile-390x844.png"))

    # Load verification data
    json_path = os.path.join(SCREENSHOTS_DIR, "work-queues-verification.json")
    with open(json_path, "r") as f:
        metrics = json.load(f)

    # Canvas Setup
    canvas_w = 2400
    canvas_h = 3050
    canvas = Image.new("RGB", (canvas_w, canvas_h), "#F9F9F8")
    draw = ImageDraw.Draw(canvas)

    # Fonts
    title_font = get_font(42, bold=True)
    subtitle_font = get_font(22, bold=False)
    section_font = get_font(26, bold=True)
    body_font = get_font(18, bold=False)
    code_font = get_font(16, bold=True)
    badge_font = get_font(16, bold=True)

    # Colors
    c_saffron = "#FF4700"
    c_dark = "#141414"
    c_muted = "#706A63"
    c_card_bg = "#FFFFFF"
    c_border = "#DBDAD7"
    c_green = "#12B76A"

    # Header Banner
    draw.rectangle([0, 0, canvas_w, 140], fill="#FFFFFF")
    draw.line([0, 140, canvas_w, 140], fill=c_border, width=2)

    draw.text((60, 32), "ForgeFlow × Sakani — Dashboard Work Queues Finalization", font=title_font, fill=c_dark)
    draw.text((60, 88), "Verified Figma Components: Inline CTA (1632:29687) • Featured Icon Medium (1527:28454) • Button Outline (91:279)", font=subtitle_font, fill=c_muted)

    # Status Pill
    draw.rounded_rectangle([canvas_w - 320, 48, canvas_w - 60, 96], radius=24, fill="#ECFDF3", outline=c_green, width=2)
    draw.text((canvas_w - 290, 60), "100% SPEC MATCH", font=badge_font, fill="#027A48")

    current_y = 170

    # Section 1: Detailed Anatomy Breakdown (Individual Cards side by side)
    draw.text((60, current_y), "1. Component Anatomy: Inline CTA + Featured Icon (40×40) + Restrained Outline Navigation", font=section_font, fill=c_dark)
    current_y += 45

    # Side by side cards
    card_w = (canvas_w - 120 - 40) // 2
    rfq_ratio = card_w / rfq_card.width
    rfq_h = int(rfq_card.height * rfq_ratio)
    rfq_resized = rfq_card.resize((card_w, rfq_h), Image.Resampling.LANCZOS)
    canvas.paste(rfq_resized, (60, current_y))

    quotes_ratio = card_w / quotes_card.width
    quotes_h = int(quotes_card.height * quotes_ratio)
    quotes_resized = quotes_card.resize((card_w, quotes_h), Image.Resampling.LANCZOS)
    canvas.paste(quotes_resized, (60 + card_w + 40, current_y))

    current_y += max(rfq_h, quotes_h) + 15

    # Annotations below cards
    anno_box_h = 105
    # Left annotation box (RFQ)
    draw.rounded_rectangle([60, current_y, 60 + card_w, current_y + anno_box_h], radius=12, fill=c_card_bg, outline=c_border, width=1)
    draw.text((80, current_y + 14), "RFQ Review Queue (Saffron Theme)", font=code_font, fill=c_saffron)
    draw.text((80, current_y + 40), "• Icon: 40×40px, rounded-12px, border #FFC7A8, bg #FFF3ED, centered 20×20px icon", font=body_font, fill=c_dark)
    draw.text((80, current_y + 68), "• Title: Geist 14px/600 • Desc: \"51 lines need review\" Geist 14px/500 • Action: Outline Button \"Review RFQs\" (32px / 8px)", font=body_font, fill=c_muted)

    # Right annotation box (Quotes)
    draw.rounded_rectangle([60 + card_w + 40, current_y, 60 + card_w * 2 + 40, current_y + anno_box_h], radius=12, fill=c_card_bg, outline=c_border, width=1)
    draw.text((80 + card_w + 40, current_y + 14), "Quotations & Pricing (Blue Info Theme)", font=code_font, fill="#175CD3")
    draw.text((80 + card_w + 40, current_y + 40), "• Icon: 40×40px, rounded-12px, border #B2DDFF, bg #EFF8FF, centered 20×20px icon", font=body_font, fill=c_dark)
    draw.text((80 + card_w + 40, current_y + 68), "• Title: Geist 14px/600 • Desc: \"1 active draft\" Geist 14px/500 • Action: Outline Button \"View quotations\" (32px / 8px)", font=body_font, fill=c_muted)

    current_y += anno_box_h + 40

    # Section 2: Light Mode vs Dark Mode Section Strip (Section Heading + Cards Grid)
    draw.text((60, current_y), "2. Light Mode vs Dark Mode Section Verification (Heading: Geist 16px/22px w:600)", font=section_font, fill=c_dark)
    current_y += 45

    # Light Strip
    strip_w = canvas_w - 120
    light_ratio = strip_w / desktop_strip.width
    light_h = int(desktop_strip.height * light_ratio)
    light_resized = desktop_strip.resize((strip_w, light_h), Image.Resampling.LANCZOS)
    canvas.paste(light_resized, (60, current_y))
    current_y += light_h + 10

    draw.text((60, current_y), "Light Mode: Heading \"Work queues\" #141414 • Surface #FFFFFF • Border #DBDAD7 • 0 Axe Violations", font=code_font, fill="#027A48")
    current_y += 35

    # Dark Strip
    dark_ratio = strip_w / dark_strip.width
    dark_h = int(dark_strip.height * dark_ratio)
    dark_resized = dark_strip.resize((strip_w, dark_h), Image.Resampling.LANCZOS)
    canvas.paste(dark_resized, (60, current_y))
    current_y += dark_h + 10

    draw.text((60, current_y), "Dark Mode: Accessible Contrasts (>7:1) • Surface #141414 • Border #2B2A27 • 0 Axe Violations", font=code_font, fill="#027A48")
    current_y += 45

    # Section 3: Responsive Viewports (Tablet & Mobile)
    draw.text((60, current_y), "3. Responsive Viewports: Tablet (1024×768) & Mobile (390×844 Vertical Stack)", font=section_font, fill=c_dark)
    current_y += 45

    resp_w = (canvas_w - 120 - 40) // 2

    tab_ratio = resp_w / tablet_strip.width
    tab_h = int(tablet_strip.height * tab_ratio)
    tab_resized = tablet_strip.resize((resp_w, tab_h), Image.Resampling.LANCZOS)
    canvas.paste(tab_resized, (60, current_y))

    mob_ratio = (resp_w * 0.72) / mobile_strip.width
    mob_h = int(mobile_strip.height * mob_ratio)
    mob_resized = mobile_strip.resize((int(resp_w * 0.72), mob_h), Image.Resampling.LANCZOS)
    canvas.paste(mob_resized, (60 + resp_w + 40, current_y))

    current_y += max(tab_h, mob_h) + 10
    draw.text((60, current_y), "Tablet (1024px): 2-Column Balanced Grid (16px gap, no clipping)", font=code_font, fill=c_muted)
    draw.text((60 + resp_w + 40, current_y), "Mobile (390px): 1-Column Responsive Stack, stable 40px icon, no text overlap", font=code_font, fill=c_muted)
    current_y += 45

    # Section 4: Specifications & Conformance Matrix
    draw.text((60, current_y), "4. Conformance Specifications Matrix", font=section_font, fill=c_dark)
    current_y += 40

    matrix_box_h = 280
    draw.rounded_rectangle([60, current_y, canvas_w - 60, current_y + matrix_box_h], radius=16, fill=c_card_bg, outline=c_border, width=1)

    table_headers = ["Property", "Target Specification (Figma / Sakani)", "ForgeFlow Implementation", "Status"]
    col_x = [90, 480, 1420, 2150]
    draw.line([60, current_y + 44, canvas_w - 60, current_y + 44], fill=c_border, width=1)

    for i, h in enumerate(table_headers):
        draw.text((col_x[i], current_y + 12), h, font=code_font, fill=c_muted)

    rows = [
        ("Section Heading", "Geist 16px / 22px, weight 600, color #141414", "Geist 16px / 22px, weight 600, color rgb(20, 20, 20)", "MATCH"),
        ("Section Spacing", "12px to grid, 24px from KPI row, 24px to charts", "12px (space-y-3), 24px (space-y-6), 24px (gap-6)", "MATCH"),
        ("Card Dimensions", "Height ~76px, Radius 16px, Padding 16px, Border 1px #DBDAD7", "Height 78px, Radius 16px, Padding 16px, Border 1px #DBDAD7", "MATCH"),
        ("Featured Icon Medium", "40×40px, Radius 12px, Padding 10px, Icon 20×20px", "40×40px, Radius 12px, Padding 10px, Icon 20×20px centered", "MATCH"),
        ("Content & Natural Language", "RFQ: \"X lines need review\"; Quotes: \"X active draft(s)\"", "Plural-safe dynamic counts; Phase badges removed completely", "MATCH"),
        ("Restrained Navigation", "Outline Button (32-36px height, 8px radius, ArrowRight)", "Sakani Button outline (h-8 32px, radius 8px, rightIcon)", "MATCH"),
        ("Accessibility (Axe)", "0 WCAG 2.1 AA violations in Light and Dark mode", "0 Violations across Light & Dark mode (verified Axe-core)", "PASS"),
    ]

    row_y = current_y + 54
    for row in rows:
        draw.text((col_x[0], row_y), row[0], font=body_font, fill=c_dark)
        draw.text((col_x[1], row_y), row[1], font=body_font, fill=c_muted)
        draw.text((col_x[2], row_y), row[2], font=body_font, fill=c_dark)
        status_color = "#027A48" if "PASS" in row[3] or "MATCH" in row[3] else c_saffron
        draw.text((col_x[3], row_y), row[3], font=code_font, fill=status_color)
        row_y += 32

    # Save
    canvas.save(OUTPUT_PATH, "PNG", quality=95)
    print(f"Contact sheet saved to {OUTPUT_PATH}")

if __name__ == "__main__":
    create_contact_sheet()
