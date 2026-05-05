# Guitar String Hero — Rebuild Prompt & Implementation Spec

> Hand this file to any AI to recreate the exact effect. Every parameter, physics decision, and architecture choice is documented below.

---

## Objective

Build a multi-section interactive webpage where horizontal strings span the full viewport width. When the user's cursor crosses a string, it is physically plucked — producing a standing wave that decays realistically. A subtle air-distortion filter ripples the hero text when nearby strings vibrate. Four sections demonstrate different physics presets side by side.

---

## File Structure

```
index.html   — HTML structure only (sections, SVG filter, canvas elements)
style.css    — all visual styles, design tokens, grain animation
main.js      — physics engine, section manager, input handler, GSAP, Lenis
```

---

## Physics Model

### Core: 1D Wave Equation (node-chain / mass-spring)

Each string is divided into `numNodes` nodes. Every frame, each interior node's acceleration is computed from its neighbours, then velocity and position are updated in two separate passes (leapfrog integration — prevents asymmetric drift):

```js
// Pass 1 — update velocities
for (let i = 1; i < numNodes - 1; i++) {
  const acc = TENSION * (pos[i-1] + pos[i+1] - 2 * pos[i]);
  vel[i] = (vel[i] + acc) * DAMPING;
}

// Fixed-end boundary conditions (nut and bridge)
vel[0] = 0; pos[0] = 0;
vel[numNodes-1] = 0; pos[numNodes-1] = 0;

// Pass 2 — integrate positions
for (let i = 1; i < numNodes - 1; i++) {
  pos[i] += vel[i];
}
```

**Stability rule:** `TENSION` must be `< 0.5` (CFL condition). At `0.5` the simulation explodes.

---

### Pluck Function: Triangular Displacement

This is the physically correct guitar pluck model. The string is lifted into a triangular shape — peak at the cursor's X position, falling to zero within `pluckWidth` fraction of the string length on each side. Initial velocity is set to **zero**.

```js
pluck(normX, amplitude) {
  const peak = Math.round(normX * (numNodes - 1));   // clamp to [1, numNodes-2]
  const hw   = Math.round(pluckWidth * (numNodes - 1));

  for (let i = 0; i < numNodes; i++) {
    const d = Math.abs(i - peak);
    pos[i] = d < hw ? amplitude * (1 - d / hw) : 0;
    vel[i] = 0;  // zero velocity — energy is all potential at t=0
  }
  pos[0] = 0; pos[numNodes-1] = 0;  // enforce fixed ends
}
```

**Why triangular + zero velocity:**
Energy starts entirely as potential (the displaced shape). The wave equation converts it to kinetic as the string swings through rest position, producing the characteristic guitar oscillation. A velocity impulse instead produces a travelling-wave packet that looks wrong.

**Why `pluckWidth` matters:**
- Wide triangle (0.3–0.4) → excites the fundamental mode → one smooth arc
- Narrow triangle (0.08–0.12) → excites high harmonics → short, wiggly wavelength

---

### Crossing Detection

On every `mousemove`, compare the current and previous cursor Y to the string's rest Y. If the cursor passed through, fire a pluck:

```js
if ((prevY < string.y && currY >= string.y) ||
    (prevY > string.y && currY <= string.y)) {
  const dir = prevY < string.y ? 1 : -1;  // above→down, below→up
  const amp = dir * Math.min(speed * SPEED_SCALE, MAX_AMPLITUDE);
  string.pluck(currX / viewportWidth, amp);
}
```

`speed = Math.sqrt(vx² + vy²)` — cursor speed sets pluck amplitude. Fast flick = loud pluck.

---

## The Four Parameters & What They Do

| Parameter | What it controls | Low value feel | High value feel |
|-----------|-----------------|----------------|-----------------|
| `TENSION` | Wave propagation speed. `a = T*(left + right - 2*center)` | Slow, elastic, rubbery | Fast, snappy, taut. Max stable: `0.49` |
| `DAMPING` | Energy retained per frame (multiplied on velocity each step) | Fast decay, muted, dead | Rings forever. `1.0` = no loss at all |
| `AMPLITUDE` | Peak displacement in px at the pluck point | Subtle, barely visible | Wide, exaggerated arc |
| `PLK WIDTH` | Triangle half-width as fraction of string length | Short wavelength, high harmonics | Long wavelength, fundamental dominates |

