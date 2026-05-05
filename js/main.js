gsap.registerPlugin(ScrollTrigger);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION CONFIGS
// Each object fully describes one section's physics and visuals.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CONFIGS = [
  {
    id: 's1',
    numNodes: 120, tension: 0.45,  damping: 0.9982, maxAmp: 26, speedScale: 0.55, pluckW: 0.18,
    ratios: [0.12, 0.27, 0.73, 0.88],
    strRgb: '215,214,210', glowRgb: '235,233,228', fxRgb: '240,238,234',
  },
  {
    id: 's2',
    numNodes: 120, tension: 0.12,  damping: 0.9993, maxAmp: 40, speedScale: 0.70, pluckW: 0.38,
    ratios: [0.15, 0.35, 0.65, 0.85],
    strRgb: '205,162,76',  glowRgb: '225,182,96',  fxRgb: '205,162,76',
  },
  {
    id: 's3',
    numNodes: 120, tension: 0.48,  damping: 0.974,  maxAmp: 13, speedScale: 0.32, pluckW: 0.08,
    ratios: [0.12, 0.25, 0.50, 0.75, 0.88],
    strRgb: '148,192,240', glowRgb: '168,212,255', fxRgb: '148,192,240',
  },
  {
    id: 's4',
    numNodes: 120, tension: 0.20,  damping: 0.9997, maxAmp: 34, speedScale: 0.65, pluckW: 0.30,
    ratios: [0.18, 0.40, 0.60, 0.82],
    strRgb: '92,198,158',  glowRgb: '112,218,178', fxRgb: '92,198,158',
  },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHYSICS — parameterized per-section string
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class GuitarString {
  constructor(yRatio, cfg) {
    this.yRatio = yRatio;
    this.y      = 0;
    this.cfg    = cfg;
    this.pos    = new Float32Array(cfg.numNodes);
    this.vel    = new Float32Array(cfg.numNodes);
  }

  resize(H) { this.y = H * this.yRatio; }

  // Triangular displacement pluck — physically accurate.
  // Peak at pluck point, falls to 0 within pluckW fraction of string length.
  // Zero initial velocity: energy starts as potential shape, converts to kinetic.
  pluck(normX, amplitude) {
    const { numNodes, pluckW } = this.cfg;
    const peak = Math.max(1, Math.min(numNodes - 2, Math.round(normX * (numNodes - 1))));
    const hw   = Math.round(pluckW * (numNodes - 1));

    for (let i = 0; i < numNodes; i++) {
      const d = Math.abs(i - peak);
      this.pos[i] = d < hw ? amplitude * (1 - d / hw) : 0;
      this.vel[i] = 0;
    }
    this.pos[0] = 0;
    this.pos[numNodes - 1] = 0;
  }

  // 1D wave equation — two-pass leapfrog integration.
  // a_i = T * (x[i-1] + x[i+1] − 2*x[i])
  step() {
    const { numNodes, tension, damping } = this.cfg;
    for (let i = 1; i < numNodes - 1; i++) {
      const acc = tension * (this.pos[i - 1] + this.pos[i + 1] - 2 * this.pos[i]);
      this.vel[i] = (this.vel[i] + acc) * damping;
    }
    this.vel[0] = 0; this.pos[0] = 0;
    this.vel[numNodes - 1] = 0; this.pos[numNodes - 1] = 0;
    for (let i = 1; i < numNodes - 1; i++) this.pos[i] += this.vel[i];
  }

  maxAmp() {
    let m = 0;
    for (let i = 0; i < this.cfg.numNodes; i++) {
      const a = Math.abs(this.pos[i]);
      if (a > m) m = a;
    }
    return m;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SECTION — owns canvas, strings, effects
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class Section {
  constructor(cfg) {
    this.cfg     = cfg;
    this.el      = document.getElementById(cfg.id);
    this.canvas  = this.el.querySelector('.s-canvas');
    this.ctx     = this.canvas.getContext('2d');
    this.strings = cfg.ratios.map(r => new GuitarString(r, cfg));
    this.effects = [];
    this.W = 0; this.H = 0;
    this.resize();
  }

  resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.canvas.width  = Math.round(this.W * devicePixelRatio);
    this.canvas.height = Math.round(this.H * devicePixelRatio);
    this.ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    this.strings.forEach(s => s.resize(this.H));
  }

  // Called by input handler with section-local coordinates
  onMouse(lx, ly, plx, ply, speed) {
    this.strings.forEach(s => {
      if ((ply < s.y && ly >= s.y) || (ply > s.y && ly <= s.y)) {
        const dir = ply < s.y ? 1 : -1;
        const amp = dir * Math.min(speed * this.cfg.speedScale, this.cfg.maxAmp);
        s.pluck(lx / this.W, amp);
        this.effects.push({ x: lx, y: s.y, age: 0 });
      }
    });
  }

  step() { this.strings.forEach(s => s.step()); }

  render() {
    const { ctx, W, H, cfg } = this;
    ctx.clearRect(0, 0, W, H);

    // ── strings ──
    this.strings.forEach(s => {
      const amp       = s.maxAmp();
      const vib       = amp > 0.2;
      const intensity = Math.min(amp / cfg.maxAmp, 1);

      ctx.beginPath();
      ctx.lineWidth = vib ? 1 + intensity * 0.5 : 1;

      if (vib) {
        ctx.strokeStyle = `rgba(${cfg.strRgb},${0.45 + intensity * 0.5})`;
        ctx.shadowColor = `rgba(${cfg.glowRgb},${0.25 + intensity * 0.6})`;
        ctx.shadowBlur  = 4 + intensity * 10;
      } else {
        ctx.strokeStyle = `rgba(${cfg.strRgb},0.32)`;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur  = 0;
      }

      for (let i = 0; i < cfg.numNodes; i++) {
        const x = (i / (cfg.numNodes - 1)) * W;
        const y = s.y + s.pos[i];
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
    });

    // ── pluck effects: expanding ring + center flash ──
    const LIFE = 38;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i];
      ef.age++;
      if (ef.age >= LIFE) { this.effects.splice(i, 1); continue; }
      const t = ef.age / LIFE;

      ctx.beginPath();
      ctx.arc(ef.x, ef.y, t * 48, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cfg.fxRgb},${(1 - t) * 0.42})`;
      ctx.lineWidth   = 1 - t * 0.6;
      ctx.stroke();

      if (t < 0.2) {
        const fa = (1 - t / 0.2) * 0.88;
        ctx.beginPath();
        ctx.arc(ef.x, ef.y, 2.5 * (1 - t), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cfg.fxRgb},${fa})`;
        ctx.fill();
      }
    }
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT ALL SECTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const sections = CONFIGS.map(cfg => new Section(cfg));
window.addEventListener('resize', () => sections.forEach(s => s.resize()));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INPUT — dispatch mouse to active section
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const cursorEl = document.getElementById('cursor');
let prevX = -9999, prevY = -9999;

