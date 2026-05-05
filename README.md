# RESONATE — Interactive String Physics

A vanilla JS interactive webpage where guitar strings react physically to your cursor. Cross a string and it plucks — producing a standing wave driven by the 1D wave equation. Four sections demonstrate how four parameters create completely different physical feelings.

**No build step. No dependencies to install. Open `index.html` in a browser.**

---

## Features

- **Physically accurate plucking** — triangular displacement model (not a sine wave oscillator), zero initial velocity, fixed-end boundary conditions
- **Cursor-speed sensitive** — a slow drag barely moves the string; a fast flick sends a sharp, high-amplitude wave
- **Standing wave harmonics** — narrow pluck width excites high harmonics; wide pluck width gives a single dominant arc
- **Air distortion** — SVG `feDisplacementMap` subtly warps the hero text when nearby strings vibrate
- **Four physics presets** — RESONATE, SLACK, STEEL, ELASTIC — each a distinct physical feel
- **Pluck feedback** — expanding ring + center flash on every string touch
- **Smooth scroll** — Lenis with GSAP ScrollTrigger reveals
- **Film grain overlay** — animated fractal noise at 4% opacity
- **Custom cursor** — grows when near a string

---

## Quick Start

```bash
git clone https://github.com/your-username/resonate.git
cd resonate
open index.html        # macOS
# or just drag index.html into any browser
```

No npm, no bundler, no config.

---

## Physics Presets

| # | Name | Tension | Damping | Amplitude | Plk Width | Feel |
|---|------|---------|---------|-----------|-----------|------|
| 01 | RESONATE | 0.45 | 0.9982 | 26 px | 0.18 | Balanced musical guitar |
| 02 | SLACK | 0.12 | 0.9993 | 40 px | 0.38 | Loose bass string, deep slow wave |
| 03 | STEEL | 0.48 | 0.974 | 13 px | 0.08 | Tight, snappy, quick muted decay |
| 04 | ELASTIC | 0.20 | 0.9997 | 34 px | 0.30 | Rubber band, rings nearly forever |

---

## Parameter Reference

### `TENSION` — wave propagation speed
`a_i = TENSION × (x[i−1] + x[i+1] − 2×x[i])`

Controls how fast the wave travels from the pluck point to the ends and back. Must stay below `0.5` (CFL stability condition — above this the simulation explodes).

| Range | Feel |
|-------|------|
| `0.10–0.20` | Slow, elastic, rubbery |
| `0.35–0.45` | Balanced guitar feel |
| `0.46–0.49` | Fast, taut, snappy |

---

### `DAMPING` — energy retained per frame
Every frame: `velocity *= DAMPING`

Controls how long the string rings before returning to rest. Closer to `1.0` = more energy retained = longer ring.

| Range | Feel |
|-------|------|
| `0.970–0.985` | Muted, quick decay |
| `0.995–0.999` | Natural guitar sustain |
| `0.9995+` | Rubber band, rings almost forever |

---

### `AMPLITUDE` — max pluck displacement in px
Set by `Math.min(cursorSpeed × SPEED_SCALE, AMPLITUDE)`. Controls the peak height of the triangular displacement at the moment of pluck.

---

### `PLK WIDTH` — pluck triangle half-width as fraction of string length
Determines which harmonics are excited:

| Range | Result |
|-------|--------|
| `0.06–0.12` | Narrow triangle → high harmonics → short wiggly waves |
| `0.18–0.25` | Mixed harmonics → natural guitar look |
| `0.30–0.45` | Wide triangle → fundamental dominates → one smooth arc |

---

## File Structure

```
resonate/
├── index.html              # Markup only — sections, SVG filter, canvas elements
├── css/
│   └── style.css           # Design tokens, layout, grain animation, typography
├── js/
│   └── main.js             # Physics engine, section manager, input, GSAP, Lenis
├── docs/
│   └── string-physics-prompt.md  # Full rebuild prompt — hand to any AI to recreate
├── .gitignore
└── README.md
```

---

## How the Physics Works

Each string is a chain of `120` nodes connected by springs. Every animation frame:

1. **Acceleration** is computed for each interior node from its two neighbours using the 1D wave equation
2. **Velocity** is updated and multiplied by `DAMPING` (energy loss)
3. **Position** is updated from velocity (two-pass leapfrog — prevents asymmetric drift)
4. **Boundary conditions** — first and last nodes are always fixed at zero (nut and bridge)

When the cursor crosses a string, a **triangular displacement** is applied — the string is physically lifted to a peak at the cursor's X position, falling linearly to zero at `pluckWidth` distance on each side. Initial velocity is zero. The wave equation then naturally decomposes this shape into its harmonic series and evolves the motion from there.

---

## Tech Stack

| Tool | Version | Role |
|------|---------|------|
| Vanilla JS | ES2020 | Physics engine, canvas rendering |
| GSAP | 3.12.5 | Entrance animations, ScrollTrigger |
| Lenis | 1.1.14 | Smooth scroll |
| Space Grotesk | — | Display typeface (Google Fonts) |

All loaded via CDN. Zero local dependencies.

---

## Recreating the Effect

See [`docs/string-physics-prompt.md`](docs/string-physics-prompt.md) for a complete AI-ready prompt that documents every parameter, physics decision, and architecture choice. Hand it to any LLM to regenerate the project from scratch.

---

## License

MIT — use freely, attribution appreciated.
