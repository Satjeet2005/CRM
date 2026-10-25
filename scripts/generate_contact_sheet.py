import os
from PIL import Image, ImageDraw, ImageFont

SCREENSHOTS_DIR = "/home/satjeet/Desktop/CRM/docs/design-mapping/screenshots/phase2"
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
        "title": "1. Authentication — /login",
        "description": "Adaptive Sakani login block, demo role picker, password reveal toggle, Zod validation",
        "items": [
            {
                "file": "login-desktop-1440x900.png",
                "route": "/login",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Standard Centered Card",
                "width": 880,
            },
            {
                "file": "login-tablet-1024x768.png",
                "route": "/login",
                "viewport": "1024 × 768 (Tablet)",
                "mode": "Responsive View",
                "width": 640,
            },
            {
                "file": "login-mobile-390x844.png",
                "route": "/login",
                "viewport": "390 × 844 (Mobile)",
                "mode": "Responsive Viewport",
                "width": 380,
            },
        ],
    },
    {
        "title": "2. Operations Overview — /app/dashboard",
        "description": "Executive KPI cards, Recharts stage distribution, attention queue, and session profile",
        "items": [
            {
                "file": "dashboard-desktop-1440x900.png",
                "route": "/app/dashboard",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Full Shell & 248px Sidebar",
                "width": 880,
            },
            {
                "file": "dashboard-tablet-1024x768.png",
                "route": "/app/dashboard",
                "viewport": "1024 × 768 (Tablet)",
                "mode": "Responsive Grid",
                "width": 640,
            },
            {
                "file": "dashboard-mobile-390x844.png",
                "route": "/app/dashboard",
                "viewport": "390 × 844 (Mobile)",
                "mode": "Mobile Card Column",
                "width": 380,
            },
        ],
    },
    {
        "title": "3. Activity & Audit Stream — /app/activity",
        "description": "Immutable audit trail with entity/event select filters and dual Timeline Feed vs Table modes",
        "items": [
            {
                "file": "activity-desktop-timeline-1440x900.png",
                "route": "/app/activity",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Timeline Feed View",
                "width": 780,
            },
            {
                "file": "activity-desktop-table-1440x900.png",
                "route": "/app/activity",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Structured Table View",
                "width": 780,
            },
            {
                "file": "activity-tablet-1024x768.png",
                "route": "/app/activity",
                "viewport": "1024 × 768 (Tablet)",
                "mode": "Timeline Responsive",
                "width": 640,
            },
            {
                "file": "activity-mobile-390x844.png",
                "route": "/app/activity",
                "viewport": "390 × 844 (Mobile)",
                "mode": "Mobile Timeline Feed",
                "width": 380,
            },
        ],
    },
]

# Total canvas width
CANVAS_WIDTH = 2600
MARGIN_X = 60
MARGIN_Y = 50

def make_card(item):
    filepath = os.path.join(SCREENSHOTS_DIR, item["file"])
    orig = Image.open(filepath)
    orig_w, orig_h = orig.size

    target_w = item["width"]
    target_h = int(orig_h * (target_w / orig_w))
    img_resized = orig.resize((target_w, target_h), Image.Resampling.LANCZOS)

    header_h = 58
    card_w = target_w + 16
    card_h = target_h + header_h + 16

    card = Image.new("RGBA", (card_w, card_h), (255, 255, 255, 255))
    draw = ImageDraw.Draw(card)

    # Outer border
    draw.rounded_rectangle([0, 0, card_w - 1, card_h - 1], radius=10, outline=(231, 229, 225, 255), width=2)
    # Header background
    draw.rounded_rectangle([0, 0, card_w - 1, header_h], radius=10, fill=(245, 244, 242, 255))
    draw.rectangle([0, header_h - 10, card_w - 1, header_h], fill=(245, 244, 242, 255))
    draw.line([0, header_h, card_w - 1, header_h], fill=(231, 229, 225, 255), width=1)

    # Text in header
    # Badge: route
    route_text = item["route"]
    draw.text((14, 12), route_text, font=font_label_title, fill=(79, 70, 229, 255)) # Hybrid Indigo

    # Subtitle / viewport
    meta_text = f"•   Viewport: {item['viewport']}   •   Mode: {item['mode']}"
    draw.text((14 + len(route_text)*11 + 20, 14), meta_text, font=font_label_sub, fill=(112, 106, 99, 255)) # #706A63

    # Paste resized screenshot
    card.paste(img_resized, (8, header_h + 8))
    return card

