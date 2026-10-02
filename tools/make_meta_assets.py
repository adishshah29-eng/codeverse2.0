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
    """Icons from the Dali mask on the event poster (tools/icon-mask.png, transparent, square)."""
    import base64
    import io

    mask = Image.open(ROOT / "tools" / "icon-mask.png").convert("RGBA")

    def on_tile(size: int, pad: float, bg=INK) -> Image.Image:
        tile = Image.new("RGBA", (size, size), bg + (255,) if bg else (0, 0, 0, 0))
        inner = round(size * (1 - 2 * pad))
        m = mask.resize((inner, inner), Image.LANCZOS)
        tile.alpha_composite(m, ((size - inner) // 2, (size - inner) // 2))
        return tile

    # SVG wrapper around a 128px PNG: keeps the favicon.svg URL working in every browser that reads SVG icons.
    buf = io.BytesIO()
    on_tile(128, 0.0, bg=None).save(buf, "PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode()
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 64 64">\n'
        f'  <image width="64" height="64" href="data:image/png;base64,{b64}"/>\n'
        "</svg>\n"
    )
    (SITE / "favicon.svg").write_text(svg, encoding="utf-8")

    # .ico fallback for Safari and older browsers (transparent, mask fills the frame).
    on_tile(48, 0.0, bg=None).save(SITE / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    on_tile(32, 0.0, bg=None).save(SITE / "favicon-32.png", optimize=True)

    # iOS ignores transparency, so the touch icon sits on the site's ink background with breathing room.
    on_tile(180, 0.1).convert("RGB").save(SITE / "apple-touch-icon.png", optimize=True)


if __name__ == "__main__":
    og_image()
    favicon()
    print("wrote og.jpg, favicon.svg, favicon.ico, favicon-32.png, apple-touch-icon.png")
