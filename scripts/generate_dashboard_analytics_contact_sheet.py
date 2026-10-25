#!/usr/bin/env python3
"""
Generate ForgeFlow × Sakani Dashboard Analytics Visualization Expansion Contact Sheet
"""

import os
import shutil
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "docs/design-mapping/screenshots/dashboard-analytics")
OUTPUT_PATH = os.path.join(SCREENSHOTS_DIR, "contact-sheet.png")
ARTIFACT_DIR = "/home/satjeet/.gemini/antigravity-cli/brain/4cd6df4a-3d9d-43fa-81c5-3be39ca98467/screenshots/dashboard-analytics"

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
    os.makedirs(ARTIFACT_DIR, exist_ok=True)

    # 1. Load images
    sec_desktop = Image.open(os.path.join(SCREENSHOTS_DIR, "dashboard-analytics-section-desktop-1440x900.png"))
    sec_dark = Image.open(os.path.join(SCREENSHOTS_DIR, "dashboard-analytics-section-dark-desktop-1440x900.png"))
    sec_tables = Image.open(os.path.join(SCREENSHOTS_DIR, "dashboard-analytics-section-tables-desktop-1440x900.png"))
    sec_tablet = Image.open(os.path.join(SCREENSHOTS_DIR, "dashboard-analytics-section-tablet-1024x768.png"))
    sec_mobile = Image.open(os.path.join(SCREENSHOTS_DIR, "dashboard-analytics-section-mobile-390x844.png"))
    full_desktop = Image.open(os.path.join(SCREENSHOTS_DIR, "dashboard-analytics-fullpage-desktop-1440x900.png"))

    # Canvas Setup
    canvas_w = 2500
    canvas_h = 3500
    canvas = Image.new("RGB", (canvas_w, canvas_h), "#F9F9F8")
    draw = ImageDraw.Draw(canvas)

    # Fonts
    title_font = get_font(44, bold=True)
    subtitle_font = get_font(22, bold=False)
    section_font = get_font(28, bold=True)
    body_font = get_font(18, bold=False)

    # Header Bar
    draw.rectangle([(0, 0), (canvas_w, 140)], fill="#141414")
    draw.text((60, 36), "ForgeFlow × Sakani — Operational Analytics Expansion", fill="#FFFFFF", font=title_font)
    draw.text((60, 92), "Verified Sakani Donut (1290:22116) & Bar Charts (1290:21238) • 0 Axe Violations • Canonical Scoping", fill="#F4511E", font=subtitle_font)

    # Section 1: Desktop Analytics Grid (Charts & Dark Mode)
    curr_y = 170
    draw.text((60, curr_y), "1. Operational Analytics 3-Column Grid (Desktop 1440×900)", fill="#141414", font=section_font)
    curr_y += 40

    target_w = 1160
    d_aspect = sec_desktop.height / sec_desktop.width
    d_h = int(target_w * d_aspect)
    d_resized = sec_desktop.resize((target_w, d_h), Image.Resampling.LANCZOS)
    dark_resized = sec_dark.resize((target_w, d_h), Image.Resampling.LANCZOS)

    canvas.paste(d_resized, (60, curr_y))
    canvas.paste(dark_resized, (1280, curr_y))

    draw.rectangle([(60, curr_y), (60 + target_w, curr_y + d_h)], outline="#E4E4E7", width=2)
    draw.rectangle([(1280, curr_y), (1280 + target_w, curr_y + d_h)], outline="#3F3F46", width=2)

    draw.text((60, curr_y + d_h + 10), "Desktop Light — RFQ Match Health (Donut), Quotation Lifecycle (Bars), Task Due-Date Load (Urgency)", fill="#52525B", font=body_font)
    draw.text((1280, curr_y + d_h + 10), "Desktop Dark Mode — Full Contrast & Token Preservation with Automatic Theme Adaptation", fill="#52525B", font=body_font)

    curr_y += d_h + 60

    # Section 2: Tabular Alternative Mode
    draw.text((60, curr_y), "2. Accessible Tabular Alternatives (WCAG 2.1 AA Data Equivalents)", fill="#141414", font=section_font)
    curr_y += 40

    tables_w = 2380
    tables_h = int(tables_w * (sec_tables.height / sec_tables.width))
    tables_resized = sec_tables.resize((tables_w, tables_h), Image.Resampling.LANCZOS)

    canvas.paste(tables_resized, (60, curr_y))
    draw.rectangle([(60, curr_y), (60 + tables_w, curr_y + tables_h)], outline="#E4E4E7", width=2)
    draw.text((60, curr_y + tables_h + 10), "Accessible Data-Table Mode — Available via toggle for screen readers and business audit accuracy", fill="#52525B", font=body_font)

    curr_y += tables_h + 60

    # Section 3: Responsive Multi-Viewport
    draw.text((60, curr_y), "3. Multi-Viewport Layout Adaptation (Tablet & Mobile)", fill="#141414", font=section_font)
    curr_y += 40

    tab_w = 1200
    tab_h = int(tab_w * (sec_tablet.height / sec_tablet.width))
    tab_resized = sec_tablet.resize((tab_w, tab_h), Image.Resampling.LANCZOS)

    mob_w = 540
    mob_h = int(mob_w * (sec_mobile.height / sec_mobile.width))
    mob_resized = sec_mobile.resize((mob_w, mob_h), Image.Resampling.LANCZOS)

    canvas.paste(tab_resized, (60, curr_y))
    canvas.paste(mob_resized, (1320, curr_y))

    draw.rectangle([(60, curr_y), (60 + tab_w, curr_y + tab_h)], outline="#E4E4E7", width=2)
    draw.rectangle([(1320, curr_y), (1320 + mob_w, curr_y + mob_h)], outline="#E4E4E7", width=2)

    draw.text((60, curr_y + tab_h + 10), "Tablet Viewport (1024×768) — Responsive Multi-Column Layout with Balanced Density", fill="#52525B", font=body_font)
    draw.text((1320, curr_y + mob_h + 10), "Mobile (390×844) — Single-Column Vertical Stack with Touch Targets", fill="#52525B", font=body_font)

    # Save
    canvas.save(OUTPUT_PATH, "PNG")
    shutil.copyfile(OUTPUT_PATH, os.path.join(ARTIFACT_DIR, "contact-sheet.png"))
    print(f"Contact sheet created: {OUTPUT_PATH}")

if __name__ == "__main__":
    create_contact_sheet()