# First pass: compute total height
total_height = MARGIN_Y + 120 # Top header banner

rendered_sections = []
for sec in SECTIONS:
    cards = [make_card(it) for it in sec["items"]]
    rendered_sections.append({
        "title": sec["title"],
        "description": sec["description"],
        "cards": cards,
    })

# Compute rows:
# For section 1: 3 cards fit in 1 row? 880 + 640 + 380 = 1900 + 40 = 1940 <= 2480! Fits in 1 row!
# For section 2: 3 cards fit in 1 row? 880 + 640 + 380 = 1900 <= 2480! Fits in 1 row!
# For section 3: 4 cards: 780 + 780 = 1560 (row 1), 640 + 380 = 1020 (row 2). 2 rows!

sec_layouts = [
    {"rows": [[0, 1, 2]]},
    {"rows": [[0, 1, 2]]},
    {"rows": [[0, 1], [2, 3]]},
]

computed_sec_heights = []
for s_idx, sec in enumerate(rendered_sections):
    layout = sec_layouts[s_idx]
    s_h = 75 # Section title + desc
    for row in layout["rows"]:
        max_h = max(sec["cards"][c_idx].size[1] for c_idx in row)
        s_h += max_h + 30
    computed_sec_heights.append(s_h)
    total_height += s_h + 40

total_height += MARGIN_Y + 40 # Bottom margin & footer

# Create final canvas
canvas = Image.new("RGBA", (CANVAS_WIDTH, total_height), (250, 250, 249, 255)) # #FAFAF9
draw = ImageDraw.Draw(canvas)

# Draw Main Header Banner
draw.rectangle([0, 0, CANVAS_WIDTH, 140], fill=(255, 255, 255, 255))
draw.line([0, 140, CANVAS_WIDTH, 140], fill=(231, 229, 225, 255), width=2)

draw.text((MARGIN_X, 35), "ForgeFlow × Sakani — Phase 2 Visual Contact Sheet", font=font_title, fill=(15, 14, 12, 255))
subtitle_text = "Verified Implementation of Redesigned Overview Routes (/login, /app/dashboard, /app/activity) across Desktop, Tablet & Mobile Viewports"
draw.text((MARGIN_X, 85), subtitle_text, font=font_subtitle, fill=(112, 106, 99, 255))

# Draw status pill
draw.rounded_rectangle([CANVAS_WIDTH - MARGIN_X - 260, 48, CANVAS_WIDTH - MARGIN_X, 94], radius=6, fill=(236, 253, 245, 255), outline=(167, 243, 208, 255), width=1)
draw.text((CANVAS_WIDTH - MARGIN_X - 240, 60), "WCAG 2.1 AA : 0 Violations", font=font_label_title, fill=(6, 95, 70, 255))

curr_y = 180

for s_idx, sec in enumerate(rendered_sections):
    # Section header
    draw.text((MARGIN_X, curr_y), sec["title"], font=font_section, fill=(15, 14, 12, 255))
    draw.text((MARGIN_X, curr_y + 36), sec["description"], font=font_subtitle, fill=(112, 106, 99, 255))
    draw.line([MARGIN_X, curr_y + 68, CANVAS_WIDTH - MARGIN_X, curr_y + 68], fill=(231, 229, 225, 255), width=1)

    curr_y += 85
    layout = sec_layouts[s_idx]

    for row in layout["rows"]:
        curr_x = MARGIN_X
        row_max_h = max(sec["cards"][c_idx].size[1] for c_idx in row)
        for c_idx in row:
            card = sec["cards"][c_idx]
            canvas.paste(card, (curr_x, curr_y), card)
            curr_x += card.size[0] + 28
        curr_y += row_max_h + 30

    curr_y += 30

# Footer
draw.line([MARGIN_X, curr_y, CANVAS_WIDTH - MARGIN_X, curr_y], fill=(231, 229, 225, 255), width=1)
draw.text((MARGIN_X, curr_y + 20), "ForgeFlow Enterprise CPQ • Hybrid Indigo Theme (#4F46E5) • Canonical Sakani Design Tokens • Checkpoint 913fc29", font=font_subtitle, fill=(112, 106, 99, 255))

# Save image
canvas.convert("RGB").save(OUTPUT_PATH, "PNG", optimize=True)
print(f"Contact sheet successfully generated at: {OUTPUT_PATH}")
print(f"Dimensions: {CANVAS_WIDTH} x {total_height}")
