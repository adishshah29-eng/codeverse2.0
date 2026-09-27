"""Build web-ready layers from assets/raw → site/assets, and write site/js/layout.js.

Run from the project root:  python tools/build_assets.py
"""

from __future__ import annotations

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "raw"
OUT = ROOT / "site" / "assets"
PREVIEW = ROOT / "assets" / "preview"
LAYOUT_JS = ROOT / "site" / "js" / "layout.js"

DESIGN_W, DESIGN_H = 1672, 941  # H1 frame: every hero layer is positioned in this space


# ---------------------------------------------------------------- io helpers

def load_rgba(name: str) -> np.ndarray:
    return np.array(Image.open(RAW / name).convert("RGBA")).astype(np.float32) / 255.0


def save_webp(rgba: np.ndarray, path: Path, quality: int = 86, max_side: int | None = None) -> tuple[int, int]:
    path.parent.mkdir(parents=True, exist_ok=True)
    im = Image.fromarray((np.clip(rgba, 0, 1) * 255).round().astype(np.uint8), "RGBA")
    if max_side and max(im.size) > max_side:
        im.thumbnail((max_side, max_side), Image.LANCZOS)
    if im.getextrema()[3][0] == 255:  # fully opaque → drop alpha
        im = im.convert("RGB")
    im.save(path, "WEBP", quality=quality, method=6)
    return im.size


def preview_on_grey(rgba: np.ndarray, name: str) -> None:
    """Composite over mid grey so edge fringes are easy to spot."""
    PREVIEW.mkdir(parents=True, exist_ok=True)
    a = rgba[..., 3:4]
    rgb = rgba[..., :3] * a + 0.5 * (1 - a)
    Image.fromarray((rgb * 255).astype(np.uint8)).save(PREVIEW / f"{name}.jpg", quality=85)


# ---------------------------------------------------------------- keying

def greenness(rgb: np.ndarray) -> np.ndarray:
    return rgb[..., 1] - np.maximum(rgb[..., 0], rgb[..., 2])


def chroma_key(rgba: np.ndarray, lo: float, hi: float, despill: bool = True) -> np.ndarray:
    """Alpha from how much green dominates red/blue; soft ramp between lo and hi."""
    out = rgba.copy()
    g = greenness(rgba[..., :3])
    alpha = 1.0 - np.clip((g - lo) / (hi - lo), 0, 1)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
    out[..., 3] = np.minimum(out[..., 3], alpha)
    if despill:
        # Only pull green down where it exceeds red/blue; leaves neutral and warm colours untouched.
        rgb = out[..., :3]
        cap = np.maximum(rgb[..., 0], rgb[..., 2])
        edge = out[..., 3] < 0.98
        spill = rgb[..., 1] > cap
        rgb[..., 1] = np.where(spill & edge, cap, np.where(spill, rgb[..., 1] * 0.6 + cap * 0.4, rgb[..., 1]))
    return out


def clean_alpha(rgba: np.ndarray, erode_px: int = 1, feather: float = 0.6) -> np.ndarray:
    """Shave the outer pixel ring (glow / halo fringe) and soften the edge slightly."""
    out = rgba.copy()
    a = out[..., 3]
    if erode_px:
        a = cv2.erode(a, np.ones((2 * erode_px + 1,) * 2, np.uint8))
    if feather:
        a = cv2.GaussianBlur(a, (0, 0), feather)
    out[..., 3] = a
    return out


def bbox(alpha: np.ndarray, thresh: float = 0.03) -> tuple[int, int, int, int]:
    ys, xs = np.nonzero(alpha > thresh)
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def crop(rgba: np.ndarray, box: tuple[int, int, int, int]) -> np.ndarray:
    x0, y0, x1, y1 = box
    return rgba[y0:y1, x0:x1]


# ---------------------------------------------------------------- colour matching

def to_lab(rgb: np.ndarray) -> np.ndarray:
    return cv2.cvtColor(np.clip(rgb, 0, 1).astype(np.float32), cv2.COLOR_RGB2LAB)


