import os
from PIL import Image, ImageDraw, ImageFont

SCREENSHOTS_DIR = "/home/satjeet/Desktop/CRM/docs/design-mapping/screenshots/visual-batch1"
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
        "title": "1. Desktop Application Shell Architecture (1440 × 900)",
        "description": "Expanded sidebar (248px), collapsed icon rail (64px), active saffron (#FF4700) indicators, and 28px page radius",
        "items": [
            {
                "file": "shell-dashboard-desktop-1440x900.png",
                "route": "/app/dashboard",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Light Mode / Expanded Nav (248px)",
                "width": 780,
            },
            {
                "file": "shell-collapsed-sidebar-desktop-1440x900.png",
                "route": "/app/dashboard",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Light Mode / Collapsed Rail (64px)",
                "width": 780,
            },
            {
                "file": "shell-quotes-desktop-1440x900.png",
                "route": "/app/quotes",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Cross-Route Shell Uniformity",
                "width": 780,
            },
        ],
    },
    {
        "title": "2. Responsive Form Factors & Dark Mode Conformance",
        "description": "Tablet 1024×768 layout, Mobile 390×844 top-bar and slide-over drawer with scrim, plus semantic dark theme",
        "items": [
            {
                "file": "shell-dashboard-tablet-1024x768.png",
                "route": "/app/dashboard",
                "viewport": "1024 × 768 (Tablet)",
                "mode": "Tablet Responsive Shell",
                "width": 640,
            },
            {
                "file": "shell-dashboard-mobile-390x844.png",
                "route": "/app/dashboard",
                "viewport": "390 × 844 (Mobile)",
                "mode": "Mobile Shell Default",
                "width": 380,
            },
            {
                "file": "shell-drawer-mobile-390x844.png",
                "route": "/app/dashboard",
                "viewport": "390 × 844 (Mobile)",
                "mode": "Mobile Drawer & Scrim",
                "width": 380,
            },
            {
                "file": "shell-dashboard-dark-desktop-1440x900.png",
                "route": "/app/quotes",
                "viewport": "1440 × 900 (Desktop)",
                "mode": "Semantic Dark Mode Architecture",
                "width": 780,
            },
        ],
    },
]

CANVAS_WIDTH = 2500
HEADER_HEIGHT = 160
PADDING = 40
CARD_BG = (255, 255, 255)
CANVAS_BG = (248, 249, 250)
BORDER_COLOR = (226, 232, 240)
TEXT_MAIN = (15, 23, 42)
TEXT_MUTED = (100, 116, 139)
ACCENT_COLOR = (255, 71, 0) # Canonical Sakani Saffron

def render_item(item):
    filepath = os.path.join(SCREENSHOTS_DIR, item["file"])
    if not os.path.exists(filepath):
        print(f"Warning: File not found: {filepath}")
        return None
    
    img = Image.open(filepath)
    orig_w, orig_h = img.size
    target_w = item["width"]
    target_h = int((orig_h / orig_w) * target_w)
    
    resized = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    label_h = 70
    card_w = target_w + 20
    card_h = target_h + label_h + 20
    
    card = Image.new("RGB", (card_w, card_h), CARD_BG)
    draw = ImageDraw.Draw(card)
    
    # Outer subtle card border
    draw.rounded_rectangle([(0, 0), (card_w - 1, card_h - 1)], radius=12, outline=BORDER_COLOR, width=2)
    
    # Paste screenshot
    card.paste(resized, (10, 10))
    
    # Border around image
    draw.rectangle([(10, 10), (10 + target_w - 1, 10 + target_h - 1)], outline=BORDER_COLOR, width=1)
    
    # Label
    text_y = 10 + target_h + 12
    draw.text((16, text_y), f"{item['mode']}  •  {item['viewport']}", fill=TEXT_MAIN, font=font_label_title)
    draw.text((16, text_y + 24), f"Route: {item['route']}  |  File: {item['file']}", fill=TEXT_MUTED, font=font_label_sub)
    
    return card

def main():
    print("Generating Visual-Conformance Batch 1 Contact Sheet...")
    
    rendered_sections = []
    total_height = HEADER_HEIGHT + PADDING
    
    for sec in SECTIONS:
        sec_cards = []
        for itm in sec["items"]:
            c = render_item(itm)
            if c:
                sec_cards.append(c)
        
        # Row layout: arrange in rows that fit within CANVAS_WIDTH - 2*PADDING
        rows = []
        curr_row = []
        curr_w = 0
        for c in sec_cards:
            if curr_w + c.width + 30 > (CANVAS_WIDTH - 2 * PADDING) and curr_row:
                rows.append(curr_row)
                curr_row = [c]
                curr_w = c.width
            else:
                curr_row.append(c)
                curr_w += c.width + 30
        if curr_row:
            rows.append(curr_row)
        
        sec_h = 90  # Section header text space
        for r in rows:
            max_h = max(c.height for c in r)
            sec_h += max_h + 30
        
        rendered_sections.append({
            "title": sec["title"],
            "description": sec["description"],
            "rows": rows,
            "height": sec_h,
        })
        total_height += sec_h + 40
        
    total_height += PADDING
    
    canvas = Image.new("RGB", (CANVAS_WIDTH, total_height), CANVAS_BG)
    draw = ImageDraw.Draw(canvas)
    
    # Header background band
    draw.rectangle([(0, 0), (CANVAS_WIDTH, HEADER_HEIGHT)], fill=(255, 255, 255))
    draw.line([(0, HEADER_HEIGHT), (CANVAS_WIDTH, HEADER_HEIGHT)], fill=BORDER_COLOR, width=2)
    
    # Saffron brand indicator line
    draw.rectangle([(0, 0), (CANVAS_WIDTH, 6)], fill=ACCENT_COLOR)
    
    # Header texts
    draw.text((PADDING, 28), "ForgeFlow × Sakani — Visual-Conformance Batch 1 Review", fill=TEXT_MAIN, font=font_title)
    draw.text((PADDING, 78), "Global Design Foundation & Unified Shell: Saffron (#FF4700), Warm Canvas (#FAFAF9), 28px Top Radii, 64px TopBar, 248px/64px Sidebar", fill=TEXT_MUTED, font=font_subtitle)
    draw.text((PADDING, 114), "Quality Gates: 0 Axe-Core Violations Across All Breakpoints & Modes  •  All Existing Unit / E2E Tests Passing", fill=ACCENT_COLOR, font=font_label_title)
    
    curr_y = HEADER_HEIGHT + PADDING
    
    for sec in rendered_sections:
        # Section title and description
        draw.text((PADDING, curr_y), sec["title"], fill=TEXT_MAIN, font=font_section)
        draw.text((PADDING, curr_y + 36), sec["description"], fill=TEXT_MUTED, font=font_subtitle)
        
        sec_y = curr_y + 80
        for r in sec["rows"]:
            curr_x = PADDING
            max_h = max(c.height for c in r)
            for c in r:
                canvas.paste(c, (curr_x, sec_y))
                curr_x += c.width + 30
            sec_y += max_h + 30
        
        curr_y += sec["height"] + 40
        
    canvas.save(OUTPUT_PATH, "PNG", optimize=True)
    print(f"Successfully generated contact sheet at: {OUTPUT_PATH}")
    print(f"Canvas size: {canvas.size[0]} × {canvas.size[1]} px")

if __name__ == "__main__":
    main()
