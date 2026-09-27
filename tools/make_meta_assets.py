"""Generate the link-preview image, favicon and touch icon.

Run from the project root:  python tools/make_meta_assets.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
FONTS = Path("C:/Windows/Fonts")
INK, RED, PAPER, TILE = (11, 15, 14), (196, 32, 29), (239, 234, 224), (169, 201, 189)


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    for candidate in (name, "arialbd.ttf"):
        try:
            return ImageFont.truetype(str(FONTS / candidate), size)
        except OSError:
            continue
    return ImageFont.load_default()


def og_image() -> None:
    W, H = 1200, 630
    poster = Image.open(ROOT / "assets" / "raw" / "H1.png").convert("RGB")
    scale = max(W / poster.width, H / poster.height)
    poster = poster.resize((int(poster.width * scale), int(poster.height * scale)), Image.LANCZOS)
    poster = poster.crop(((poster.width - W) // 2, (poster.height - H) // 2, (poster.width + W) // 2, (poster.height + H) // 2))

    # Darken toward the left so the type reads, keep the vault and crew on the right.
    shade = Image.new("L", (W, H))
    px = shade.load()
    for x in range(W):
        a = int(235 * max(0.0, 1 - x / (W * 0.85)) ** 0.8 + 40)
        for y in range(H):
            px[x, y] = min(255, a + (30 if y < 90 else 0))
    img = Image.composite(Image.new("RGB", (W, H), INK), poster, shade)

    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 14, H], fill=RED)
    d.text((64, 70), "MADRID · 09.10 · OPERATION CODEVERSE", font=font("consola.ttf", 22), fill=TILE)
    big = font("impact.ttf", 150)
    d.text((60, 150), "CODEVERSE", font=big, fill=PAPER)
    d.text((60, 300), "2.0", font=big, fill=RED)
    d.text((64, 480), "Forty-five crews of three. One mint.", font=font("georgia.ttf", 34), fill=PAPER)
    d.text((64, 540), "9 OCTOBER · DJSCE MUMBAI · ₹25,000 IN PRIZES", font=font("consola.ttf", 22), fill=TILE)
    (SITE / "assets").mkdir(parents=True, exist_ok=True)
    img.save(SITE / "assets" / "og.jpg", quality=88, optimize=True)


def favicon() -> None:
    svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#0b0f0e"/>
  <rect x="0" y="0" width="7" height="64" rx="3" fill="#c4201d"/>
  <text x="36" y="46" text-anchor="middle" font-family="Impact, 'Arial Narrow', sans-serif" font-size="40" fill="#efeae0">C</text>
  <circle cx="50" cy="16" r="5" fill="#c4201d"/>
</svg>
'''
    (SITE / "favicon.svg").write_text(svg, encoding="utf-8")

    S = 180
    icon = Image.new("RGB", (S, S), INK)
    d = ImageDraw.Draw(icon)
    d.rectangle([0, 0, 20, S], fill=RED)
    d.text((S // 2 + 8, S // 2 + 6), "C", font=font("impact.ttf", 120), fill=PAPER, anchor="mm")
    d.ellipse([S - 46, 16, S - 22, 40], fill=RED)
    icon.save(SITE / "apple-touch-icon.png")


if __name__ == "__main__":
    og_image()
    favicon()
    print("wrote og.jpg, favicon.svg, apple-touch-icon.png")