def match_colour(rgba: np.ndarray, src_mask: np.ndarray, target_rgb: np.ndarray, target_mask: np.ndarray,
                 strength: float) -> np.ndarray:
    """Reinhard transfer in LAB: move the source's mean/std toward the target region's."""
    out = rgba.copy()
    src, tgt = to_lab(rgba[..., :3]), to_lab(target_rgb)
    s, t = src[src_mask], tgt[target_mask]
    s_mu, s_sd = s.mean(0), s.std(0) + 1e-5
    t_mu, t_sd = t.mean(0), t.std(0) + 1e-5
    moved = (src - s_mu) / s_sd * t_sd + t_mu
    blended = src + (moved - src) * strength
    out[..., :3] = np.clip(cv2.cvtColor(blended.astype(np.float32), cv2.COLOR_LAB2RGB), 0, 1)
    return out


def fit_circle(xs: np.ndarray, ys: np.ndarray) -> tuple[float, float, float]:
    """Least-squares circle through edge points."""
    A = np.column_stack([xs, ys, np.ones_like(xs)])
    b = xs ** 2 + ys ** 2
    c = np.linalg.lstsq(A, b, rcond=None)[0]
    cx, cy = c[0] / 2, c[1] / 2
    return float(cx), float(cy), float(np.sqrt(c[2] + cx ** 2 + cy ** 2))


# ---------------------------------------------------------------- build

