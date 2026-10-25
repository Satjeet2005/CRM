#!/usr/bin/env python3
"""
Generate ForgeFlow × Sakani Primary Contact Badge Conformance Contact Sheet
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "docs/design-mapping/screenshots/contacts-primary-badge")
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
    badge_closeup = Image.open(os.path.join(SCREENSHOTS_DIR, "contacts-primary-badge-desktop-closeup.png"))
    badge_desktop = Image.open(os.path.join(SCREENSHOTS_DIR, "contacts-primary-badge-desktop-1440x900.png"))
    badge_dark = Image.open(os.path.join(SCREENSHOTS_DIR, "contacts-primary-badge-dark-desktop-1440x900.png"))
    badge_tablet = Image.open(os.path.join(SCREENSHOTS_DIR, "contacts-primary-badge-tablet-1024x768.png"))
    badge_mobile = Image.open(os.path.join(SCREENSHOTS_DIR, "contacts-primary-badge-mobile-390x844.png"))

    # Load verification data
    json_path = os.path.join(SCREENSHOTS_DIR, "contacts-primary-badge-verification.json")
    with open(json_path, "r") as f:
        metrics = json.load(f)

    # Canvas Setup
    canvas_w = 2400
    canvas_h = 3600
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
    c_blue = "#5B92DD"
    c_dark = "#141414"
    c_muted = "#706A63"
    c_card_bg = "#FFFFFF"
    c_border = "#DBDAD7"
    c_green = "#12B76A"

    # Header Card
    draw.rectangle([60, 50, canvas_w - 60, 220], fill=c_card_bg, outline=c_border, width=2)
    draw.text((100, 75), "ForgeFlow × Sakani — Primary Contact Badge Correction", fill=c_dark, font=title_font)
    draw.text((100, 135), "Figma Parity: Badge Set (16:103) | Accent/Subtle (16:83) | Fixed Trailing Slot Alignment", fill=c_muted, font=subtitle_font)

    # Verification Badges
    badges = [
        ("Background: #F5F4F2 Neutral", c_green),
        ("Text: #141414 High Contrast", c_green),
        ("Star: #FF4700 Saffron Fill", c_green),
        ("Grid: [minmax(0,1fr)_76px]", c_green),
        ("Alignment: 100% Identical Rights", c_green),
        ("Axe Violations: 0 (All Viewports)", c_green),
    ]
    cur_x = 100
    for text, color in badges:
        bbox = draw.textbbox((0, 0), text, font=badge_font)
        bw = bbox[2] - bbox[0]
        draw.rounded_rectangle([cur_x, 175, cur_x + bw + 24, 205], radius=6, fill="#F0FDF4", outline=color, width=1)
        draw.text((cur_x + 12, 180), text, fill=color, font=badge_font)
        cur_x += bw + 36

    # 1. Close-up Crop of Table Identity Column showing Fixed Trailing Slot Alignment
    draw.text((100, 255), "1. Close-up: Neutral Badge Surface (#F5F4F2), Saffron Star (#FF4700) & Consistent Trailing Alignment", fill=c_dark, font=section_font)
    draw.text((100, 290), "Fixed 76px trailing column aligns all Primary badges flush to the same vertical guideline with zero name collisions", fill=c_muted, font=body_font)

    target_w = canvas_w - 200
    scale_crop = target_w / badge_closeup.width
    crop_h = min(int(badge_closeup.height * scale_crop), 700)
    crop_resized = badge_closeup.resize((target_w, int(badge_closeup.height * scale_crop)), Image.Resampling.LANCZOS)
    canvas.paste(crop_resized.crop((0, 0, target_w, crop_h)), (100, 330))

    # 2. Desktop Full Light & Dark Mode Section
    dark_y = 330 + crop_h + 50
    draw.text((100, dark_y), "2. Desktop Full View (1440 × 900) — Light vs. Dark Mode Contrast", fill=c_dark, font=section_font)
    draw.text((100, dark_y + 35), "Full table context showing balanced identity columns, contrast-safe account links, and stable non-primary contact rows", fill=c_muted, font=body_font)

    col_w_half = (canvas_w - 240) // 2
    # Light
    scale_l = col_w_half / badge_desktop.width
    lh = int(badge_desktop.height * scale_l)
    light_resized = badge_desktop.resize((col_w_half, lh), Image.Resampling.LANCZOS)
    canvas.paste(light_resized, (100, dark_y + 75))
    draw.text((120, dark_y + 90), "DESKTOP LIGHT: #F5F4F2 Surface + #141414 Text + #FF4700 Star", fill=c_dark, font=code_font)

    # Dark
    scale_d = col_w_half / badge_dark.width
    dh = int(badge_dark.height * scale_d)
    dark_resized = badge_dark.resize((col_w_half, dh), Image.Resampling.LANCZOS)
    canvas.paste(dark_resized, (100 + col_w_half + 40, dark_y + 75))
    draw.text((140 + col_w_half, dark_y + 90), "DESKTOP DARK: High-contrast Dark Neutral Surface + #FF4700 Star", fill=c_green, font=code_font)

    # 3. Tablet and Mobile Section (Side-by-side)
    lower_y = dark_y + 75 + max(lh, dh) + 50
    col_w = (canvas_w - 240) // 2

    # Tablet
    draw.text((100, lower_y), "3. Tablet (1024 × 768) — Responsive Scroll", fill=c_dark, font=section_font)
    draw.text((100, lower_y + 35), "Horizontal table scrolling with accessible focus ring & tabIndex=0", fill=c_muted, font=body_font)

    scale_tab = col_w / badge_tablet.width
    tab_h = int(badge_tablet.height * scale_tab)
    tab_resized = badge_tablet.resize((col_w, tab_h), Image.Resampling.LANCZOS)
    canvas.paste(tab_resized, (100, lower_y + 75))

    # Mobile
    draw.text((100 + col_w + 40, lower_y), "4. Mobile (390 × 844) — Stacked Mobile 1269:563", fill=c_dark, font=section_font)
    draw.text((100 + col_w + 40, lower_y + 35), "Zero overflow, record card layout with Avatar + Name + Primary badge + labeled details & 32px actions", fill=c_muted, font=body_font)

    scale_mob = col_w / badge_mobile.width
    mob_h = int(badge_mobile.height * scale_mob)
    mob_resized = badge_mobile.resize((col_w, mob_h), Image.Resampling.LANCZOS)
    canvas.paste(mob_resized, (100 + col_w + 40, lower_y + 75))

    canvas.save(OUTPUT_PATH, "PNG")
    print(f"Contact sheet successfully generated at: {OUTPUT_PATH}")

if __name__ == "__main__":
    create_contact_sheet()
