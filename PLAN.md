# CodeVerse 2.0 — Implementation Plan

Money Heist themed event site. Event: 9 October. Registration: Unstop (external link).
Structure reverse-engineered from `ecomtemplate/templates/neon-oiran/index.html`.

## 1. Asset pipeline (`tools/build_assets.py`)

Input: `assets/raw/*.png` (generated in Gemini). Output: `site/assets/**.webp` + `site/js/layout.js`.

| Raw | Treatment | Output |
|---|---|---|
| H1 | Reference only; colour target; static fallback hero | `hero/poster.webp` |
| H2 | Chroma-key the green doorway → transparent hole | `hero/wall.webp` |
| H3 | Colour-match toward H1 | `hero/vault.webp` |
| H4 | Chroma-key, crop to the door disc (drop hinge, H2 already has one), colour-match to the door in H1 | `hero/door.webp` |
| H5, H6 | Existing alpha; 1px edge erode to kill glow fringe; colour-match to the crew in H1 | `hero/crew-r.webp`, `hero/crew-l.webp` |
| H7 | Existing alpha; colour-match to H1 money | `hero/money.webp` |
| P1–P6 | Chroma-key or existing alpha, despill, trim, colour-match | `props/*.webp` |

**Chroma key:** HSV threshold + soft edge + green despill. It's more precise than SAM2 on a flat green screen, so SAM2 stays a fallback for any layer that keys badly.

**Colour match:** Reinhard LAB mean/std transfer, from masked source pixels to the matching region of H1, at partial strength so the layers read as one shot.

**Geometry:** measured automatically (doorway hole centre/radius from H2's green, door disc from H4) and written to `layout.js`, so the HTML never hard-codes pixel guesses.

## 2. Hero: 3D scroll scene (Act I, "The Break-in")

Same skeleton as the template: a tall scroll track, a sticky 100vh stage, and a GSAP ScrollTrigger timeline with `scrub`.

- **Scene box:** a 16:9 box sized to *cover* the viewport; every layer is positioned in percentages of H1's 1672×941 frame, so the layers stay aligned at any screen size.
- **Real CSS 3D:** the box has `perspective`, each layer sits at its own `translateZ`, and the whole box tilts 2–3° toward the mouse.
- **Layers, far → near:** vault (H3) → light spill → door (H4) → wall + doorframe (H2) → crew (H6, H5) → money (H7) → grade (grain + vignette) → text beats.

Scroll timeline:

| Scroll | Motion | Copy |
|---|---|---|
| 0–10% | Door closed, crew in the foreground | "Every great heist begins with a plan." |
| 10–35% | Door swings open on its hinge (`rotateY`), gold light spills out | **CODEVERSE 2.0** |
| 30–60% | Crew walk to the doorway (shrink + converge), camera creeps forward | "[N] rounds. [N] hours. No second chances." |
| 60–85% | Camera flies through: wall/door scale up and fade, money drops away, vault fills the screen | "Inside: ₹[PRIZE]" |
| 85–100% | Settle in the vault | "The heist begins 09.10" + **Join the Crew** (Unstop) |

`prefers-reduced-motion` or no JS → a static H1 poster with the same copy.

## 3. Sections (template section → heist version)

| Template | Section | Props |
|---|---|---|
| Expanding panels | **Act II: The Plan**, one panel per round/phase | P1 blueprint, P2 walkie-talkie, P3 gold |
| Arsenal | **The Arsenal**: what participants get | — |
| REC // LIVE FEED | **Security Footage**: CodeVerse 1.0 highlights in a CCTV HUD | P6 CCTV camera |
| Roster carousel | **The Crew**: organizers and mentors with city codenames | P4 mask |
| Editions / pricing | **The Loot**: prize tiers | P3 gold |
| System specs | **The Professor's Rules**: eligibility and FAQ | P5 red phone |
| Final CTA + footer | **Enter the Mint**: Unstop link, Bella ciao sign-off | — |

Content that isn't known yet is marked `[LIKE THIS]` in `site/index.html`.

## 4. Stack

Static HTML/CSS/JS, no build step. GSAP 3 + ScrollTrigger from cdnjs, fonts from Google Fonts. Deploys as-is to Netlify, Vercel or GitHub Pages.

```
site/
  index.html
  css/style.css
  js/layout.js   (generated)
  js/main.js
  assets/hero/*.webp
  assets/props/*.webp
tools/build_assets.py
```

## 5. Verification
- Run the pipeline and eyeball every output on a grey background (edges, fringes).
- Hero: step through the scroll at 0/25/50/75/100% at desktop and phone widths, and check layer alignment against H1.
- Check the console for errors, reduced-motion behaviour, and total asset weight.

## Later (not in this pass)
- Per-pixel depth maps (Depth Anything) plus a WebGL displacement shader for extra roundness.
- Real content: rounds, prizes, crew, sponsors, the Unstop URL, and 1.0 footage.

---

# Phase 2 — Growth, polish and event features (2026-09-26)

Content rules still apply: no problem statements, budget or publicity plan on the site.

## Architecture
- `site/js/config.js`: the one file you edit (Unstop URL, dates, seats taken, sponsors, crew, site URL).
- `site/js/features.js`: everything new (status bar, countdowns, share, calendar, crew ID card, sound, etc.).
- `site/js/main.js`: hero + section behaviour only (gets loader hook, skip intro, gyro tilt).
- Test switches: `?state=soon|open|closed` and `?now=2026-10-09T11:00:00+05:30` fake the date, so every state can be previewed.

## What gets built
| # | Feature | Notes |
|---|---|---|
| 1 | Registration state by date | soon / open / closed labels and links on every Join button |
| 2 | Registration countdown | thin status bar above the nav |
| 3 | Seats left | `seatsTaken` in config; hidden when null |
| 4 | Sticky mobile CTA | after the hero, hides at the final section |
| 5 | Share with your crew | Web Share, WhatsApp fallback |
| 6 | Analytics + UTM | Vercel Analytics injected off-localhost; Unstop link tagged with source |
| 7 | Crew ID card generator | canvas, downloadable and shareable |
| 8 | Add to calendar | .ics download + Google Calendar link |
| 9 | Previews, favicon, Event schema | OG image generated; `tools/set_site_url.py` sets the domain after deploy |
| 10 | WhatsApp contact | next to the phone number |
| 11 | Loading screen | progress bar over the hero layers |
| 12 | Skip intro | scrolls past the hero |
| 13 | Gyro tilt | Android/no-permission devices only; iOS keeps the idle sway |
| 14 | Reticle cursor | fine pointers, hero only |
| 15 | Typewriter kickers | on reveal |
| 17 | Sound toggle | synthesised drone + heartbeat, off by default (no copyrighted music) |
| 18 | Count-up numbers | prize amounts and 45 → 10 → 1 |
| 19 | Redacted teaser | generic redaction bars, no task count or names |
| 20 | Live schedule | highlights the current slot on event day |
| 21 | Venue map | address, Maps link, embedded map |
| 22/23 | Financiers / Crew | data-driven from config; hidden while empty |
| 25 | Performance | vercel.json cache headers, fetchpriority, decoding |
| 26 | Accessibility | skip link, focus, live regions, reduced-motion respected |

## Not doing (and why)
- **#16 depth-map parallax:** a WebGL shader over the hero is the riskiest change on the list; it needs its own iteration.
- **#24 event-day scoreboard / hint pages:** needs a backend and data model; separate project.
- **#27 custom domain:** done in Vercel's dashboard, not in code.
- **Bella Ciao audio:** copyrighted; sound is synthesised instead.
