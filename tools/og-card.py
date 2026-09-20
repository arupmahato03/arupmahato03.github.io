"""Regenerates Assets/og-card.png from the same tokens as style.css.

Rerun whenever the headline, the role line or the metric strip changes.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG        = (11, 14, 17)
SURFACE   = (17, 21, 26)
SURFACE_2 = (22, 27, 33)
LINE      = (29, 36, 43)
LINE_2    = (42, 50, 59)
INK       = (233, 237, 242)
INK_2     = (156, 167, 179)
INK_3     = (126, 137, 150)
ACCENT    = (45, 212, 167)
ON_ACCENT = (4, 35, 27)

F = "C:/Windows/Fonts/"
sans_b  = lambda s: ImageFont.truetype(F + "segoeuib.ttf", s)
sans_sb = lambda s: ImageFont.truetype(F + "seguisb.ttf", s)
sans    = lambda s: ImageFont.truetype(F + "segoeui.ttf", s)
mono    = lambda s: ImageFont.truetype(F + "consola.ttf", s)
mono_b  = lambda s: ImageFont.truetype(F + "consolab.ttf", s)

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img, "RGBA")

# Accent glow, top right — the same gesture as .hero::before.
# Computed as a real radial falloff on a downscaled layer, then resized: an
# ellipse loop overwrites rather than blends and leaves a visible seam.
GW, GH = 150, 79
gx, gy, grx, gry = 0.88, -0.06, 0.62, 0.48
mask = Image.new("L", (GW, GH), 0)
px = mask.load()
for yy in range(GH):
    for xx in range(GW):
        dx = (xx / GW - gx) / grx
        dy = (yy / GH - gy) / gry
        t = 1.0 - min(1.0, (dx * dx + dy * dy) ** 0.5)
        px[xx, yy] = int(255 * 0.10 * (t ** 1.6)) if t > 0 else 0
mask = mask.resize((W, H), Image.LANCZOS)
img.paste(Image.new("RGB", (W, H), ACCENT), (0, 0), mask)
d = ImageDraw.Draw(img, "RGBA")

PAD = 76


def tracked(draw, xy, text, font, fill, track=0.0):
    """Draw text with extra letter-spacing; returns the advance width."""
    x, y = xy
    for ch in text:
        if draw:
            draw.text((x, y), ch, font=font, fill=fill)
        x += draw_len(font, ch) + track
    return x - xy[0]


def draw_len(font, ch):
    return font.getlength(ch)


# --- status pill -----------------------------------------------------------
pill_t = "OPEN TO BACKEND ENGINEERING OPPORTUNITIES"
pf = mono(17)
pw = tracked(None, (0, 0), pill_t, pf, INK_2, 1.6) if False else sum(pf.getlength(c) + 1.6 for c in pill_t)
px, py = PAD, 74
d.rounded_rectangle([px, py, px + pw + 66, py + 40], radius=20, fill=SURFACE, outline=LINE, width=1)
d.ellipse([px + 20, py + 16, px + 28, py + 24], fill=ACCENT)
tracked(d, (px + 40, py + 10), pill_t, pf, INK_2, 1.6)

# --- name + role -----------------------------------------------------------
# Mirrors the hero: "Hi, I'm" in ink, the name in accent, the role line in
# grey sans (not mono caps).
nf = sans_b(84)
hi = "Hi, I'm "
d.text((PAD, 150), hi, font=nf, fill=INK)
d.text((PAD + nf.getlength(hi), 150), "Arup Mahato", font=nf, fill=ACCENT)
d.text((PAD, 252), "Java Backend Engineer", font=sans_sb(50), fill=INK_2)

# --- lead ------------------------------------------------------------------
d.text((PAD, 342), "3+ years building production-grade backend", font=sans(29), fill=INK)
d.text((PAD, 382), "systems with Java, Spring Boot, REST APIs", font=sans(29), fill=INK)
d.text((PAD, 422), "and Microservices.", font=sans(29), fill=INK)

# --- metric strip ----------------------------------------------------------
sy, sh = 496, 78
d.rounded_rectangle([PAD, sy, W - PAD, sy + sh], radius=12, fill=SURFACE, outline=LINE, width=1)

cells = [("3+", "YEARS"), ("10+", "MICROSERVICES"), ("100+", "REST ENDPOINTS"), ("500+", "ACTIVE USERS")]
cw = (W - PAD * 2) / 4
for i, (n, label) in enumerate(cells):
    cx = PAD + cw * i
    if i:
        d.line([cx, sy + 1, cx, sy + sh - 1], fill=LINE, width=1)
    d.text((cx + 26, sy + 12), n, font=sans_b(32), fill=ACCENT)
    tracked(d, (cx + 27, sy + 50), label, mono(15), INK_3, 1.4)

# --- right rail: URL + stack ----------------------------------------------
url = "arupmahato03.github.io"
uf = mono(19)
uw = sum(uf.getlength(c) + 1.4 for c in url)
tracked(d, (W - PAD - uw, 84), url, uf, INK_3, 1.4)

stack = ["Spring Boot", "Microservices", "Spring Security", "PostgreSQL · MySQL", "Redis", "Docker"]
cy = 168
for s in stack:
    f = mono(19)
    w = f.getlength(s)
    d.rounded_rectangle([W - PAD - w - 26, cy, W - PAD, cy + 38], radius=6,
                        fill=SURFACE_2, outline=LINE_2, width=1)
    d.text((W - PAD - w - 13, cy + 8), s, font=f, fill=INK_2)
    cy += 50

# --- accent hairline, bottom ----------------------------------------------
d.line([0, H - 5, W, H - 5], fill=LINE, width=10)
d.line([0, H - 5, 360, H - 5], fill=ACCENT, width=10)

img.save("E:/MASAI/GitHub_portfolio/Assets/og-card.png", optimize=True)
print("og-card.png written")
