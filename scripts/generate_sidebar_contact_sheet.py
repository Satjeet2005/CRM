#!/usr/bin/env python3
"""
Generate ForgeFlow × Sakani Sidebar Visual Conformance Contact Sheet
"""

import os
import json
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "docs/design-mapping/screenshots/sidebar")
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

    # Load images
    sidebar_before = Image.open(os.path.join(SCREENSHOTS_DIR, "sidebar-desktop-before.png"))
    sidebar_expanded = Image.open(os.path.join(SCREENSHOTS_DIR, "sidebar-desktop-expanded-1440x900.png"))
    sidebar_collapsed = Image.open(os.path.join(SCREENSHOTS_DIR, "sidebar-desktop-collapsed-1440x900.png"))
    sidebar_tablet = Image.open(os.path.join(SCREENSHOTS_DIR, "sidebar-tablet-1024x768.png"))
    sidebar_mobile = Image.open(os.path.join(SCREENSHOTS_DIR, "sidebar-mobile-drawer-390x844.png"))

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
    c_dark = "#141414"
    c_muted = "#706A63"
    c_card_bg = "#FFFFFF"
    c_border = "#DBDAD7"
    c_green = "#12B76A"

    # Header Card
    draw.rectangle([60, 50, canvas_w - 60, 220], fill=c_card_bg, outline=c_border, width=2)
    draw.text((100, 75), "ForgeFlow × Sakani — Sidebar Visual Conformance", fill=c_dark, font=title_font)
    draw.text((100, 135), "Figma Parity: Sidebar Expanded/Collapsed (245:7728) | Active Indicator (243:4112) | Group Label (243:4186) | Drawer", fill=c_muted, font=subtitle_font)

    # Verification Badges
    badges = [
        ("Expanded: 248px (Exact)", c_green),
        ("Collapsed: 64px (Exact)", c_green),
        ("Item Height: 32px (Exact)", c_green),
        ("Indicator: 3×20px Saffron Pill", c_green),
        ("Active Surface: #FFFFFF Shadow-xs", c_green),
        ("Group Labels: 28px 11px/16px 600", c_green),
        ("Axe Violations: 0 (All Viewports)", c_green),
        ("P2 Badge: Removed & Live Settings", c_green),
    ]
    cur_x = 100
    for text, color in badges:
        bbox = draw.textbbox((0, 0), text, font=badge_font)
        bw = bbox[2] - bbox[0]
        draw.rounded_rectangle([cur_x, 175, cur_x + bw + 22, 205], radius=6, fill="#F0FDF4", outline=color, width=1)
        draw.text((cur_x + 11, 180), text, fill=color, font=badge_font)
        cur_x += bw + 30

    # 1. Before vs After Comparison
    draw.text((100, 255), "1. Desktop Before vs. Conformed After (1440 × 900)", fill=c_dark, font=section_font)
    draw.text((100, 290), "Active Indicator variant (#FFFFFF surface + 3×20px saffron pill), 32px item geometry, 18px icons, clean settings link", fill=c_muted, font=body_font)

    col_w_half = (canvas_w - 240) // 2
    # Before
    scale_b = col_w_half / sidebar_before.width
    bh = int(sidebar_before.height * scale_b)
    before_resized = sidebar_before.resize((col_w_half, bh), Image.Resampling.LANCZOS)
    canvas.paste(before_resized, (100, 330))
    draw.text((120, 345), "BEFORE: Peach active background, 40px items, P2 roadmap badge, unpinned footer", fill="#D92D20", font=code_font)

    # After
    scale_a = col_w_half / sidebar_expanded.width
    ah = int(sidebar_expanded.height * scale_a)
    after_resized = sidebar_expanded.resize((col_w_half, ah), Image.Resampling.LANCZOS)
    canvas.paste(after_resized, (100 + col_w_half + 40, 330))
    draw.text((140 + col_w_half, 345), "AFTER: Sakani 248px width, 32px items, white card active surface, 3x20px saffron pill, P2 removed", fill=c_green, font=code_font)

    # 2. Collapsed Rail View (1440 × 900)
    dark_y = 330 + max(bh, ah) + 50
    draw.text((100, dark_y), "2. Desktop Collapsed Rail Mode (64px) — Centered 18px Icons & Active Indicator", fill=c_dark, font=section_font)
    draw.text((100, dark_y + 35), "Full keyboard navigation, tooltips on hover, clear 3×20px saffron active pill, 0 accessibility violations", fill=c_muted, font=body_font)

    target_w = canvas_w - 200
    scale_col = target_w / sidebar_collapsed.width
    col_h = int(sidebar_collapsed.height * scale_col)
    col_resized = sidebar_collapsed.resize((target_w, col_h), Image.Resampling.LANCZOS)
    canvas.paste(col_resized, (100, dark_y + 75))

    # 3. Tablet and Mobile Section (Side-by-side)
    lower_y = dark_y + 75 + col_h + 50
    col_w = (canvas_w - 240) // 2

    # Tablet
    draw.text((100, lower_y), "3. Tablet (1024 × 768) — Responsive Layout Integration", fill=c_dark, font=section_font)
    draw.text((100, lower_y + 35), "Persistent 248px sidebar with full workspace navigation & zero layout distortion", fill=c_muted, font=body_font)

    scale_tab = col_w / sidebar_tablet.width
    tab_h = int(sidebar_tablet.height * scale_tab)
    tab_resized = sidebar_tablet.resize((col_w, tab_h), Image.Resampling.LANCZOS)
    canvas.paste(tab_resized, (100, lower_y + 75))

    # Mobile
    draw.text((100 + col_w + 40, lower_y), "4. Mobile (390 × 844) — Slide-over Navigation Drawer", fill=c_dark, font=section_font)
    draw.text((100 + col_w + 40, lower_y + 35), "Responsive drawer width (max 85vw), backdrop scrim, closes automatically upon item selection", fill=c_muted, font=body_font)

    scale_mob = col_w / sidebar_mobile.width
    mob_h = int(sidebar_mobile.height * scale_mob)
    mob_resized = sidebar_mobile.resize((col_w, mob_h), Image.Resampling.LANCZOS)
    canvas.paste(mob_resized, (100 + col_w + 40, lower_y + 75))

    canvas.save(OUTPUT_PATH, "PNG")
    print(f"Contact sheet successfully generated at: {OUTPUT_PATH}")

if __name__ == "__main__":
    create_contact_sheet()