def main() -> None:
    layout: dict = {"design": {"w": DESIGN_W, "h": DESIGN_H}}
    h1 = load_rgba("H1.png")[..., :3]

    # H1: static poster / reduced-motion fallback
    save_webp(load_rgba("H1.png"), OUT / "hero" / "poster.webp", quality=82)

    # H2: wall with the doorway keyed out. High thresholds so the mint tiles survive.
    wall = load_rgba("H2.png")
    hole_mask = greenness(wall[..., :3]) > 0.3
    ys, xs = np.nonzero(hole_mask)
    hole = {"cx": float((xs.min() + xs.max()) / 2), "cy": float((ys.min() + ys.max()) / 2),
            "r": float((xs.max() - xs.min() + ys.max() - ys.min()) / 4)}
    wall = chroma_key(wall, lo=0.18, hi=0.35, despill=True)
    # Grow the hole by a pixel so no green rim survives against the steel lip.
    wall[..., 3] = cv2.erode(wall[..., 3], np.ones((3, 3), np.uint8))
    save_webp(wall, OUT / "hero" / "wall.webp")
    preview_on_grey(wall, "wall")
    layout["hole"] = hole

    # H3: the vault beyond the door, nudged toward H1's palette.
    vault = load_rgba("H3.png")
    vault = match_colour(vault, np.ones(vault.shape[:2], bool), h1, np.ones(h1.shape[:2], bool), 0.35)
    save_webp(vault, OUT / "hero" / "vault.webp")
    # Where the aisle's vanishing point sits, so it can be lined up with the doorway centre.
    layout["vault"] = {"vx": 836 / 1672, "vy": 470 / 941}

    # H4: door. Key it, fit the disc, cut the hinge off (the wall already has one).
    door = chroma_key(load_rgba("H4.png"), lo=0.12, hi=0.35)
    solid = door[..., 3] > 0.5
    rows = np.arange(solid.shape[0])
    left = np.array([np.argmax(r) if r.any() else -1 for r in solid[:, :900]])
    ok = left > 0
    cx, cy, r = fit_circle(left[ok].astype(float), rows[ok].astype(float))
    yy, xx = np.mgrid[: door.shape[0], : door.shape[1]]
    disc = np.clip((r - np.hypot(xx - cx, yy - cy)) / 2.0 + 0.5, 0, 1)
    door[..., 3] *= disc
    box = (int(cx - r - 2), int(cy - r - 2), int(cx + r + 2), int(cy + r + 2))
    door = crop(door, box)
    grey = (np.abs(h1 - h1.mean(-1, keepdims=True)).max(-1) < 0.06)
    door_region = np.zeros(h1.shape[:2], bool)
    door_region[110:620, 1100:1350] = True
    door = match_colour(door, door[..., 3] > 0.5, h1, grey & door_region, 0.3)
    save_webp(door, OUT / "hero" / "door.webp")
    preview_on_grey(door, "door")
    door_r = hole["r"] * 1.1  # closed door face covers the bore plus a small lip
    layout["door"] = {"cx": hole["cx"], "cy": hole["cy"], "r": door_r, "hingeX": hole["cx"] + door_r}

    # H5/H6: crew. H6 (bag in left hand) is the left figure in H1; H5 the right one.
    red = (h1[..., 0] > 0.35) & (h1[..., 0] - h1[..., 1] > 0.18) & (h1[..., 0] - h1[..., 2] > 0.15)
    crew_region = np.zeros(h1.shape[:2], bool)
    crew_region[250:630, 520:990] = True
    h1_pose = {"l": (504, 231, 0.268), "r": (803, 312, 0.208)}  # x, y, scale of full raw image in H1
    layout["crew"] = {}
    for key, name in (("l", "H6.png"), ("r", "H5.png")):
        crew = clean_alpha(load_rgba(name), erode_px=1)
        suit = (crew[..., 3] > 0.9) & (crew[..., 0] - crew[..., 1] > 0.18)
        crew = match_colour(crew, suit, h1, red & crew_region, 0.6)
        bx = bbox(crew[..., 3])
        crew = crop(crew, bx)
        save_webp(crew, OUT / "hero" / f"crew-{key}.webp")
        preview_on_grey(crew, f"crew-{key}")
        x, y, s = h1_pose[key]
        layout["crew"][key] = {"x": x + bx[0] * s, "y": y + bx[1] * s,
                               "w": (bx[2] - bx[0]) * s, "h": (bx[3] - bx[1]) * s}

    # H7: foreground money, matched to the money carpet in H1.
    money = clean_alpha(load_rgba("H7.png"), erode_px=1)
    money_region = np.zeros(h1.shape[:2], bool)
    money_region[660:, :] = True
    money = match_colour(money, money[..., 3] > 0.9, h1, money_region, 0.5)
    bx = bbox(money[..., 3])
    money = crop(money, bx)
    save_webp(money, OUT / "hero" / "money.webp")
    preview_on_grey(money, "money")
    layout["money"] = {"x": 0, "y": 612, "w": DESIGN_W, "h": (bx[3] - bx[1]) * DESIGN_W / (bx[2] - bx[0])}

    # Props: key or clean, trim, pad, downsize.
    props = {"P1": "blueprint", "P2": "radio", "P3": "gold", "P4": "mask", "P5": "phone", "P6": "cctv"}
    layout["props"] = {}
    for raw, name in props.items():
        img = load_rgba(f"{raw}.png")
        img = clean_alpha(img, erode_px=1) if img[..., 3].min() < 0.99 else chroma_key(img, lo=0.12, hi=0.35)
        img = crop(img, bbox(img[..., 3]))
        pad = int(max(img.shape[:2]) * 0.04)
        img = np.pad(img, ((pad, pad), (pad, pad), (0, 0)))
        w, h = save_webp(img, OUT / "props" / f"{name}.webp", max_side=900)
        preview_on_grey(img, f"prop-{name}")
        layout["props"][name] = {"w": w, "h": h}

    LAYOUT_JS.parent.mkdir(parents=True, exist_ok=True)
    LAYOUT_JS.write_text("// Generated by tools/build_assets.py — do not edit by hand.\n"
                         f"window.LAYOUT = {json.dumps(layout, indent=2)};\n", encoding="utf-8")
    print(json.dumps(layout, indent=2))


if __name__ == "__main__":
    main()
