"""Replace the __SITE_URL__ placeholder (link previews, canonical, schema, sitemap) with your real domain.

Run once after you know the URL:  python tools/set_site_url.py https://codeverse.vercel.app
"""

import sys
from pathlib import Path

if len(sys.argv) != 2 or not sys.argv[1].startswith("http"):
    sys.exit("usage: python tools/set_site_url.py https://your-domain")

url = sys.argv[1].rstrip("/")
site = Path(__file__).resolve().parents[1] / "site"
for name in ("index.html", "robots.txt", "sitemap.xml"):
    path = site / name
    path.write_text(path.read_text(encoding="utf-8").replace("__SITE_URL__", url), encoding="utf-8")
    print("updated", name)