window.addEventListener('mousemove', e => {
  cursorEl.style.transform =
    `translate(calc(${e.clientX}px - 50%), calc(${e.clientY}px - 50%))`;

  if (prevX !== -9999) {
    const vx    = e.clientX - prevX;
    const vy    = e.clientY - prevY;
    const speed = Math.sqrt(vx * vx + vy * vy);
    let nearAny = false;

    sections.forEach(sec => {
      const rect = sec.el.getBoundingClientRect();
      if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
        const lx  = e.clientX - rect.left;
        const ly  = e.clientY - rect.top;
        const plx = prevX - rect.left;
        const ply = prevY - rect.top;
        sec.onMouse(lx, ly, plx, ply, speed);
        sec.strings.forEach(s => { if (Math.abs(ly - s.y) < 40) nearAny = true; });
      }
    });

    cursorEl.classList.toggle('near', nearAny);
  }

  prevX = e.clientX;
  prevY = e.clientY;
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TEXT DISTORTION — hero section only
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const feDisp   = document.getElementById('fe-disp');
const heroText = document.getElementById('hero-text');
const heroSec  = sections[0];
let distortScale = 0;

function updateDistortion() {
  const r  = heroText.getBoundingClientRect();
  const cy = r.top + r.height / 2;
  let influence = 0;
  heroSec.strings.forEach(s => {
    const amp = s.maxAmp();
    if (amp < 0.15) return;
    const prox = Math.max(0, 1 - Math.abs(s.y - cy) / 210);
    influence += (amp / heroSec.cfg.maxAmp) * prox;
  });
  const target = Math.min(influence * 8, 8);
  distortScale += (target - distortScale) * 0.1;
  feDisp.setAttribute('scale', distortScale.toFixed(2));
  heroText.style.filter = distortScale > 0.05 ? 'url(#air-distort)' : 'none';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LENIS + GSAP ticker (single animation loop)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const lenis = new Lenis({
  duration: 1.4,
  easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t))
});
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.lagSmoothing(0);

gsap.ticker.add((time, deltaTime) => {
  lenis.raf(time * 1000);

  if (deltaTime < 200) {
    sections.forEach(s => s.step());
    updateDistortion();
  }

  sections.forEach(s => s.render());
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GSAP — hero entrance
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const headlineEl = document.getElementById('headline');
headlineEl.innerHTML = [...headlineEl.textContent].map(ch =>
  `<span class="char-wrap"><span class="char">${ch}</span></span>`
).join('');

gsap.set('.char',    { y: '110%' });
gsap.set('#eyebrow', { opacity: 0, y: 10 });
gsap.set('#subline', { opacity: 0, y: 10 });

gsap.timeline({ delay: 0.3 })
  .to('#eyebrow', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' })
  .to('.char',    { y: '0%', duration: 1.1, stagger: 0.04, ease: 'power4.out' }, '-=0.5')
  .to('#subline', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.45');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GSAP ScrollTrigger — reveals for sections 2–4
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
['#s2', '#s3', '#s4'].forEach(id => {
  const el = document.querySelector(id);

  gsap.from(el.querySelector('.s-name'), {
    scrollTrigger: { trigger: el, start: 'top 75%', scroller: document.body },
    x: -50, opacity: 0, duration: 1.0, ease: 'power3.out'
  });
  gsap.from(el.querySelector('.s-num'), {
    scrollTrigger: { trigger: el, start: 'top 75%', scroller: document.body },
    opacity: 0, duration: 0.7, delay: 0.1, ease: 'power2.out'
  });
  gsap.from(el.querySelector('.s-desc'), {
    scrollTrigger: { trigger: el, start: 'top 75%', scroller: document.body },
    opacity: 0, y: 8, duration: 0.7, delay: 0.18, ease: 'power2.out'
  });
  gsap.from(el.querySelectorAll('.p-row'), {
    scrollTrigger: { trigger: el, start: 'top 75%', scroller: document.body },
    opacity: 0, x: 12, duration: 0.55, stagger: 0.09, delay: 0.12, ease: 'power2.out'
  });
});