---

## The Four Presets

Each preset produces a distinctly different physical feel. Use these as a reference or starting point.

### 01 — RESONATE (balanced, musical guitar)
```js
tension:    0.45
damping:    0.9982
maxAmp:     26      // px
speedScale: 0.55
pluckW:     0.18
numNodes:   120
stringRatios: [0.12, 0.27, 0.73, 0.88]  // Y positions as fraction of section height
stringColor:  'rgb(215, 214, 210)'        // cold silver/white
```

### 02 — SLACK (loose bass string)
```js
tension:    0.12    // very slow wave
damping:    0.9993  // rings for a long time
maxAmp:     40
speedScale: 0.70
pluckW:     0.38    // dominant fundamental, one wide arc
numNodes:   120
stringRatios: [0.15, 0.35, 0.65, 0.85]
stringColor:  'rgb(205, 162, 76)'          // warm amber/gold
```

### 03 — STEEL (high tension, snappy, muted)
```js
tension:    0.48    // near-maximum speed
damping:    0.974   // decays very fast
maxAmp:     13
speedScale: 0.32
pluckW:     0.08    // high harmonics, short wiggly waves
numNodes:   120
stringRatios: [0.12, 0.25, 0.50, 0.75, 0.88]  // 5 strings
stringColor:  'rgb(148, 192, 240)'              // electric blue-white
```

### 04 — ELASTIC (rubber band, nearly lossless)
```js
tension:    0.20    // slow, stretchy wave
damping:    0.9997  // barely loses energy — rings almost forever
maxAmp:     34
speedScale: 0.65
pluckW:     0.30
numNodes:   120
stringRatios: [0.18, 0.40, 0.60, 0.82]
stringColor:  'rgb(92, 198, 158)'               // teal/mint
```

---

## Rendering

Strings are drawn on a `<canvas>` element (absolute, full-section, `pointer-events: none`):

```js
// Resting string
ctx.strokeStyle = `rgba(R,G,B, 0.32)`;
ctx.lineWidth = 1;

// Vibrating string — glow scales with amplitude
const intensity = Math.min(amplitude / maxAmp, 1);
ctx.strokeStyle = `rgba(R,G,B, ${0.45 + intensity * 0.5})`;
ctx.shadowColor = `rgba(R,G,B, ${0.25 + intensity * 0.6})`;
ctx.shadowBlur  = 4 + intensity * 10;
ctx.lineWidth   = 1 + intensity * 0.5;
```

Always reset `ctx.shadowBlur = 0` and `ctx.shadowColor = 'transparent'` after each stroke to prevent glow bleeding onto subsequent paths.

### Device Pixel Ratio
```js
canvas.width  = Math.round(window.innerWidth  * devicePixelRatio);
canvas.height = Math.round(window.innerHeight * devicePixelRatio);
ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
// All drawing coordinates are then in CSS pixels
```

---

## Pluck Effect (on-touch feedback)

Each pluck spawns an `{ x, y, age: 0 }` object. Rendered every frame for 38 frames (~0.6s at 60fps):

```js
const t = ef.age / 38;  // 0 → 1

// Expanding ring
ctx.arc(ef.x, ef.y, t * 48, 0, Math.PI * 2);
ctx.strokeStyle = `rgba(R,G,B, ${(1 - t) * 0.42})`;
ctx.lineWidth   = 1 - t * 0.6;

// Center flash (first 20% of life only)
if (t < 0.2) {
  const fa = (1 - t / 0.2) * 0.88;
  ctx.arc(ef.x, ef.y, 2.5 * (1 - t), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(R,G,B, ${fa})`;
}
```

---

## Air Distortion (hero text)

SVG `feDisplacementMap` applied to the hero text container. Scale is driven by the max amplitude of nearby strings, inverse-distance weighted from the text center:

```html
<filter id="air-distort" x="-30%" y="-30%" width="160%" height="160%">
  <feTurbulence type="turbulence" baseFrequency="0.013 0.019"
    numOctaves="3" seed="11" result="noise"/>
  <feDisplacementMap id="fe-disp" in="SourceGraphic" in2="noise"
    scale="0" xChannelSelector="R" yChannelSelector="G"/>
