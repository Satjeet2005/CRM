#!/usr/bin/env python3
"""
Generate ForgeFlow × Sakani Settings Area Conformance Contact Sheet
"""

import os
import shutil
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOTS_DIR = os.path.join(BASE_DIR, "docs/design-mapping/screenshots/settings")
OUTPUT_PATH = os.path.join(SCREENSHOTS_DIR, "contact-sheet.png")
ARTIFACT_DIR = "/home/satjeet/.gemini/antigravity-cli/brain/4cd6df4a-3d9d-43fa-81c5-3be39ca98467/screenshots/settings"

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
    overview_desktop = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-overview-desktop-1440x900.png"))
    overview_dark = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-overview-dark-desktop-1440x900.png"))
    overview_tablet = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-overview-tablet-1024x768.png"))
    overview_mobile = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-overview-mobile-390x844.png"))

    org_desktop = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-organization-desktop-1440x900.png"))
    org_dark = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-organization-dark-desktop-1440x900.png"))

    sec_desktop = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-security-desktop-1440x900.png"))
    sec_dark = Image.open(os.path.join(SCREENSHOTS_DIR, "settings-security-dark-desktop-1440x900.png"))

    # Canvas Setup
    canvas_w = 2500
    canvas_h = 3600
    canvas = Image.new("RGB", (canvas_w, canvas_h), "#F9F9F8")
    draw = ImageDraw.Draw(canvas)

    # Fonts
    title_font = get_font(44, bold=True)
    subtitle_font = get_font(22, bold=False)
    section_font = get_font(28, bold=True)
    body_font = get_font(18, bold=False)
    badge_font = get_font(16, bold=True)

    # Header Bar
    draw.rectangle([(0, 0), (canvas_w, 140)], fill="#141414")
    draw.text((60, 36), "ForgeFlow × Sakani — Settings Area Conformance", fill="#FFFFFF", font=title_font)
    draw.text((60, 92), "Verified Sakani Profile Settings (1628:29382) & Account Overview (1624:29249) • 0 Axe Violations", fill="#F4511E", font=subtitle_font)

    # Section 1: Overview
    curr_y = 170
    draw.text((60, curr_y), "1. Settings Overview (/app/settings)", fill="#141414", font=section_font)
    curr_y += 40

    # Desktop Overview (Left) & Dark Overview (Right)
    target_w = 1160
    ov_d_aspect = overview_desktop.height / overview_desktop.width
    ov_d_h = int(target_w * ov_d_aspect)

    ov_d_resized = overview_desktop.resize((target_w, ov_d_h), Image.Resampling.LANCZOS)
    ov_dark_resized = overview_dark.resize((target_w, ov_d_h), Image.Resampling.LANCZOS)

    canvas.paste(ov_d_resized, (60, curr_y))
    canvas.paste(ov_dark_resized, (1280, curr_y))

    # Border & labels
    draw.rectangle([(60, curr_y), (60 + target_w, curr_y + ov_d_h)], outline="#E4E4E7", width=2)
    draw.rectangle([(1280, curr_y), (1280 + target_w, curr_y + ov_d_h)], outline="#3F3F46", width=2)

    draw.text((60, curr_y + ov_d_h + 10), "Desktop Light (1440×900) — Overview Hub with Card Navigation", fill="#52525B", font=body_font)
    draw.text((1280, curr_y + ov_d_h + 10), "Desktop Dark Mode — Full Contrast & Token Preservation", fill="#52525B", font=body_font)

    curr_y += ov_d_h + 60

    # Section 2: Organization Settings
    draw.text((60, curr_y), "2. Organization Settings (/app/settings/organization)", fill="#141414", font=section_font)
    curr_y += 40

    org_d_aspect = org_desktop.height / org_desktop.width
    org_d_h = int(target_w * org_d_aspect)
    org_d_resized = org_desktop.resize((target_w, org_d_h), Image.Resampling.LANCZOS)
    org_dark_resized = org_dark.resize((target_w, org_d_h), Image.Resampling.LANCZOS)

    canvas.paste(org_d_resized, (60, curr_y))
    canvas.paste(org_dark_resized, (1280, curr_y))

    draw.rectangle([(60, curr_y), (60 + target_w, curr_y + org_d_h)], outline="#E4E4E7", width=2)
    draw.rectangle([(1280, curr_y), (1280 + target_w, curr_y + org_d_h)], outline="#3F3F46", width=2)

    draw.text((60, curr_y + org_d_h + 10), "Desktop Light — Organization Details, Tenant Identifier, Currency, Timezone & Governance", fill="#52525B", font=body_font)
    draw.text((1280, curr_y + org_d_h + 10), "Desktop Dark Mode — Read-Only High-Fidelity Administrative Form Layout", fill="#52525B", font=body_font)

    curr_y += org_d_h + 60

    # Section 3: Security & Access
    draw.text((60, curr_y), "3. Security & Access (/app/settings/security)", fill="#141414", font=section_font)
    curr_y += 40

    sec_d_aspect = sec_desktop.height / sec_desktop.width
    sec_d_h = int(target_w * sec_d_aspect)
    sec_d_resized = sec_desktop.resize((target_w, sec_d_h), Image.Resampling.LANCZOS)
    sec_dark_resized = sec_dark.resize((target_w, sec_d_h), Image.Resampling.LANCZOS)

    canvas.paste(sec_d_resized, (60, curr_y))
    canvas.paste(sec_dark_resized, (1280, curr_y))

    draw.rectangle([(60, curr_y), (60 + target_w, curr_y + sec_d_h)], outline="#E4E4E7", width=2)
    draw.rectangle([(1280, curr_y), (1280 + target_w, curr_y + sec_d_h)], outline="#3F3F46", width=2)

    draw.text((60, curr_y + sec_d_h + 10), "Desktop Light — Active Session Card & 16 Domain-Grouped Permissions (Audit, Catalog, CRM, etc.)", fill="#52525B", font=body_font)
    draw.text((1280, curr_y + sec_d_h + 10), "Desktop Dark Mode — High Contrast Session Identity & RBAC Token Grid", fill="#52525B", font=body_font)

    curr_y += sec_d_h + 60

    # Section 4: Responsive Tablet & Mobile
    draw.text((60, curr_y), "4. Responsive Layout (Tablet & Mobile Navigation Pills)", fill="#141414", font=section_font)
    curr_y += 40

    tab_w = 900
    tab_h = int(tab_w * (overview_tablet.height / overview_tablet.width))
    tab_resized = overview_tablet.resize((tab_w, tab_h), Image.Resampling.LANCZOS)

    mob_w = 340
    mob_h = int(mob_w * (overview_mobile.height / overview_mobile.width))
    mob_resized = overview_mobile.resize((mob_w, mob_h), Image.Resampling.LANCZOS)

    canvas.paste(tab_resized, (60, curr_y))
    canvas.paste(mob_resized, (1020, curr_y))

    draw.rectangle([(60, curr_y), (60 + tab_w, curr_y + tab_h)], outline="#E4E4E7", width=2)
    draw.rectangle([(1020, curr_y), (1020 + mob_w, curr_y + mob_h)], outline="#E4E4E7", width=2)

    draw.text((60, curr_y + tab_h + 10), "Tablet Viewport (1024×768) — Horizontal Scrollable Subnav Pills", fill="#52525B", font=body_font)
    draw.text((1020, curr_y + mob_h + 10), "Mobile (390×844) — Single-Column Responsive Card Stack", fill="#52525B", font=body_font)

    # Save
    canvas.save(OUTPUT_PATH, "PNG")
    shutil.copyfile(OUTPUT_PATH, os.path.join(ARTIFACT_DIR, "contact-sheet.png"))
    print(f"Contact sheet created: {OUTPUT_PATH}")

if __name__ == "__main__":
    create_contact_sheet()