</filter>
```

```js
// Each frame:
strings.forEach(s => {
  const proximity = Math.max(0, 1 - Math.abs(s.y - textCenterY) / 210);
  influence += (s.maxAmp() / maxAmp) * proximity;
});
const target = Math.min(influence * 8, 8);  // max scale = 8px displacement
distortScale += (target - distortScale) * 0.1;  // smooth interpolation
feDisp.setAttribute('scale', distortScale.toFixed(2));
heroText.style.filter = distortScale > 0.05 ? 'url(#air-distort)' : 'none';
```

---

## Animation Loop

Single GSAP ticker drives everything — Lenis smooth scroll, physics, and canvas render:

```js
const lenis = new Lenis({ duration: 1.4, easing: t => Math.min(1, 1.001 - Math.pow(2, -10*t)) });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(0);

gsap.ticker.add((time, deltaTime) => {
  lenis.raf(time * 1000);

  if (deltaTime < 200) {   // skip physics if tab was backgrounded
    sections.forEach(s => s.step());
    updateDistortion();
  }

  sections.forEach(s => s.render());
});
```

---

## Hero Entrance (GSAP)

Split headline into per-character spans, reveal with stagger:

```js
headlineEl.innerHTML = [...headlineEl.textContent].map(ch =>
  `<span class="char-wrap"><span class="char">${ch}</span></span>`
).join('');

gsap.set('.char', { y: '110%' });

gsap.timeline({ delay: 0.3 })
  .to('#eyebrow', { opacity: 1, y: 0, duration: 0.9,  ease: 'power3.out' })
  .to('.char',    { y: '0%',   duration: 1.1, stagger: 0.04, ease: 'power4.out' }, '-=0.5')
  .to('#subline', { opacity: 1, y: 0, duration: 0.9,  ease: 'power3.out' }, '-=0.45');
```

`.char-wrap` needs `overflow: hidden` to clip the characters during the reveal.

---

## Visual Design Tokens

```css
:root {
  --bg:    #080808;    /* near-black background */
  --fg:    #f0eeea;    /* off-white text */
  --muted: rgba(240,238,234,0.28);
}
```

**Film grain overlay** (animated, `body::after`):
- SVG fractalNoise at `baseFrequency 0.72`, 4 octaves
- `opacity: 0.042`
- Randomly translated every frame via `steps(1)` keyframes at 0.85s

**Custom cursor:** 8px circle, `mix-blend-mode: difference`, grows to 20px when within 40px of a string.

**Typography:** Space Grotesk 700, `clamp(4.5rem, 15vw, 13rem)`, `letter-spacing: -0.045em`, `line-height: 0.88`

---

## CDN Dependencies

```html
<!-- Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&display=swap" rel="stylesheet" />

<!-- Libraries -->
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.14/dist/lenis.min.js"></script>
```

No build step required. Open `index.html` directly in a browser.

---

## Quick Tuning Cheatsheet

| Want to… | Change |
|----------|--------|
| Faster wave reflections | `TENSION` → higher (max `0.49`) |
| Slower, elastic feel | `TENSION` → lower (`0.10`–`0.25`) |
| String rings longer | `DAMPING` → higher (`0.999`+) |
| String snaps back fast | `DAMPING` → lower (`0.97`–`0.985`) |
| More visible motion | `AMPLITUDE` + `SPEED_SCALE` → higher |
| Shorter wavelength / more wiggles | `PLK WIDTH` → lower (`0.06`–`0.12`) |
| Long smooth arc / fundamental | `PLK WIDTH` → higher (`0.30`–`0.45`) |
| More strings | Add values to `stringRatios` array |
| Change string colour | Update `strRgb`, `glowRgb`, `fxRgb` in config |
