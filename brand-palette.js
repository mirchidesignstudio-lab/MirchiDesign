/*!
 * <brand-palette> — drop-in brand colour widget
 * Upload an image -> k-means (CIELAB) palette -> harmony formulas -> WCAG contrast
 * (high / low contrast formulas) -> 7 ranked brand languages -> 3 final variations
 * (pattern + layout + contrast diagram) -> CSS variables export.
 *
 * Usage:   <brand-palette-launcher></brand-palette-launcher>  -> card that opens the tool as a pop-up
 *          <brand-palette-launcher variant="button" label="Try it"></brand-palette-launcher>
 *          <a href="#" data-open-brand-palette>open</a>  or  window.openBrandPalette()
 *          <brand-palette></brand-palette>  -> the tool inline, no pop-up
 *          (load this script once per page)
 * Attrs:   k="6"  preset="minimal|corporate|playful|bold|editorial|luxe|tech"  pattern="rings|arcs|tri|diag|bauhaus"
 *          src="https://..." (must allow CORS)   theme="light|dark"
 * Event:   el.addEventListener('palettechange', e => console.log(e.detail))
 * Theming: set --bp-bg / --bp-fg / --bp-line / --bp-soft / --bp-mute on the element.
 */
(() => {
  if (customElements.get('brand-palette')) return;

  /* ---------- colour maths ---------- */
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const toLin = c => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  // WCAG 2 relative luminance + contrast ratio
  const lum = c => 0.2126 * toLin(c[0]) + 0.7152 * toLin(c[1]) + 0.0722 * toLin(c[2]);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = c => '#' + c.map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
  const WHITE = [255, 255, 255], INK = [17, 17, 17];

  function rgb2lab(r, g, b) {
    const R = toLin(r), G = toLin(g), B = toLin(b);
    let x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    let y = R * 0.2126 + G * 0.7152 + B * 0.0722;
    let z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    x = f(x); y = f(y); z = f(z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const lab = c => rgb2lab(c[0], c[1], c[2]);
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); // CIE76

  function rgb2hsl([r, g, b]) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0, s = 0; const l = (mx + mn) / 2;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, s * 100, l * 100];
  }
  function hsl2rgb([h, s, l]) {
    h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [(r + m) * 255, (g + m) * 255, (b + m) * 255].map(Math.round);
  }
  const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  // keep hue + saturation of `rgb`, bisect HSL lightness until luminance ≈ Y
  function toneFor(rgb, Y) {
    const [h, s] = rgb2hsl(rgb); let lo = 0, hi = 100;
    for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (lum(hsl2rgb([h, s, m])) < Y) lo = m; else hi = m; }
    return hsl2rgb([h, s, (lo + hi) / 2]);
  }
  // luminance a colour needs to sit at ratio R from bg: lighter (Yb+.05)·R−.05, darker (Yb+.05)/R−.05
  function targetY(bg, R) {
    const Yb = lum(bg), up = (Yb + 0.05) * R - 0.05, dn = (Yb + 0.05) / R - 0.05;
    let dir = Yb > 0.179 ? 'dn' : 'up';
    if (dir === 'up' && up > 1 && dn >= 0) dir = 'dn';
    if (dir === 'dn' && dn < 0 && up <= 1) dir = 'up';
    return clamp(dir === 'up' ? up : dn, 0, 1);
  }
  const atRatio = (hueOf, bg, R) => toneFor(hueOf, targetY(bg, R * 1.012)); // small margin for 8-bit rounding

  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const col = (rgb, name) => { const L = lab(rgb); return { rgb, name, hex: hex(rgb), lab: L, C: Math.hypot(L[1], L[2]), hue: rgb2hsl(rgb)[0] }; };
  // first candidate reaching 4.5:1, else the highest-contrast one
  const onColor = (bg, cands = [WHITE, INK]) => cands.find(v => contrast(v, bg) >= 4.5) || cands.reduce((m, v) => (contrast(v, bg) > contrast(m, bg) ? v : m));
  const rate = r => (r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA large' : 'FAIL');
  const badge = (r, ui) => { const l = ui ? (r >= 3 ? 'PASS' : 'FAIL') : rate(r); return `<span class="bd${l === 'FAIL' ? ' fail' : ''}">${l}</span>`; };

  /* ---------- k-means (k-means++ init, Lab space) ---------- */
  function kmeans(L, n, k, seed) {
    const rnd = mulberry32(seed), C = new Float64Array(k * 3), D = new Float64Array(n).fill(Infinity), A = new Int32Array(n);
    const d2 = (i, c) => { const p = i * 3, q = c * 3, x = L[p] - C[q], y = L[p + 1] - C[q + 1], z = L[p + 2] - C[q + 2]; return x * x + y * y + z * z; };
    const put = (c, i) => { C[c * 3] = L[i * 3]; C[c * 3 + 1] = L[i * 3 + 1]; C[c * 3 + 2] = L[i * 3 + 2]; };
    put(0, Math.floor(rnd() * n));
    for (let c = 1; c < k; c++) {
      let sum = 0;
      for (let i = 0; i < n; i++) { const v = d2(i, c - 1); if (v < D[i]) D[i] = v; sum += D[i]; }
      let t = rnd() * sum, j = 0;
      for (; j < n - 1; j++) { t -= D[j]; if (t <= 0) break; }
      put(c, j);
    }
    const hist = [C.slice()]; // centroid snapshot per iteration (seed + every update)
    let it = 0;
    for (; it < 40; it++) {
      for (let i = 0; i < n; i++) { let b = 0, bd = Infinity; for (let c = 0; c < k; c++) { const v = d2(i, c); if (v < bd) { bd = v; b = c; } } A[i] = b; }
      const S = new Float64Array(k * 3), N = new Int32Array(k);
      for (let i = 0; i < n; i++) { const c = A[i]; N[c]++; S[c * 3] += L[i * 3]; S[c * 3 + 1] += L[i * 3 + 1]; S[c * 3 + 2] += L[i * 3 + 2]; }
      let move = 0;
      for (let c = 0; c < k; c++) {
        let x, y, z;
        if (N[c]) { x = S[c * 3] / N[c]; y = S[c * 3 + 1] / N[c]; z = S[c * 3 + 2] / N[c]; }
        else { const r = Math.floor(rnd() * n); x = L[r * 3]; y = L[r * 3 + 1]; z = L[r * 3 + 2]; }
        move = Math.max(move, Math.hypot(x - C[c * 3], y - C[c * 3 + 1], z - C[c * 3 + 2]));
        C[c * 3] = x; C[c * 3 + 1] = y; C[c * 3 + 2] = z;
      }
      hist.push(C.slice());
      if (move < 0.1) break;
    }
    return { A, iters: it + 1, hist };
  }

  /* ---------- harmony rules ---------- */
  const HARM = {
    complementary: { label: 'Complementary', f: "H' = (H + 180°) mod 360", o: [180] },
    split:         { label: 'Split',         f: "H' = H + 150°,  H + 210°", o: [150, 210] },
    triadic:       { label: 'Triadic',       f: "H' = H + 120°,  H + 240°", o: [120, 240] },
    analogous:     { label: 'Analogous',     f: "H' = H − 30°,  H + 30°", o: [-30, 30] },
    tetradic:      { label: 'Tetradic',      f: "H' = H + 60°,  H + 180°,  H + 240°", o: [60, 180, 240] },
    square:        { label: 'Square',        f: "H' = H + 90°,  H + 180°,  H + 270°", o: [90, 180, 270] },
    mono:          { label: 'Mono',          f: "L' = L − 30, L − 15, L + 15, L + 30   (H, S fixed)", l: [-30, -15, 15, 30] },
  };
  const genHarm = (m, h, s, l) => (HARM[m].o ? HARM[m].o.map(d => [h + d, s, l]) : HARM[m].l.map(d => [h, s, clamp(l + d, 4, 96)]));

  /* ---------- brand languages ---------- */
  const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  const PRESETS = {
    minimal:   { label: 'Minimal',   desc: 'light ground, one accent', mode: 'light', font: SANS, hw: 600, tr: '-0.01em', tt: 'none', r: 4 },
    corporate: { label: 'Corporate', desc: 'blue-leaning accent, tidy', mode: 'light', hue: 215, font: SANS, hw: 700, tr: '-0.015em', tt: 'none', r: 8 },
    playful:   { label: 'Playful',   desc: 'round, harmony pop', mode: 'light', font: '"Nunito", "Trebuchet MS", ui-rounded, "Segoe UI", sans-serif', hw: 800, tr: '0em', tt: 'none', r: 22 },
    bold:      { label: 'Bold',      desc: 'saturated field, complement punch', mode: 'chroma', acHarm: true, font: '"Arial Black", "Helvetica Neue", Impact, sans-serif', hw: 900, tr: '-0.02em', tt: 'uppercase', r: 0 },
    editorial: { label: 'Editorial', desc: 'serif, paper + ink', mode: 'light', font: 'Georgia, "Times New Roman", serif', hw: 700, tr: '-0.02em', tt: 'none', r: 0, ac2: 'dark' },
    luxe:      { label: 'Luxe',      desc: 'dark ground, gold-leaning', mode: 'dark', hue: 45, font: 'Didot, "Bodoni 72", "Playfair Display", Georgia, serif', hw: 400, tr: '0.08em', tt: 'uppercase', r: 0, ac2: 'light' },
    tech:      { label: 'Tech',      desc: 'dark, mono, neon accent', mode: 'dark', font: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', hw: 700, tr: '-0.01em', tt: 'none', r: 2 },
  };

  /* ---------- visuals ---------- */
  // Tile patterns. Same seed for every variation so layouts can be compared; only colours change.
  const WEIGHTS = { high: [['tx', 0.86], ['ac', 1]], bal: [['tx', 0.52], ['ac', 0.78], ['ac2', 0.92], ['sf', 1]], low: [['sf', 0.58], ['ac2', 0.88], ['ac', 1]] };
  const PATTERNS = { rings: 'Quarter rings', arcs: 'Concentric arcs', tri: 'Triangle grid', diag: 'Diagonal', bauhaus: 'Bauhaus' };
  function pattern(kind, v, mode, cols, rows, seed = 42) {
    const s = 24, W = cols * s, H = rows * s, rnd = mulberry32(seed), w = WEIGHTS[mode];
    const pick = () => { const q = rnd(); return v[w.find(([, t]) => q < t)[0]].hex; };
    const T = (x, y, k) => `translate(${x * s + s / 2},${y * s + s / 2}) rotate(${k * 90}) translate(${-s / 2},${-s / 2})`;
    let p = '';
    if (kind === 'tri') {
      // equilateral grid; random rhombi = an up-triangle fused with its right or lower neighbour
      const a = s * 1.2, h = (a * Math.sqrt(3)) / 2, R = Math.ceil(H / h) + 1, J = Math.ceil(W / (a / 2)) + 2;
      const pts = (r, j) => { const x = j * (a / 2) - a / 2, y = r * h; return ((j + r) % 2 + 2) % 2 === 0 ? `${x},${y + h} ${x + a / 2},${y} ${x + a},${y + h}` : `${x},${y} ${x + a},${y} ${x + a / 2},${y + h}`; };
      const done = new Set(), key = (r, j) => r * 1000 + j;
      let grid = '';
      for (let r = 0; r < R; r++) for (let j = 0; j < J; j++) {
        grid += `<polygon points="${pts(r, j)}"/>`;
        const go = rnd() < 0.2, horiz = rnd() < 0.5, c = pick(), up = ((j + r) % 2 + 2) % 2 === 0;
        const mate = horiz || !up ? [r, j + 1] : [r + 1, j];
        if (go && !done.has(key(r, j)) && !done.has(key(...mate))) {
          done.add(key(r, j)); done.add(key(...mate));
          p += `<polygon points="${pts(r, j)}" fill="${c}"/><polygon points="${pts(...mate)}" fill="${c}" stroke="${c}" stroke-width=".6"/>`;
        }
      }
      p = `<g fill="none" stroke="${v.tx.hex}" stroke-opacity=".28" stroke-width=".5">${grid}</g>` + p;
    } else {
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const k = Math.floor(rnd() * 4), t = rnd(), c = pick();
        if (kind === 'arcs') {
          // Smith tile: concentric arcs on two opposite corners, radii symmetric around s/2 so edges join
          const radii = [0.3, 0.4, 0.5, 0.6, 0.7].map(f => f * s);
          const d = radii.map(r => `M${r},0A${r},${r} 0 0 1 0,${r}`).join('') + radii.map(r => `M${s - r},${s}A${r},${r} 0 0 1 ${s},${s - r}`).join('');
          p += `<path d="${d}" fill="none" stroke="${c}" stroke-width="1.3" transform="${T(x, y, k % 2)}"/>`;
        } else if (kind === 'diag') {
          p += `<path d="M0,0H${s}L0,${s}Z" fill="${c}" transform="${T(x, y, k)}"/>`;
        } else if (kind === 'bauhaus') {
          const d = t < 0.3 ? `M${s / 2},1a${s / 2 - 1},${s / 2 - 1} 0 1 0 0.01,0Z`
            : t < 0.6 ? `M0,${s}A${s / 2},${s / 2} 0 0 1 ${s},${s}Z`
            : t < 0.88 ? `M0,0H${s}A${s},${s} 0 0 1 0,${s}Z`
            : `M${s / 2 - 4},${s / 2}a4,4 0 1 0 8,0a4,4 0 1 0 -8,0Z`;
          p += `<path d="${d}" fill="${c}" transform="${T(x, y, k)}"/>`;
        } else {
          p += `<path d="M${s},0A${s},${s} 0 0 1 0,${s}L0,${s / 2}A${s / 2},${s / 2} 0 0 0 ${s / 2},0Z" fill="${c}" transform="${T(x, y, k)}"/>`;
        }
      }
    }
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="${W}" height="${H}" fill="${v.bg.hex}"/>${p}</svg>`;
  }

  // Luminance ladder: x = log(Y + 0.05), so the distance between two dots IS their contrast ratio.
  // `ink` is a literal colour for standalone export; on screen it follows the widget's text colour.
  function ladder(points, bracket, ink = 'currentColor') {
    const a = Math.log(0.05), b = Math.log(1.05), X = c => 16 + ((Math.log(lum(c.rgb) + 0.05) - a) / (b - a)) * 268;
    const pts = points.map(([lbl, c]) => ({ lbl, c, x: X(c) })).sort((p, q) => p.x - q.x);
    const tx = (x, y, t, anchor = 'start') => `<text x="${x}" y="${y}" fill="${ink}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="9" text-anchor="${anchor}">${t}</text>`;
    let g = `<line x1="16" y1="44" x2="284" y2="44" stroke="${ink}"/>` + tx(16, 70, 'black') + tx(284, 70, 'white', 'end');
    for (let i = 1; i < 7; i++) { const x = 16 + (Math.log(Math.pow(1.05 / 0.05, i / 7) * 0.05) - a) / (b - a) * 268; g += `<line x1="${x}" y1="41" x2="${x}" y2="47" stroke="${ink}"/>`; }
    if (bracket) {
      const [p, q] = bracket.map(c => X(c)), r = contrast(bracket[0].rgb, bracket[1].rgb);
      g += `<path d="M${Math.min(p, q)},18v-5H${Math.max(p, q)}v5" stroke="${ink}" fill="none"/>` + tx((p + q) / 2, 9, r.toFixed(2) + ':1', 'middle');
    }
    pts.forEach((p, i) => { g += `<circle cx="${p.x}" cy="44" r="6.5" fill="${p.c.hex}" stroke="${ink}"/>` + tx(p.x, i % 2 === 0 ? 31 : 62, p.lbl, 'middle'); });
    return `<svg class="ladder" viewBox="0 0 300 74" role="img" aria-label="Luminance ladder">${g}</svg>`;
  }
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wrap = (t, n) => t.split(' ').reduce((ls, w) => { const l = ls[ls.length - 1]; (l + ' ' + w).trim().length > n ? ls.push(w) : (ls[ls.length - 1] = (l + ' ' + w).trim()); return ls; }, ['']);

  /* ---------- live figures: canvas "instrument" panels that animate the maths ---------- */
  const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2, MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
  const VI = 'rgba(233,233,230,.92)', VD = 'rgba(233,233,230,.55)', VF = 'rgba(233,233,230,.13)';
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const prog = (t, start, d) => ease(clamp((t - start) / d, 0, 1));
  const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  const lgY = y => Math.log(y + 0.05), LG0 = Math.log(0.05), LG1 = Math.log(1.05);

  function lab2rgb(L, a, b) {
    let y = (L + 16) / 116, x = a / 500 + y, z = y - b / 200;
    const f = t => (t * t * t > 0.008856 ? t * t * t : (t - 16 / 116) / 7.787);
    x = f(x) * 0.95047; y = f(y); z = f(z) * 1.08883;
    const g = c => 255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
    return [x * 3.2406 - y * 1.5372 - z * 0.4986, -x * 0.9689 + y * 1.8758 + z * 0.0415, x * 0.0557 - y * 0.204 + z * 1.057].map(c => Math.round(clamp(g(Math.max(0, c)), 0, 255)));
  }
  function vt(cx, t, x, y, o = {}) {
    cx.font = `${o.w || 400} ${o.s || 10}px ${MONO}`; cx.fillStyle = o.c || VI;
    cx.textAlign = o.a || 'left'; cx.textBaseline = 'alphabetic'; cx.fillText(t, x, y);
  }
  function vbg(cx, w, h) {
    const g = cx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
    g.addColorStop(0, '#191b20'); g.addColorStop(1, '#09090b');
    cx.fillStyle = g; cx.fillRect(0, 0, w, h);
    cx.fillStyle = 'rgba(233,233,230,.055)';
    for (let x = 9; x < w; x += 18) for (let y = 9; y < h; y += 18) cx.fillRect(x, y, 1, 1);
  }
  const seg = (cx, x1, y1, x2, y2, style, lw = 1, dash) => {
    cx.beginPath(); cx.moveTo(x1, y1); cx.lineTo(x2, y2); cx.strokeStyle = style; cx.lineWidth = lw;
    cx.setLineDash(dash || []); cx.stroke(); cx.setLineDash([]);
  };
  const dot = (cx, x, y, r, fill, ring, glow) => {
    cx.beginPath(); cx.arc(x, y, r, 0, TAU); cx.fillStyle = fill;
    if (glow) { cx.shadowColor = fill; cx.shadowBlur = glow; }
    cx.fill(); cx.shadowBlur = 0;
    if (ring) { cx.strokeStyle = ring; cx.lineWidth = 1.4; cx.stroke(); }
  };
  // push labels apart vertically so they never overlap
  function spread(a, gap, hi) {
    a.sort((p, q) => p.y - q.y);
    for (let i = 1; i < a.length; i++) a[i].y = Math.max(a[i].y, a[i - 1].y + gap);
    const over = a.length ? a[a.length - 1].y - hi : 0;
    if (over > 0) a.forEach(p => (p.y -= over));
    return a;
  }
  // one animated canvas: HiDPI sizing, runs only while on screen, restarts when its data changes
  class Stage {
    constructor(cv, draw) {
      this.cv = cv; this.cx = cv.getContext('2d'); this.draw = draw; this.t0 = performance.now(); this.w = 0;
      if (window.ResizeObserver) new ResizeObserver(() => this.size()).observe(cv); else setTimeout(() => this.size(), 50);
      if (window.IntersectionObserver) new IntersectionObserver(es => { this.vis = es[es.length - 1].isIntersecting; if (this.vis) this.kick(); }).observe(cv);
      else this.vis = true;
    }
    size() {
      const r = this.cv.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
      if (!r.width) return;
      this.w = r.width; this.h = r.height;
      this.cv.width = Math.round(r.width * d); this.cv.height = Math.round(r.height * d);
      this.cx.setTransform(d, 0, 0, d, 0, 0); this.kick();
    }
    set(sig) { if (sig !== this.sig) { this.sig = sig; this.t0 = performance.now(); } this.kick(); }
    restart() { this.t0 = performance.now(); this.kick(); }
    kick() { if (!this.raf) this.raf = requestAnimationFrame(n => this.frame(n)); }
    frame(now) {
      this.raf = 0;
      if (!this.w) return;
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0;
      this.last = now;
      const more = this.draw(this.cx, this.w, this.h, REDUCED ? 1e4 : (now - this.t0) / 1000, dt);
      if (more && this.vis && !REDUCED) this.kick(); else this.last = 0;
    }
  }

  /* ---------- view ---------- */
  const CSS = `
:host{--bp-bg:#fff;--bp-fg:#111;--bp-mute:#6b6b6b;--bp-line:#111;--bp-soft:#f1f1ef;
  display:block;container-type:inline-size;color:var(--bp-fg);background:var(--bp-bg);
  font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,"Liberation Mono",monospace;text-align:left}
@media (prefers-color-scheme:dark){:host(:not([theme=light])){--bp-bg:#0f0f0f;--bp-fg:#ececec;--bp-mute:#8d8d8d;--bp-line:#ececec;--bp-soft:#1d1d1d}}
:host([theme=dark]){--bp-bg:#0f0f0f;--bp-fg:#ececec;--bp-mute:#8d8d8d;--bp-line:#ececec;--bp-soft:#1d1d1d}
*{box-sizing:border-box}
.wrap{border:1px solid var(--bp-line)}
header{display:flex;justify-content:space-between;align-items:baseline;gap:4px 16px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid var(--bp-line)}
header b{letter-spacing:.06em}
.mute,.hint,figcaption{color:var(--bp-mute)}
.grid{display:grid;grid-template-columns:1fr}
section{padding:14px;border-bottom:1px solid var(--bp-line);min-width:0}
section:last-child{border-bottom:0}
/* every section stacks one after another on all screen sizes (laptop + mobile), read as a single scroll */
h4{margin:0 0 10px;font-size:11px;text-transform:uppercase;letter-spacing:.1em}
h5{margin:14px 0 8px;font-size:11px;font-weight:400;color:var(--bp-mute);text-transform:uppercase;letter-spacing:.1em}
.hint{margin:8px 0 0;font-size:11px}
.drop{display:flex;align-items:center;justify-content:center;border:1px dashed var(--bp-line);padding:16px;cursor:pointer;text-align:center}
.drop:hover,.drop.over,.drop:focus-visible{background:var(--bp-soft);outline:none}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}
figure{margin:0}
figure img,figure canvas{width:100%;aspect-ratio:4/3;object-fit:contain;background:var(--bp-soft);display:block;border:1px solid var(--bp-line)}
figure canvas{image-rendering:pixelated}
figcaption{margin-top:3px;font-size:11px}
.ctl{margin:8px 0}
.ctl label{display:flex;justify-content:space-between}
input[type=range]{width:100%;margin:2px 0;accent-color:var(--bp-fg)}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
button{font:inherit;background:var(--bp-bg);color:var(--bp-fg);border:1px solid var(--bp-line);padding:4px 10px;cursor:pointer;border-radius:0}
button:hover,button.on{background:var(--bp-fg);color:var(--bp-bg)}
button:focus-visible,input:focus-visible{outline:2px solid var(--bp-fg);outline-offset:2px}
.bar{display:flex;height:30px;border:1px solid var(--bp-line)}
.bar div{min-width:3px}
.sw{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:8px;margin-top:10px}
.chip{border:1px solid var(--bp-line);cursor:pointer;background:none;padding:0;text-align:left;color:inherit;display:block;width:100%}
.chip:hover{background:none;color:inherit}
.chip>i{display:flex;flex-direction:column;justify-content:flex-end;height:64px;padding:6px;font-style:normal;border-bottom:1px solid var(--bp-line);line-height:1.25}
.chip>i b{font-size:12px}
.chip>i small{font-size:10px}
.chip span{display:block;padding:4px 6px;font-size:11px;line-height:1.35}
.chip.base{outline:2px solid var(--bp-fg);outline-offset:2px}
.modes{display:flex;flex-wrap:wrap;gap:6px}
.formula{background:var(--bp-soft);padding:8px 10px;margin:10px 0;white-space:pre-wrap;overflow-x:auto}
.dot{width:12px;height:12px;border:1px solid var(--bp-line);display:inline-block;vertical-align:-2px;flex:none}
.mx{overflow-x:auto}
.mx table{border-collapse:collapse;width:100%;table-layout:fixed}
.mx th{font-weight:400;padding:2px;width:22px}
.mx td{height:42px;min-width:38px;text-align:center;cursor:default;border:2px solid var(--bp-bg);line-height:1.1;padding:0}
.mx td b{display:block;font-size:13px}
.mx td small{font-size:10px}
.mx td.lo{background-image:repeating-linear-gradient(45deg,transparent 0 5px,rgba(127,127,127,.18) 5px 6px)}
.mx td.lo b{opacity:.55}
.mx th small{display:block;font-size:9px;color:var(--bp-mute)}
.mx th.hh .dot{outline:1px dashed var(--bp-fg);outline-offset:2px}
.mx td.hx{box-shadow:inset 0 0 0 1px rgba(127,127,127,.6)}
.mxmodes{margin-bottom:8px}
.fxpick{padding:2px 7px;font-size:11px}
.fxpick.hh{border-style:dashed}
.mxsum{margin:0 0 8px}
.ladder{width:100%;height:auto;display:block;color:var(--bp-fg);overflow:visible}
.pats{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px;align-items:stretch}
.pat{padding:0;display:flex;flex-direction:column;width:118px;text-align:left}
.pat svg{display:block;width:100%;height:56px}
.pat span{padding:3px 6px;font-size:11px;border-top:1px solid var(--bp-line)}
.pat.on{outline:3px solid var(--bp-fg);outline-offset:2px;background:var(--bp-bg);color:var(--bp-fg)}
.pat:hover{background:var(--bp-soft);color:var(--bp-fg)}
.vr-write{font-size:11px;line-height:1.5;color:var(--bp-mute);margin:0}
.outdl{margin-top:16px;padding-top:12px;border-top:1px dotted var(--bp-line)}
.fxg{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr));gap:10px}
.fx{border:1px solid var(--bp-line);display:flex;flex-direction:column}
.fx-h{display:flex;gap:8px;align-items:center;padding:6px 8px;border-bottom:1px solid var(--bp-line)}
.tag{padding:0 5px;font-size:10px;border:1px solid var(--bp-line)}
.tag.hi{background:var(--bp-fg);color:var(--bp-bg)}
.fx code{display:block;font:inherit;font-size:11px;padding:6px 8px;background:var(--bp-soft);white-space:pre-wrap;flex:1}
.fx-tile{padding:12px 10px;display:grid;grid-template-columns:auto 1fr;gap:2px 12px;align-items:center;min-height:86px}
.fx-tile b{font:700 34px/1 Georgia,serif;grid-row:span 2}
.fx-tile span{font-size:11px}
.fx small{padding:5px 8px;border-top:1px solid var(--bp-line);color:var(--bp-mute)}
.opts{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.opt{padding:0;text-align:left;display:flex;flex-direction:column}
.opt:hover{background:var(--bp-soft);color:var(--bp-fg)}
.opt.on{outline:3px solid var(--bp-fg);outline-offset:2px;background:var(--bp-bg);color:var(--bp-fg)}
.opt svg{display:block;width:100%;height:44px}
.opt-pv{padding:14px 12px;display:flex;flex-direction:column;gap:8px;align-items:flex-start;min-height:132px}
.opt-pv .eb{font-size:10px;padding:2px 8px;letter-spacing:.06em;text-transform:uppercase}
.opt-pv strong{font-size:21px;line-height:1.05}
.opt-pv .btn{font-size:12px;padding:5px 12px;font-weight:600}
.opt-meta{padding:6px 8px;border-top:1px solid var(--bp-line);font-size:11px;line-height:1.45;width:100%}
.opt-meta .sw5{display:flex;gap:3px;margin-top:4px}
.vrs{display:grid;grid-template-columns:1fr;gap:14px}
@container (min-width:900px){.vrs{grid-template-columns:repeat(3,1fr)}}
.vr{border:1px solid var(--bp-line);display:flex;flex-direction:column;min-width:0}
.vr.on{outline:3px solid var(--bp-fg);outline-offset:2px}
.vr-art svg{display:block;width:100%;aspect-ratio:10/6;height:auto}
.vr-body{padding:20px 18px;font-family:var(--font)}
.vr-body .eb{display:inline-block;font-size:10px;padding:2px 8px;letter-spacing:.08em;text-transform:uppercase;border-radius:var(--r)}
.vr-body h3{font-size:26px;line-height:1.08;margin:12px 0 8px;font-weight:var(--hw);letter-spacing:var(--tr);text-transform:var(--tt)}
.vr-body p{margin:0 0 14px;font-size:13px;line-height:1.55;opacity:.88}
.vr-body .btns{display:flex;flex-wrap:wrap;gap:8px}
.vr-body .b1,.vr-body .b2{padding:8px 14px;border-radius:var(--r);font-size:13px;font-weight:600;border:1.5px solid}
.vr-body .card{margin-top:14px;padding:10px 12px;border-radius:var(--r);font-size:12px}
.vr-meta{padding:10px 12px;border-top:1px solid var(--bp-line);display:flex;flex-direction:column;gap:8px;flex:1}
.ratio{display:flex;height:18px;border:1px solid var(--bp-line)}
.ratio div{display:flex;align-items:center;padding:0 4px;font-size:9px;overflow:hidden;white-space:nowrap}
.ck{display:flex;justify-content:space-between;gap:10px;padding:2px 0;border-bottom:1px dotted var(--bp-line);font-size:11px}
.bd{padding:0 5px;border:1px solid var(--bp-line);white-space:nowrap}
.bd.fail{background:#c62828;border-color:#c62828;color:#fff}
.vr-meta button{margin-top:auto}
pre{background:var(--bp-soft);padding:10px;max-height:280px;overflow:auto;margin:0 0 10px;font:inherit;font-size:11px}
label.cb{display:inline-flex;gap:6px;align-items:center;cursor:pointer}
.viz{margin:14px 0;border:1px solid var(--bp-line);background:#09090b;color:#e9e9e6;box-shadow:0 18px 40px -24px rgba(0,0,0,.55)}
.viz-h{display:flex;align-items:center;gap:10px;padding:7px 8px 7px 10px;border-bottom:1px solid rgba(233,233,230,.14);font-size:10px;letter-spacing:.12em;text-transform:uppercase}
.viz-h .fig{padding:1px 6px;border:1px solid rgba(233,233,230,.45);flex:none}
.viz-h .ttl{flex:1;color:rgba(233,233,230,.72);min-width:0}
.viz-h .live{width:6px;height:6px;border-radius:50%;background:#6fe3a5;box-shadow:0 0 8px #6fe3a5;flex:none;animation:bp-pulse 1.8s ease-in-out infinite}
@keyframes bp-pulse{50%{opacity:.25}}
.viz .viz-b{background:transparent;color:#e9e9e6;border:1px solid rgba(233,233,230,.35);padding:2px 8px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;flex:none}
.viz .viz-b:hover{background:#e9e9e6;color:#09090b}
.viz canvas{display:block;width:100%;height:260px;touch-action:pan-y}
.viz .cv-km{height:420px;cursor:grab}
.viz .cv-km:active{cursor:grabbing}
.viz .cv-chroma,.viz .cv-harm,.viz .cv-field{height:300px}
.viz-f{padding:7px 10px;border-top:1px solid rgba(233,233,230,.14);font-size:11px;line-height:1.55;color:rgba(233,233,230,.62);white-space:pre-wrap}
@container (max-width:560px){.viz .cv-km{height:330px}}
section.rv{opacity:0;transform:translateY(18px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.7,.2,1)}
section.rv.in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){section.rv{opacity:1;transform:none;transition:none}.viz-h .live{animation:none}}
`;

  const HTML = `
<div class="wrap">
 <header><b>BRAND / PALETTE</b><span class="mute">k-means extraction · harmony · contrast · brand language</span></header>
 <div class="grid">
  <section>
   <h4>01 Source</h4>
   <label class="drop" tabindex="0"><input type="file" accept="image/*" hidden><span>drop / paste / click to upload an image</span></label>
   <div class="pair">
    <figure><img class="orig" alt="Source image"><figcaption>original</figcaption></figure>
    <figure><canvas class="quant"></canvas><figcaption>quantised to k colours</figcaption></figure>
   </div>
   <div class="ctl"><label>k (clusters)<output data-o="k"></output></label><input type="range" data-s="k" min="2" max="12" step="1"></div>
   <div class="ctl"><label>sample size (px, long edge)<output data-o="res"></output></label><input type="range" data-s="res" min="48" max="256" step="8"></div>
   <div class="row"><button data-a="reroll">re-seed</button><span class="meta mute"></span></div>
   <div class="viz"><div class="viz-h"><span class="fig">fig 01</span><span class="ttl">k-means convergence · CIELAB 3D</span><i class="live"></i><button class="viz-b" data-a="replay" data-v="km">replay</button></div><canvas class="cv-km"></canvas><div class="viz-f">assign  c(x) = argmin ‖x − μ_c‖²   ·   update  μ_c = Σx / |S_c|   ·   repeat until max Δμ &lt; 0.1
dots = sampled pixels at their true L*a*b* position · glowing nodes = centroids · dashed = their path · drag to orbit</div></div>
  </section>
  <section>
   <h4>02 Palette</h4>
   <div class="bar"></div>
   <div class="sw spal"></div>
   <div class="viz"><div class="viz-h"><span class="fig">fig 02</span><span class="ttl">chromaticity map · a*b* plane</span><i class="live"></i><button class="viz-b" data-a="replay" data-v="chroma">replay</button></div><canvas class="cv-chroma"></canvas><div class="viz-f">C* = √(a*² + b*²)  chroma = distance from centre   ·   h = atan2(b*, a*)  hue = angle   ·   area ∝ pixel share |S_c| / n</div></div>
   <p class="hint">sorted by pixel share. label inside each swatch is set in its highest-contrast colour. click to make it the base for harmony + contrast formulas.</p>
  </section>
  <section>
   <h4>03 Harmony</h4>
   <div class="modes"></div>
   <div class="viz"><div class="viz-h"><span class="fig">fig 03</span><span class="ttl">harmony rotation · HSL wheel</span><i class="live"></i><button class="viz-b" data-a="replay" data-v="harm">replay</button></div><canvas class="cv-harm"></canvas><div class="viz-f">each harmony colour is the base rotated by the rule's angle on the hue wheel (S, L held)
mono keeps the angle and moves along the radius instead: radius = lightness</div></div>
   <div class="formula"></div>
   <div class="sw sharm"></div>
  </section>
  <section>
   <h4>04 Contrast matrix</h4>
   <div class="modes mxmodes"><button data-a="mx" data-m="pal">default · palette</button><button data-a="mx" data-m="mix">palette + harmony</button></div>
   <div class="mxsum hint"></div>
   <div class="mx"></div>
   <p class="hint">row = background, column = text, ratio = (L₁ + 0.05) / (L₂ + 0.05). hatched = below 4.5:1.</p>
   <div class="viz"><div class="viz-h"><span class="fig">fig 04</span><span class="ttl">contrast field · log luminance</span><i class="live"></i><button class="viz-b" data-a="replay" data-v="field">replay</button></div><canvas class="cv-field"></canvas><div class="viz-f">u = ln(Y + 0.05)   ⇒   ratio = e^|u_bg − u_text|
in this space every contrast ratio is a straight line parallel to the diagonal · outer disc = background, inner dot = text</div></div>
   <h5>luminance ladder — distance = contrast ratio</h5>
   <div class="pladder"></div>
  </section>
  <section class="wide">
   <h4>05 Contrast formulas</h4>
   <div class="fxbase hint" style="margin:0 0 10px"></div>
   <div class="viz"><div class="viz-h"><span class="fig">fig 05</span><span class="ttl">tone solver · bisection on lightness</span><i class="live"></i><button class="viz-b" data-a="replay" data-v="bis">replay</button></div><canvas class="cv-bis"></canvas><div class="viz-f">Y(L) rises monotonically with L at a fixed hue + saturation, so the tone hitting Y_t is found by halving:
m = (lo + hi) / 2 ;  Y(m) &lt; Y_t ? lo = m : hi = m   — 24 halvings pin L to ±0.000006</div></div>
   <h5 style="margin-top:0">high contrast — text, buttons, icons</h5>
   <div class="fxg fxhi"></div>
   <h5>low contrast — surfaces, dividers, hover states, backgrounds</h5>
   <div class="fxg fxlo"></div>
  </section>
  <section class="wide">
   <h4>06 Brand language — 7 options, ranked</h4>
   <div class="viz"><div class="viz-h"><span class="fig">fig 06</span><span class="ttl">score decomposition · 7 languages</span><i class="live"></i><button class="viz-b" data-a="replay" data-v="score">replay</button></div><canvas class="cv-score"></canvas><div class="viz-f">score = 50·min(R_text/7, 1) + 25·min(R_accent/3, 1) + 15·min(R_label/4.5, 1) + 10·min(C*/60, 1)</div></div>
   <div class="opts"></div>
   <p class="hint">score = text/bg (50) + accent/bg (25) + label/accent (15) + accent vividness (10). pick one to drive the final variations.</p>
  </section>
  <section class="wide">
   <h4>07 Final outcomes — 3 variations</h4>
   <div class="viz"><div class="viz-h"><span class="fig">fig 07</span><span class="ttl">luminance slopegraph · 3 variations</span><i class="live"></i><button class="viz-b" data-a="replay" data-v="slope">replay</button></div><canvas class="cv-slope"></canvas><div class="viz-f">each line is one colour role travelling across the variations · y = ln(Y + 0.05), so vertical distance between two dots is their contrast</div></div>
   <div class="vrs"></div>
   <h5>pattern</h5>
   <div class="pats" role="group" aria-label="Pattern"></div>
   <div class="row outdl"><span>download outcome sheet (3 variations + write-ups):</span><button data-a="out" data-f="svg">.svg</button><button data-a="out" data-f="jpg">.jpeg</button><button data-a="out" data-f="pdf">.pdf</button><span class="flash2 mute"></span></div>
  </section>
  <section class="wide">
   <h4>08 Export</h4>
   <pre class="code"></pre>
   <div class="row">
    <button data-a="copy">copy CSS</button><button data-a="dlcss">download .css</button><button data-a="dljson">download .json</button><button data-a="dlsvg">download pattern .svg</button>
    <label class="cb"><input type="checkbox" data-a="apply"> apply variables to this page</label>
    <span class="flash mute"></span>
   </div>
  </section>
 </div>
</div>`;

  class BrandPalette extends HTMLElement {
    constructor() {
      super();
      const preset = this.getAttribute('preset');
      this.s = { k: clamp(+this.getAttribute('k') || 6, 2, 12), res: 140, seed: 7, base: 0, harm: 'complementary', opt: PRESETS[preset] ? preset : null, variant: 1, apply: false, pattern: PATTERNS[this.getAttribute('pattern')] ? this.getAttribute('pattern') : 'rings' };
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${CSS}</style>${HTML}`;
      this.$ = q => root.querySelector(q);
    }

    connectedCallback() {
      if (this._init) return;
      this._init = true;
      this.bind();
      const src = this.getAttribute('src');
      src ? this.loadURL(src) : this.loadDemo();
    }

    /* ----- input ----- */
    bind() {
      const R = this.shadowRoot, s = this.s, file = this.$('input[type=file]'), drop = this.$('.drop');
      R.querySelector('[data-s=k]').value = s.k;
      R.querySelector('[data-s=res]').value = s.res;
      this.outputs();
      this.orbit = { yaw: -0.7, pitch: 0.45, drag: false };
      const mk = (k, fn) => new Stage(this.$('.cv-' + k), (...a) => fn.apply(this, a));
      this.st = { km: mk('km', this.drawKm), chroma: mk('chroma', this.drawChroma), harm: mk('harm', this.drawHarm), field: mk('field', this.drawField), bis: mk('bis', this.drawBisect), score: mk('score', this.drawScore), slope: mk('slope', this.drawSlope) };
      const cv = this.$('.cv-km'), o = this.orbit;
      cv.addEventListener('pointerdown', e => { o.drag = true; o.x = e.clientX; o.y = e.clientY; cv.setPointerCapture?.(e.pointerId); });
      cv.addEventListener('pointermove', e => {
        if (!o.drag) return;
        o.yaw += (e.clientX - o.x) * 0.008; o.pitch = clamp(o.pitch + (e.clientY - o.y) * 0.006, -0.15, 1.35);
        o.x = e.clientX; o.y = e.clientY; this.st.km.kick();
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => cv.addEventListener(n, () => (o.drag = false)));
      if (window.IntersectionObserver && !REDUCED) { // sections glide in as they scroll into view
        const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.06 });
        R.querySelectorAll('section').forEach(sec => { sec.classList.add('rv'); io.observe(sec); });
      }
      this.$('.modes').innerHTML = Object.entries(HARM).map(([k, v]) => `<button data-a="harm" data-m="${k}">${v.label}</button>`).join('');

      file.onchange = () => { if (file.files[0]) this.loadFile(file.files[0]); file.value = ''; };
      drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = () => drop.classList.remove('over');
      drop.ondrop = e => {
        e.preventDefault(); drop.classList.remove('over');
        const f = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
        if (f) this.loadFile(f);
      };
      drop.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } };
      drop.addEventListener('paste', e => {
        const it = [...(e.clipboardData?.items || [])].find(i => i.type.startsWith('image/'));
        if (it) { e.preventDefault(); this.loadFile(it.getAsFile()); }
      });

      R.addEventListener('input', e => {
        const k = e.target.dataset.s;
        if (k === 'k') { s.k = +e.target.value; this.outputs(); this.later(() => this.cluster()); }
        else if (k === 'res') { s.res = +e.target.value; this.outputs(); this.later(() => this.sample()); }
      });
      R.addEventListener('change', e => {
        if (e.target.dataset.a === 'apply') { s.apply = e.target.checked; if (!s.apply) this.unapply(); this.renderExport(); }
      });
      R.addEventListener('click', e => {
        const b = e.target.closest('[data-a]');
        if (!b || b.tagName === 'INPUT') return;
        const a = b.dataset.a;
        if (a === 'reroll') { s.seed++; this.cluster(); }
        else if (a === 'base') { s.base = s.fxBase = +b.dataset.i; this.refresh(); }
        else if (a === 'harm') { s.harm = b.dataset.m; this.refresh(); }
        else if (a === 'mx') { s.mx = b.dataset.m; this.renderMatrix(); this.renderFormulas(); }
        else if (a === 'fxbase') { s.fxBase = +b.dataset.i; this.renderFormulas(); }
        else if (a === 'opt') { s.opt = b.dataset.p; this._picked = true; this.renderOptions(); this.renderFinal(); }
        else if (a === 'variant') { s.variant = +b.dataset.i; this.renderFinal(); }
        else if (a === 'copy') this.copy();
        else if (a === 'dlcss') this.download('brand-palette.css', this.css(), 'text/css');
        else if (a === 'dljson') this.download('brand-palette.json', JSON.stringify(this.data(), null, 2), 'application/json');
        else if (a === 'dlsvg') this.download('brand-pattern.svg', pattern(s.pattern, this.variants[s.variant], this.variants[s.variant].mode, 20, 12).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="960" height="576" '), 'image/svg+xml');
        else if (a === 'pat') { s.pattern = b.dataset.p; this.renderOptions(); this.renderFinal(); }
        else if (a === 'out') this.exportSheet(b.dataset.f);
        else if (a === 'replay') this.st[b.dataset.v]?.restart();
      });
    }

    later(fn) { cancelAnimationFrame(this._raf); this._raf = requestAnimationFrame(fn); }
    outputs() { this.$('[data-o=k]').textContent = this.s.k; this.$('[data-o=res]').textContent = this.s.res; }
    meta(t) { this.$('.meta').textContent = t; }

    /* ----- image loading ----- */
    setSource(img, url) {
      if (this._url && this._url !== url && this._url.startsWith('blob:')) URL.revokeObjectURL(this._url);
      this._url = url; this.img = img; this.$('.orig').src = url; this.sample();
    }
    loadFile(f) {
      const url = URL.createObjectURL(f), im = new Image();
      im.onload = () => this.setSource(im, url);
      im.onerror = () => this.meta('could not read that image');
      im.src = url;
    }
    loadURL(u) {
      const im = new Image();
      im.crossOrigin = 'anonymous';
      im.onload = () => this.setSource(im, u);
      im.onerror = () => { this.loadDemo(); this.meta('src failed to load (CORS?) — showing demo'); };
      im.src = u;
    }
    loadDemo() {
      const c = document.createElement('canvas'); c.width = 360; c.height = 270;
      const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 360, 270);
      g.addColorStop(0, '#F4EADB'); g.addColorStop(1, '#E6D2BC');
      x.fillStyle = g; x.fillRect(0, 0, 360, 270);
      [['#1F3A5F', 90, 190, 120], ['#D9643A', 255, 95, 85], ['#E9B44C', 300, 215, 60], ['#2E8B7A', 150, 70, 52], ['#17171F', 40, 40, 34]].forEach(([cl, cx, cy, r]) => {
        const rg = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
        rg.addColorStop(0, cl); rg.addColorStop(0.75, cl); rg.addColorStop(1, cl + '00');
        x.fillStyle = rg; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
      });
      this.setSource(c, c.toDataURL());
    }

    /* ----- pipeline ----- */
    sample() {
      if (!this.img) return;
      const src = this.img, w0 = src.naturalWidth || src.width, h0 = src.naturalHeight || src.height;
      const sc = Math.min(1, this.s.res / Math.max(w0, h0));
      const w = Math.max(1, Math.round(w0 * sc)), h = Math.max(1, Math.round(h0 * sc));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const cx = cv.getContext('2d', { willReadFrequently: true });
      cx.drawImage(src, 0, 0, w, h);
      let d;
      try { d = cx.getImageData(0, 0, w, h).data; } catch { this.meta('cannot read pixels (cross-origin) — upload the file instead'); return; }
      const map = new Int32Array(w * h).fill(-1), L = new Float64Array(w * h * 3), RGB = new Uint8Array(w * h * 3);
      let n = 0;
      for (let p = 0; p < w * h; p++) {
        if (d[p * 4 + 3] < 128) continue; // ignore transparent pixels
        const r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2], l = rgb2lab(r, g, b);
        RGB[n * 3] = r; RGB[n * 3 + 1] = g; RGB[n * 3 + 2] = b;
        L[n * 3] = l[0]; L[n * 3 + 1] = l[1]; L[n * 3 + 2] = l[2];
        map[p] = n++;
      }
      if (!n) { this.meta('image has no opaque pixels'); return; }
      this.pix = { w, h, map, L, RGB, n };
      this.cluster();
    }

    cluster() {
      if (!this.pix) return;
      const { L, RGB, n } = this.pix, k = Math.min(this.s.k, n), t0 = performance.now();
      const { A, iters, hist } = kmeans(L, n, k, this.s.seed);
      const stp = Math.max(1, Math.ceil(n / 1400)), pts = [];
      for (let i = 0; i < n; i += stp) pts.push({ L: L[i * 3], a: L[i * 3 + 1], b: L[i * 3 + 2], css: `rgb(${RGB[i * 3]},${RGB[i * 3 + 1]},${RGB[i * 3 + 2]})` });
      this.km = { hist, k, pts, n }; this.kmSig = (this.kmSig || 0) + 1;
      const S = new Float64Array(k * 3), N = new Int32Array(k);
      for (let i = 0; i < n; i++) { const c = A[i]; N[c]++; S[c * 3] += RGB[i * 3]; S[c * 3 + 1] += RGB[i * 3 + 1]; S[c * 3 + 2] += RGB[i * 3 + 2]; }
      this.A = A;
      this.raw = [...Array(k).keys()].filter(c => N[c])
        .map(c => ({ cid: c, rgb: [S[c * 3] / N[c], S[c * 3 + 1] / N[c], S[c * 3 + 2] / N[c]].map(Math.round), share: N[c] / n }))
        .sort((a, b) => b.share - a.share);
      this.s.base = Math.min(this.s.base, this.raw.length - 1);
      this.meta(`${n.toLocaleString()} px · ${iters} iterations · ${(performance.now() - t0).toFixed(0)} ms`);
      if (!this._picked && !PRESETS[this.getAttribute('preset')]) this.s.opt = null; // follow the #1 ranked option until the user picks one
      this.refresh();
    }

    build() {
      const s = this.s;
      this.pal = this.raw.map((p, i) => Object.assign(col(p.rgb, 'P' + (i + 1)), { share: p.share, cid: p.cid, src: 'p' }));
      const [h, S, l] = rgb2hsl(this.pal[s.base].rgb);
      this.baseHsl = [h, S, l];
      this.harm = genHarm(s.harm, h, S, l).map((x, i) => Object.assign(col(hsl2rgb(x), 'H' + (i + 1)), { hsl: x, src: 'h' }));
      this.work = [...this.pal, Object.assign(col(WHITE, 'White'), { src: 'x' }), Object.assign(col(INK, 'Ink'), { src: 'x' }), ...this.harm];
    }

    refresh() {
      if (!this.raw) return;
      this.build(); this.drawQuant(); this.renderPalette(); this.renderHarm(); this.renderMatrix(); this.renderFormulas();
      this.rankOptions(); this.renderOptions(); this.renderFinal();
      this.st.km.set(this.kmSig);
    }

    drawQuant() {
      const { w, h, map } = this.pix, cv = this.$('.quant');
      cv.width = w; cv.height = h;
      const cx = cv.getContext('2d'), im = cx.createImageData(w, h), byCid = {};
      this.pal.forEach(p => (byCid[p.cid] = p.rgb));
      for (let p = 0; p < w * h; p++) {
        const m = map[p]; if (m < 0) continue;
        const c = byCid[this.A[m]];
        im.data[p * 4] = c[0]; im.data[p * 4 + 1] = c[1]; im.data[p * 4 + 2] = c[2]; im.data[p * 4 + 3] = 255;
      }
      cx.putImageData(im, 0, 0);
    }

    // swatch face: hex + best-contrast ratio written in the best-contrast colour from the palette (or white/ink)
    face(c) {
      const cands = [...this.pal.map(p => p.rgb), WHITE, INK].filter(v => hex(v) !== c.hex);
      const t = cands.reduce((m, v) => (contrast(v, c.rgb) > contrast(m, c.rgb) ? v : m));
      return `<i style="background:${c.hex};color:${hex(t)}"><b>${c.hex}</b><small>${hex(t)} · ${contrast(t, c.rgb).toFixed(1)}:1</small></i>`;
    }

    renderPalette() {
      const s = this.s;
      this.$('.bar').innerHTML = this.pal.map(p => `<div style="flex:${p.share};background:${p.hex}" title="${p.name} ${p.hex} ${(p.share * 100).toFixed(1)}%"></div>`).join('');
      this.$('.spal').innerHTML = this.pal.map((p, i) => {
        const [h, S, l] = rgb2hsl(p.rgb);
        return `<button class="chip${i === s.base ? ' base' : ''}" data-a="base" data-i="${i}" aria-label="Use ${p.hex} as base">${this.face(p)}<span>${p.name} · ${(p.share * 100).toFixed(1)}%<br>rgb ${p.rgb.join(' ')}<br>hsl ${h.toFixed(0)} ${S.toFixed(0)} ${l.toFixed(0)}</span></button>`;
      }).join('');
      this.st.chroma.set(this.pal.map(p => p.hex + p.share.toFixed(3)).join());
    }

    renderHarm() {
      const s = this.s, base = this.pal[s.base], [h, S, l] = this.baseHsl, H = HARM[s.harm];
      this.shadowRoot.querySelectorAll('[data-a=harm]').forEach(b => b.classList.toggle('on', b.dataset.m === s.harm));
      const inv = base.rgb.map(v => 255 - v);
      this.$('.formula').innerHTML =
        `base   <i class="dot" style="background:${base.hex}"></i> ${base.name} ${base.hex}\n` +
        `HSL    H=${h.toFixed(0)}°  S=${S.toFixed(0)}%  L=${l.toFixed(0)}%\n` +
        `rule   ${H.f}${H.o ? '   (S, L kept)' : ''}\n` +
        `RGB complement  (255−R, 255−G, 255−B) = <i class="dot" style="background:${hex(inv)}"></i> ${hex(inv)}` +
        (S < 8 ? `\nnote   base is near-grey (S≈0) so hue rotation has little effect` : '');
      this.$('.sharm').innerHTML = this.harm.map(c => {
        const near = this.pal.reduce((m, p) => (dE(p.lab, c.lab) < dE(m.lab, c.lab) ? p : m));
        return `<div class="chip">${this.face(c)}<span>${c.name} · hsl ${(((c.hsl[0] % 360) + 360) % 360).toFixed(0)} ${c.hsl[1].toFixed(0)} ${c.hsl[2].toFixed(0)}<br>nearest <i class="dot" style="background:${near.hex}"></i> ${near.name} ΔE ${dE(near.lab, c.lab).toFixed(1)}</span></div>`;
      }).join('');
      this.st.harm.set(s.harm + base.hex);
    }

    renderMatrix() {
      const s = this.s, mixed = s.mx === 'mix', P = mixed ? [...this.pal, ...this.harm] : this.pal;
      this.shadowRoot.querySelectorAll('[data-a=mx]').forEach(b => {
        b.classList.toggle('on', b.dataset.m === (mixed ? 'mix' : 'pal'));
        if (b.dataset.m === 'mix') b.textContent = `palette + ${HARM[s.harm].label.toLowerCase()} harmony`;
      });
      const head = (p, dir) => `<th class="${p.src === 'h' ? 'hh' : ''}" title="${dir} ${p.name} ${p.hex}"><i class="dot" style="background:${p.hex}"></i><small>${p.name}</small></th>`;
      let t = `<table style="min-width:${(P.length + 1) * 38}px"><tr><th></th>${P.map(p => head(p, 'text')).join('')}</tr>`;
      P.forEach((bg, i) => {
        t += `<tr>${head(bg, 'background')}`;
        P.forEach((tx, j) => {
          if (i === j) { t += `<td style="background:${bg.hex}"></td>`; return; }
          const r = contrast(bg.rgb, tx.rgb), x = bg.src === 'h' || tx.src === 'h';
          t += `<td class="${r < 4.5 ? 'lo' : ''}${x ? ' hx' : ''}" style="background-color:${bg.hex};color:${tx.hex}" title="${tx.name} ${tx.hex} on ${bg.name} ${bg.hex}: ${r.toFixed(2)}:1 ${rate(r)}"><b>Aa</b><small>${r.toFixed(1)}</small></td>`;
        });
        t += '</tr>';
      });
      this.$('.mx').innerHTML = t + '</table>';
      this.$('.pladder').innerHTML = ladder(P.map(p => [p.name, p]));

      // summary: how many AA pairs exist, and what the harmony colours add
      const pairs = (A, B) => A.flatMap(a => B.filter(b => b !== a).map(b => [a, b, contrast(a.rgb, b.rgb)]));
      const aa = list => list.filter(p => p[2] >= 4.5).length;
      const base = pairs(this.pal, this.pal);
      if (!mixed) {
        this.$('.mxsum').innerHTML = `${aa(base)} / ${base.length} ordered pairs pass AA (4.5:1) using the extracted palette only.`;
      } else {
        const cross = pairs(P, P).filter(([a, b]) => a.src === 'h' || b.src === 'h');
        // one direction per pair: the lighter colour as background
        const top = cross.filter(([a, b]) => a.src !== b.src && lum(a.rgb) >= lum(b.rgb)).sort((x, y) => y[2] - x[2]).slice(0, 3);
        this.$('.mxsum').innerHTML = `palette alone: ${aa(base)} AA pairs · harmony adds ${aa(cross)} more (of ${cross.length}). ` +
          `best new pairings: ` + top.map(([a, b, r]) => `<i class="dot" style="background:${b.hex}"></i> on <i class="dot" style="background:${a.hex}"></i> ${b.name}/${a.name} ${r.toFixed(1)}:1`).join(' · ') +
          `. dashed headers + outlined cells = ${HARM[s.harm].label.toLowerCase()} colours.`;
      }
      this.st.field.set((mixed ? 'm' : 'p') + P.map(p => p.hex).join());
    }

    /* ----- contrast formulas ----- */
    renderFormulas() {
      // colour set follows the matrix mode in 04: extracted palette, or palette + current harmony
      const mixed = this.s.mx === 'mix', P = mixed ? [...this.pal, ...this.harm] : this.pal;
      if (!P[this.s.fxBase]) this.s.fxBase = this.s.base;
      const B = P[this.s.fxBase], [h, s, l] = rgb2hsl(B.rgb), setName = mixed ? `palette + ${HARM[this.s.harm].label.toLowerCase()}` : 'palette';
      let mx = [0, 1], mn = [0, 1];
      if (P.length > 1) {
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const r = contrast(P[i].rgb, P[j].rgb);
          if (r > contrast(P[mx[0]].rgb, P[mx[1]].rgb)) mx = [i, j];
          if (r < contrast(P[mn[0]].rgb, P[mn[1]].rgb)) mn = [i, j];
        }
      } else { mx = mn = [0, 0]; }
      const order = ([i, j]) => (lum(P[i].rgb) > lum(P[j].rgb) ? [i, j] : [j, i]);
      const [mxB, mxT] = order(mx), [mnB, mnT] = order(mn);
      const dark = l < 50, Yb = lum(B.rgb);
      const hi = [
        ['Target ratio 7:1', 'Y_t = (Y_b + 0.05)·7 − 0.05   (lighter)\nY_t = (Y_b + 0.05)/7 − 0.05   (darker)\nsolve HSL L at base hue → Y_t', B.rgb, atRatio(B.rgb, B.rgb, 7), 'body text in the brand hue'],
        ['Inverse complement', "H' = H + 180°\nL' = 100 − L   (S kept)", B.rgb, hsl2rgb([h + 180, s, 100 - l]), 'vibrating headline / poster pair'],
        ['Black-or-white switch', `text = Y_b > 0.179 ? ink : white\n0.179 = √(1.05 × 0.05) − 0.05   (Y_b = ${Yb.toFixed(3)})`, B.rgb, Yb > 0.179 ? INK : WHITE, 'labels on any brand fill'],
        [`Max pair · ${P[mxT].name} on ${P[mxB].name}`, `argmax  (L₁ + 0.05)/(L₂ + 0.05)\nover all ${setName} pairs i ≠ j`, P[mxB].rgb, P[mxT].rgb, 'primary text on primary ground'],
      ];
      const lo = [
        ['Tonal step 1.25:1', 'Y_t = (Y_b + 0.05)·1.25 − 0.05\nsame H, S — only L moves', B.rgb, atRatio(B.rgb, B.rgb, 1.25), 'cards, panels on the ground'],
        ['Tint / shade mix', dark ? "shade: C' = C·(1 − t)\nt = 0.35 bg, 0.15 fg" : "tint: C' = C + t·(255 − C)\nt = 0.88 bg, 0.65 fg",
          dark ? mix(B.rgb, [0, 0, 0], 0.35) : mix(B.rgb, WHITE, 0.88), dark ? mix(B.rgb, [0, 0, 0], 0.15) : mix(B.rgb, WHITE, 0.65), 'section backgrounds, washes'],
        ['Analogous neighbour', `H' = H + 20°\nL' = L ${dark ? '+' : '−'} 8   (S kept)`, B.rgb, hsl2rgb([h + 20, s, l + (dark ? 8 : -8)]), 'hover states, gradients'],
        [`Min pair · ${P[mnT].name} on ${P[mnB].name}`, `argmin  (L₁ + 0.05)/(L₂ + 0.05)\nover all ${setName} pairs i ≠ j`, P[mnB].rgb, P[mnT].rgb, 'dividers, quiet borders'],
      ];
      const card = (kind, [name, f, bg, fg, use]) => {
        // "Aa" is set in the formula's colour; the readout uses whichever of fg/white/ink reads on bg
        const r = contrast(bg, fg), meta = hex(onColor(bg, [fg, WHITE, INK]));
        const verdict = kind === 'lo' && r < 3 ? 'decorative only' : rate(r);
        return `<div class="fx"><div class="fx-h"><span class="tag ${kind}">${kind === 'hi' ? 'HIGH' : 'LOW'}</span>${name}</div><code>${f}</code>` +
          `<div class="fx-tile" style="background:${hex(bg)};color:${meta}"><b style="color:${hex(fg)}">Aa</b><span>${hex(fg)} on ${hex(bg)}</span><span>${r.toFixed(2)}:1 · ${verdict}</span></div>` +
          `<small>use: ${use}</small></div>`;
      };
      this.$('.fxbase').innerHTML =
        `<div class="row" style="margin-bottom:6px"><span>set: <b>${setName}</b> (switch in 04) · base:</span>` +
        P.map((p, i) => `<button class="fxpick${i === this.s.fxBase ? ' on' : ''}${p.src === 'h' ? ' hh' : ''}" data-a="fxbase" data-i="${i}" title="${p.name} ${p.hex}" aria-pressed="${i === this.s.fxBase}"><i class="dot" style="background:${p.hex}"></i> ${p.name}</button>`).join('') +
        `</div>base ${B.name} ${B.hex} · HSL ${h.toFixed(0)}° ${s.toFixed(0)}% ${l.toFixed(0)}% · Y_b (relative luminance) = ${Yb.toFixed(3)}`;
      this.$('.fxhi').innerHTML = hi.map(x => card('hi', x)).join('');
      this.$('.fxlo').innerHTML = lo.map(x => card('lo', x)).join('');
      this.fxB = B; this.st.bis.set(B.hex);
    }

    /* ----- brand options ----- */
    pick(P) {
      const W = this.work, all = W.map((_, i) => i), pal = all.filter(i => W[i].src === 'p'), harm = all.filter(i => W[i].src === 'h');
      const cr = (a, b) => contrast(W[a].rgb, W[b].rgb);
      const byL = [...pal].sort((a, b) => W[b].lab[0] - W[a].lab[0]); // light -> dark
      const byC = [...pal].sort((a, b) => W[b].C - W[a].C);
      const next = (list, not) => list.find(i => !not.includes(i)) ?? list[0];
      const best = (pool, f) => pool.reduce((m, i) => (f(i) > f(m) ? i : m), pool[0]);
      const text = bg => { const good = pal.filter(i => i !== bg && cr(i, bg) >= 7); return best(good.length ? good : all, i => cr(i, bg)); };
      const accent = bg => { const ok = pal.filter(i => i !== bg && cr(i, bg) >= 3); const p = ok.length ? ok : pal.filter(i => i !== bg); return p.length ? best(p, i => W[i].C) : bg; };
      const nearHue = (bg, t) => { const ok = pal.filter(i => i !== bg && W[i].C > 15); return ok.length ? best(ok, i => -hueDist(W[i].hue, t) + (cr(i, bg) >= 3 ? 30 : 0)) : accent(bg); };
      const r = {};
      if (P.mode === 'dark') { r.bg = byL[byL.length - 1]; r.sf = next([...byL].reverse(), [r.bg]); }
      else if (P.mode === 'chroma') { r.bg = byC[0]; r.sf = next([...byL].reverse(), [r.bg]); }
      else { r.bg = byL[0]; r.sf = next(byL, [r.bg]); }
      r.tx = text(r.bg);
      r.ac = P.hue != null ? nearHue(r.bg, P.hue) : P.acHarm && harm.length ? best(harm, i => cr(i, r.bg)) : accent(r.bg);
      r.ac2 = P.ac2 === 'light' ? next(byL, [r.bg, r.ac]) : P.ac2 === 'dark' ? next([...byL].reverse(), [r.bg, r.tx]) : harm.length ? next(harm, [r.ac]) : next(byC, [r.ac, r.bg]);
      return this.finish({ bg: W[r.bg], sf: W[r.sf], tx: W[r.tx], ac: W[r.ac], ac2: W[r.ac2] });
    }

    finish(v) {
      const ext = [v.tx.rgb, v.bg.rgb, WHITE, INK];
      v.on = hex(onColor(v.ac.rgb, ext)); v.on2 = hex(onColor(v.ac2.rgb, ext)); v.onsf = hex(onColor(v.sf.rgb, ext));
      v.rt = contrast(v.tx.rgb, v.bg.rgb); v.ra = contrast(v.ac.rgb, v.bg.rgb); v.ro = contrast(onColor(v.ac.rgb, ext), v.ac.rgb);
      v.score = Math.round(Math.min(v.rt / 7, 1) * 50 + Math.min(v.ra / 3, 1) * 25 + Math.min(v.ro / 4.5, 1) * 15 + Math.min(v.ac.C / 60, 1) * 10);
      return v;
    }

    rankOptions() {
      this.options = Object.entries(PRESETS).map(([key, P]) => ({ key, P, v: this.pick(P) })).sort((a, b) => b.v.score - a.v.score);
      if (!this.s.opt) this.s.opt = this.options[0].key;
    }

    renderOptions() {
      this.$('.opts').innerHTML = this.options.map(({ key, P, v }, i) => {
        const st = `font-family:${P.font.replace(/"/g, "'")};font-weight:${P.hw};letter-spacing:${P.tr};text-transform:${P.tt}`;
        return `<button class="opt${key === this.s.opt ? ' on' : ''}" data-a="opt" data-p="${key}" aria-pressed="${key === this.s.opt}">` +
          pattern(this.s.pattern, v, 'bal', 10, 2, 7 + i) +
          `<div class="opt-pv" style="background:${v.bg.hex};color:${v.tx.hex}">` +
          `<span class="eb" style="background:${v.ac2.hex};color:${v.on2};border-radius:${P.r}px">#${i + 1} · ${P.label}</span>` +
          `<strong style="${st}">Brand voice</strong>` +
          `<span class="btn" style="background:${v.ac.hex};color:${v.on};border-radius:${P.r}px;font-family:${P.font.replace(/"/g, "'")}">Action</span></div>` +
          `<div class="opt-meta"><b>${P.label}</b> · score ${v.score}<br><span class="mute">${P.desc}</span><br>text ${v.rt.toFixed(1)}:1 · accent ${v.ra.toFixed(1)}:1` +
          `<div class="sw5">${['bg', 'sf', 'tx', 'ac', 'ac2'].map(k => `<i class="dot" style="background:${v[k].hex}" title="${k} ${v[k].hex}"></i>`).join('')}</div></div></button>`;
      }).join('');
      this.st.score.set(this.options.map(o => o.key + o.v.score).join());
    }

    /* ----- final variations ----- */
    makeVariants(cb) {
      const c = (rgb, n) => col(rgb, n);
      const darkTheme = lum(cb.bg.rgb) < 0.179;
      // High: push text to ≥12.5:1 (or as far as the hue allows), accents to AA
      const bgH = cb.bg.rgb;
      const high = this.finish({
        name: 'High contrast', mode: 'high', note: 'text ≥ 12:1, accents ≥ 4.5:1',
        bg: cb.bg, sf: c(atRatio(bgH, bgH, 1.15), 'sf'),
        tx: c(cb.rt >= 12.5 ? cb.tx.rgb : atRatio(cb.tx.rgb, bgH, 12.5), 'tx'),
        ac: c(cb.ra >= 4.5 ? cb.ac.rgb : atRatio(cb.ac.rgb, bgH, 4.5), 'ac'),
        ac2: c(contrast(cb.ac2.rgb, bgH) >= 3 ? cb.ac2.rgb : atRatio(cb.ac2.rgb, bgH, 3), 'ac2'),
      });
      const bal = this.finish(Object.assign({}, cb, { name: 'Balanced', mode: 'bal', note: 'brand option as picked' }));
      // Low / tonal: everything in the accent hue, close in luminance; text still AA
      const lbg = darkTheme ? mix(cb.ac.rgb, [8, 8, 10], 0.8) : mix(cb.ac.rgb, WHITE, 0.86);
      const low = this.finish({
        name: 'Low contrast · tonal', mode: 'low', note: 'surfaces 1.2–1.6:1, text held at AA',
        bg: c(lbg, 'bg'), sf: c(atRatio(lbg, lbg, 1.2), 'sf'),
        tx: c(atRatio(cb.ac.rgb, lbg, 4.6), 'tx'),
        ac: c(atRatio(cb.ac.rgb, lbg, 3.1), 'ac'),
        ac2: c(atRatio(cb.ac2.rgb, lbg, 1.6), 'ac2'),
      });
      return [high, bal, low];
    }

    renderFinal() {
      const s = this.s, o = this.options.find(x => x.key === s.opt) || this.options[0], P = o.P;
      this.P = P;
      this.variants = this.makeVariants(o.v);
      const [hv, bv, lv] = this.variants;
      hv.write = `Text pushed to ${hv.rt.toFixed(1)}:1 on ${hv.bg.hex}; accents raised to at least 4.5:1 so links, buttons and icons stay legible at small sizes. Use for product UI, long-form reading and accessibility-first pages.`;
      bv.write = `The ${P.label} option as ranked (score ${bv.score}/100). Text ${bv.rt.toFixed(1)}:1, accent ${bv.ra.toFixed(1)}:1. Closest to the source image — the primary brand expression for site, decks and social.`;
      lv.write = `Tonal system in the accent hue: surfaces sit 1.2–1.6:1 from the ground for calm layering, while text is held at ${lv.rt.toFixed(1)}:1 (${rate(lv.rt)}). Use for backgrounds, editorial spreads, packaging and quiet sections.`;
      this.$('.pats').innerHTML = Object.entries(PATTERNS).map(([k, n]) =>
        `<button class="pat${k === s.pattern ? ' on' : ''}" data-a="pat" data-p="${k}" aria-pressed="${k === s.pattern}">${pattern(k, bv, 'bal', 5, 2)}<span>${n}</span></button>`).join('');
      this.$('.vrs').innerHTML = this.variants.map((v, i) => {
        const rows = [['text / bg', v.rt], ['label / accent', v.ro], ['text / surface', contrast(v.tx.rgb, v.sf.rgb)], ['accent / bg (UI)', v.ra, true]];
        return `<article class="vr${i === s.variant ? ' on' : ''}" style="--font:${P.font.replace(/"/g, "'")};--hw:${P.hw};--tr:${P.tr};--tt:${P.tt};--r:${P.r}px">` +
          `<div class="vr-art">${pattern(s.pattern, v, v.mode, 10, 6)}</div>` +
          `<div class="vr-body" style="background:${v.bg.hex};color:${v.tx.hex}">` +
          `<span class="eb" style="background:${v.ac2.hex};color:${v.on2}">${String.fromCharCode(65 + i)} · ${v.name}</span>` +
          `<h3>Colour that carries the brand.</h3><p>${P.label} language. ${v.note}.</p>` +
          `<div class="btns"><span class="b1" style="background:${v.ac.hex};color:${v.on};border-color:${v.ac.hex}">Get started</span><span class="b2" style="border-color:${v.tx.hex}">Learn more</span></div>` +
          `<div class="card" style="background:${v.sf.hex};color:${v.onsf}">Surface card · ${v.sf.hex}</div></div>` +
          `<div class="vr-meta"><div class="ratio" title="60 / 30 / 10 rule">` +
          `<div style="flex:6;background:${v.bg.hex};color:${v.tx.hex}">60 bg</div><div style="flex:3;background:${v.sf.hex};color:${v.onsf}">30 surface</div><div style="flex:1;background:${v.ac.hex};color:${v.on}">10</div></div>` +
          ladder([['bg', v.bg], ['surf', v.sf], ['text', v.tx], ['acc', v.ac], ['acc2', v.ac2]], [v.bg, v.tx]) +
          rows.map(([n, r, ui]) => `<div class="ck"><span>${n}</span><span>${r.toFixed(2)}:1 ${badge(r, ui)}</span></div>`).join('') +
          `<p class="vr-write">${v.write}</p>` +
          `<button data-a="variant" data-i="${i}" class="${i === s.variant ? 'on' : ''}">${i === s.variant ? '✓ exporting this' : 'export this'}</button></div></article>`;
      }).join('');
      this.st.slope.set(this.variants.map(v => ['bg', 'sf', 'tx', 'ac', 'ac2'].map(k => v[k].hex).join('')).join());
      this.renderExport();
    }

    /* ----- live figures ----- */
    // FIG 01: pixels as a 3D cloud in CIELAB, centroids replaying their k-means iterations
    drawKm(cx, w, h, t, dt) {
      vbg(cx, w, h);
      const km = this.km, o = this.orbit;
      if (!km) return false;
      if (!o.drag && !REDUCED) o.yaw += dt * 0.2;
      const S = km.hist.length, dur = Math.min(0.85, 9 / S), conv = (S - 1) * dur, total = conv + 3;
      const tt = REDUCED ? total : t % total;
      const f = Math.min(tt / dur, S - 1), i = Math.floor(f), fr = ease(f - i), K = km.k;
      const A = km.hist[i], B = km.hist[Math.min(i + 1, S - 1)];
      const C = [...Array(K).keys()].map(c => [0, 1, 2].map(d => A[c * 3 + d] + (B[c * 3 + d] - A[c * 3 + d]) * fr));
      const sc = Math.min(w / 330, h / 250), oy = h * 0.54;
      const cy = Math.cos(o.yaw), sy = Math.sin(o.yaw), cp = Math.cos(o.pitch), sp = Math.sin(o.pitch);
      const P = (L, a, b) => {
        const x = a * cy - b * sy, z0 = a * sy + b * cy, y = (L - 50) * 1.2;
        const Y = y * cp + z0 * sp, Z = z0 * cp - y * sp, k = 560 / (560 + Z);
        return [w / 2 + x * k * sc, oy - Y * k * sc, Z, k];
      };
      const poly = (L, R, style, lw, dash) => {
        cx.beginPath();
        for (let j = 0; j <= 72; j++) { const a = (j / 72) * TAU, p = P(L, R * Math.cos(a), R * Math.sin(a)); j ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1]); }
        cx.strokeStyle = style; cx.lineWidth = lw; cx.setLineDash(dash || []); cx.stroke(); cx.setLineDash([]);
      };
      // floor: chroma rings + hue band, axes
      poly(0, 40, VF, 1); poly(0, 80, VF, 1); poly(100, 80, 'rgba(233,233,230,.06)', 1, [2, 4]);
      for (let j = 0; j < 90; j++) {
        const a0 = (j / 90) * TAU, a1 = ((j + 1) / 90) * TAU, am = (a0 + a1) / 2, p0 = P(0, 112 * Math.cos(a0), 112 * Math.sin(a0)), p1 = P(0, 112 * Math.cos(a1), 112 * Math.sin(a1));
        seg(cx, p0[0], p0[1], p1[0], p1[1], rgba(lab2rgb(64, 60 * Math.cos(am), 60 * Math.sin(am)), 0.85), 3 * p0[3]);
      }
      let p = P(0, -112, 0), q = P(0, 112, 0); seg(cx, p[0], p[1], q[0], q[1], VF);
      p = P(0, 0, -112); q = P(0, 0, 112); seg(cx, p[0], p[1], q[0], q[1], VF);
      p = P(0, 0, 0); q = P(100, 0, 0); seg(cx, p[0], p[1], q[0], q[1], 'rgba(233,233,230,.45)');
      [0, 25, 50, 75, 100].forEach(L => { const r = P(L, 0, 0); seg(cx, r[0] - 3, r[1], r[0] + 3, r[1], VD); vt(cx, 'L ' + L, r[0] + 7, r[1] + 3, { c: VD, s: 9 }); });
      [['+a*', 124, 0], ['−a*', -124, 0], ['+b*', 0, 124], ['−b*', 0, -124]].forEach(([l, a, b]) => { const r = P(0, a, b); vt(cx, l, r[0], r[1] + 3, { c: VD, a: 'center' }); });
      // pixel cloud, back to front
      const pts = km.pts, n = pts.length, pr = pts.map(v => P(v.L, v.a, v.b));
      const cc = C.map(c => lab2rgb(c[0], c[1], c[2])), cpj = C.map(c => P(c[0], c[1], c[2]));
      const links = C.map(() => new Path2D());
      for (let j = 0; j < n; j += 3) {
        const v = pts[j]; let bi = 0, bd = Infinity;
        for (let c = 0; c < K; c++) { const d = (v.L - C[c][0]) ** 2 + (v.a - C[c][1]) ** 2 + (v.b - C[c][2]) ** 2; if (d < bd) { bd = d; bi = c; } }
        links[bi].moveTo(pr[j][0], pr[j][1]); links[bi].lineTo(cpj[bi][0], cpj[bi][1]);
      }
      cx.lineWidth = 0.6; links.forEach((l, c) => { cx.strokeStyle = rgba(cc[c], 0.17); cx.stroke(l); });
      [...Array(n).keys()].sort((x, y) => pr[y][2] - pr[x][2]).forEach(j => { const r = pr[j], s = 2.3 * r[3]; cx.fillStyle = pts[j].css; cx.fillRect(r[0] - s / 2, r[1] - s / 2, s, s); });
      // centroid trails + seeds
      for (let c = 0; c < K; c++) {
        cx.beginPath();
        for (let s2 = 0; s2 <= i; s2++) { const hh = km.hist[s2], r = P(hh[c * 3], hh[c * 3 + 1], hh[c * 3 + 2]); s2 ? cx.lineTo(r[0], r[1]) : cx.moveTo(r[0], r[1]); }
        cx.lineTo(cpj[c][0], cpj[c][1]); cx.strokeStyle = 'rgba(233,233,230,.5)'; cx.lineWidth = 1; cx.setLineDash([2, 3]); cx.stroke(); cx.setLineDash([]);
        const h0 = km.hist[0], r0 = P(h0[c * 3], h0[c * 3 + 1], h0[c * 3 + 2]);
        cx.beginPath(); cx.arc(r0[0], r0[1], 3, 0, TAU); cx.strokeStyle = VD; cx.stroke();
      }
      const name = c => this.pal?.find(v => v.cid === c)?.name || 'μ' + (c + 1);
      [...Array(K).keys()].sort((x, y) => cpj[y][2] - cpj[x][2]).forEach(c => {
        const r = cpj[c], rad = 7.5 * r[3];
        dot(cx, r[0], r[1], rad, rgba(cc[c]), '#fff', 18);
        vt(cx, name(c), r[0] + rad + 4, r[1] - rad + 2, { w: 700 });
      });
      // HUD
      let mv = 0;
      if (i < S - 1) for (let c = 0; c < K; c++) mv = Math.max(mv, Math.hypot(B[c * 3] - A[c * 3], B[c * 3 + 1] - A[c * 3 + 1], B[c * 3 + 2] - A[c * 3 + 2]));
      const done = tt >= conv;
      vt(cx, done ? `converged · ${S - 1} iteration${S > 2 ? 's' : ''}` : `iteration ${i + 1} / ${S - 1}`, 12, 20, { w: 700, s: 11 });
      vt(cx, done ? 'max Δμ < 0.1 — centroids are stable' : `max centroid shift Δμ = ${mv.toFixed(2)}`, 12, 34, { c: VD });
      vt(cx, `${n.toLocaleString()} of ${km.n.toLocaleString()} px · k = ${K}`, w - 12, 20, { c: VD, a: 'right' });
      cx.fillStyle = VF; cx.fillRect(0, h - 2, w, 2);
      cx.fillStyle = 'rgba(233,233,230,.75)'; cx.fillRect(0, h - 2, w * Math.min(1, tt / conv), 2);
      return true;
    }

    // FIG 02: palette on the a*b* plane, chroma as radius, hue as angle, area as share
    drawChroma(cx, w, h, t) {
      vbg(cx, w, h);
      if (!this.pal) return false;
      const R = Math.min(w, h) / 2 - 26, ox = w / 2, oy = h / 2;
      const Cmax = clamp(Math.ceil((Math.max(...this.pal.map(p => p.C)) * 1.2) / 25) * 25, 50, 125), s = R / Cmax, wide = w - 2 * R > 420;
      for (let j = 0; j < 120; j++) {
        const a0 = (j / 120) * TAU, a1 = ((j + 1.2) / 120) * TAU, am = ((j + 0.5) / 120) * TAU;
        cx.beginPath(); cx.arc(ox, oy, R + 9, -a1, -a0);
        cx.strokeStyle = rgba(lab2rgb(66, 56 * Math.cos(am), 56 * Math.sin(am)), 0.85); cx.lineWidth = 6; cx.stroke();
      }
      for (let c = 25; c <= Cmax; c += 25) { cx.beginPath(); cx.arc(ox, oy, c * s, 0, TAU); cx.strokeStyle = VF; cx.lineWidth = 1; cx.stroke(); vt(cx, 'C ' + c, ox + c * s * 0.707 + 3, oy - c * s * 0.707 - 3, { c: VD, s: 9 }); }
      seg(cx, ox - R, oy, ox + R, oy, VF); seg(cx, ox, oy - R, ox, oy + R, VF);
      vt(cx, '+a*', ox + R - 4, oy - 6, { c: VD, a: 'right' }); vt(cx, '−a*', ox - R + 4, oy - 6, { c: VD });
      vt(cx, '+b*', ox + 6, oy - R + 12, { c: VD }); vt(cx, '−b*', ox + 6, oy + R - 6, { c: VD });
      const list = this.pal.map((p, i) => ({ p, i, q: prog(t, 0.15 + i * 0.12, 0.9) })).sort((x, y) => y.p.share - x.p.share);
      list.forEach(it => {
        const { p, i, q } = it;
        if (!q) return;
        const x = ox + p.lab[1] * s * q, y = oy - p.lab[2] * s * q, r = (4 + Math.sqrt(p.share) * R * 0.3) * q;
        seg(cx, ox, oy, x, y, 'rgba(233,233,230,.3)');
        dot(cx, x, y, r, p.hex, i === this.s.base ? '#fff' : 'rgba(255,255,255,.55)', 16);
        Object.assign(it, { x, y, r });
      });
      const shown = list.filter(v => v.q > 0.6), hue = p => ((Math.atan2(p.lab[2], p.lab[1]) * 180) / Math.PI + 360) % 360;
      if (wide) {
        [[shown.filter(v => v.x >= ox), ox + R + 34, 'left'], [shown.filter(v => v.x < ox), ox - R - 34, 'right']].forEach(([side, lx, a]) => {
          spread(side.map(v => ({ ...v, ly: v.y, y: v.y })), 26, h - 14).forEach(v => {
            seg(cx, v.x + (a === 'left' ? v.r : -v.r), v.ly, lx + (a === 'left' ? -6 : 6), v.y - 3, 'rgba(233,233,230,.28)');
            vt(cx, `${v.p.name} · ${(v.p.share * 100).toFixed(1)}% · ${v.p.hex}`, lx, v.y, { w: 700, a });
            vt(cx, `C* ${v.p.C.toFixed(1)} · h ${hue(v.p).toFixed(0)}° · L* ${v.p.lab[0].toFixed(0)}`, lx, v.y + 11, { c: VD, s: 9, a });
          });
        });
      } else shown.forEach(({ p, x, y, r }) => {
        const d = Math.hypot(x - ox, y - oy) || 1, ux = d > 4 ? (x - ox) / d : 0.7, uy = d > 4 ? (y - oy) / d : -0.7;
        vt(cx, p.name, x + ux * (r + 9), y + uy * (r + 9) + 3, { w: 700, s: 9, a: 'center' });
      });
      vt(cx, 'top view of CIELAB', 12, 20, { w: 700, s: 11 });
      if (wide) vt(cx, 'distance = chroma · angle = hue', 12, 34, { c: VD });
      return t < 0.15 + this.pal.length * 0.12 + 1;
    }

    // FIG 03: harmony arms sweep round the HSL wheel from the base hue to their offsets
    drawHarm(cx, w, h, t) {
      vbg(cx, w, h);
      if (!this.harm) return false;
      const [H, S, L] = this.baseHsl, cfg = HARM[this.s.harm], mono = !cfg.o, items = cfg.o || cfg.l;
      const R = Math.min(w, h) / 2 - 30, ox = w / 2, oy = h / 2 + 4;
      const A = d => ((d - 90) * Math.PI) / 180, at = (d, r) => [ox + Math.cos(A(d)) * r, oy + Math.sin(A(d)) * r];
      for (let j = 0; j < 180; j++) { cx.beginPath(); cx.arc(ox, oy, R, A(j * 2), A(j * 2 + 2.4)); cx.strokeStyle = `hsl(${j * 2},72%,56%)`; cx.lineWidth = 9; cx.stroke(); }
      for (let d = 0; d < 360; d += 30) { const [a, b] = at(d, R + 7), [c, e] = at(d, R + 11); seg(cx, a, b, c, e, VD); }
      [0, 90, 180, 270].forEach(d => { const [x, y] = at(d, R + 22); vt(cx, d + '°', x, y + 3, { c: VD, s: 9, a: 'center' }); });
      cx.beginPath(); cx.arc(ox, oy, R * 0.62, 0, TAU); cx.strokeStyle = VF; cx.lineWidth = 1; cx.stroke();
      const rb = mono ? (R * 0.86 * L) / 100 : R * 0.8, base = this.pal[this.s.base];
      const [bx, by] = at(H, rb), [ex, ey] = at(H, R - 6);
      seg(cx, ox, oy, ex, ey, VD);
      const nodes = [{ x: bx, y: by, c: base.hex, l: 'base', ang: H }];
      items.forEach((d, j) => {
        const q = prog(t, 0.3 + j * 0.3, 1.2);
        if (!mono) {
          const cur = H + d * q, rr = R * (0.28 + j * 0.085), [x, y] = at(cur, R * 0.8), [ax, ay] = at(cur, R - 6);
          seg(cx, ox, oy, ax, ay, 'rgba(233,233,230,.32)');
          cx.beginPath(); cx.arc(ox, oy, rr, A(Math.min(H, cur)), A(Math.max(H, cur))); cx.strokeStyle = 'rgba(233,233,230,.7)'; cx.lineWidth = 1.2; cx.stroke();
          const [tx, ty] = at(cur, rr); dot(cx, tx, ty, 2, '#e9e9e6');
          if (q > 0.05) { const [lx, ly] = at(H + (d * q) / 2, rr + 9); vt(cx, `${d < 0 ? '−' : '+'}${Math.abs(Math.round(d * q))}°`, lx, ly + 3, { s: 9, a: 'center' }); }
          nodes.push({ x, y, c: hex(hsl2rgb([cur, S, L])), l: 'H' + (j + 1), ang: cur });
        } else {
          const Lc = clamp(L + d * q, 4, 96), r = (R * 0.86 * Lc) / 100, [x, y] = at(H, r);
          cx.beginPath(); cx.arc(ox, oy, r, 0, TAU); cx.strokeStyle = 'rgba(233,233,230,.1)'; cx.setLineDash([2, 4]); cx.stroke(); cx.setLineDash([]);
          nodes.push({ x, y, c: hex(hsl2rgb([H, S, Lc])), l: `L${d < 0 ? '−' : '+'}${Math.abs(Math.round(d * q))}`, ang: H });
        }
      });
      const end = 0.3 + items.length * 0.3 + 0.9, qq = prog(t, end, 0.7);
      if (!mono && qq > 0) {
        const ring = [...nodes].sort((a, b) => Math.atan2(a.y - oy, a.x - ox) - Math.atan2(b.y - oy, b.x - ox));
        cx.beginPath(); ring.forEach((n, k) => (k ? cx.lineTo(n.x, n.y) : cx.moveTo(n.x, n.y))); cx.closePath();
        cx.fillStyle = `rgba(233,233,230,${0.06 * qq})`; cx.fill(); cx.strokeStyle = `rgba(233,233,230,${0.65 * qq})`; cx.lineWidth = 1; cx.stroke();
      }
      nodes.slice(1).concat(nodes[0]).forEach((n, k) => {
        const isBase = k === nodes.length - 1, nx = mono ? Math.cos(A(H) + Math.PI / 2) * 16 : 0, ny = mono ? Math.sin(A(H) + Math.PI / 2) * 16 : 0;
        dot(cx, n.x, n.y, isBase ? 9 : 7.5, n.c, '#fff', 16);
        const [lx, ly] = mono ? [n.x + nx * (isBase ? -1 : 1), n.y + ny * (isBase ? -1 : 1)] : at(n.ang, R * 0.8 - 18);
        vt(cx, n.l, lx, ly + 3, { w: 700, s: 9, a: 'center' });
      });
      vt(cx, `H ${H.toFixed(0)}°`, ox, oy - 2, { w: 700, s: 11, a: 'center' });
      vt(cx, `S ${S.toFixed(0)} · L ${L.toFixed(0)}`, ox, oy + 11, { c: VD, s: 9, a: 'center' });
      vt(cx, cfg.label.toUpperCase(), 12, 20, { w: 700, s: 11 });
      vt(cx, cfg.f, 12, 34, { c: VD });
      return t < end + 0.8;
    }

    // FIG 04: every bg/text pair plotted in log-luminance; an iso-ratio sweep lights them up
    drawField(cx, w, h, t) {
      vbg(cx, w, h);
      if (!this.pal) return false;
      const P = this.s.mx === 'mix' ? [...this.pal, ...this.harm] : this.pal, span = LG1 - LG0;
      const side = Math.min(h - 46, w - 64), legend = w - side - 70 > 190, x0 = legend ? 52 : (w - side) / 2 + 16, y0 = 14;
      const X = v => x0 + ((v - LG0) / span) * side, Y = v => y0 + side - ((v - LG0) / span) * side;
      const zone = (d, a) => {
        cx.fillStyle = `rgba(233,233,230,${a})`;
        cx.beginPath(); cx.moveTo(X(LG0), Y(LG0 + d)); cx.lineTo(X(LG0), Y(LG1)); cx.lineTo(X(LG1 - d), Y(LG1)); cx.closePath(); cx.fill();
        cx.beginPath(); cx.moveTo(X(LG0 + d), Y(LG0)); cx.lineTo(X(LG1), Y(LG0)); cx.lineTo(X(LG1), Y(LG1 - d)); cx.closePath(); cx.fill();
      };
      zone(Math.log(4.5), 0.045); zone(Math.log(7), 0.05);
      cx.strokeStyle = VF; cx.lineWidth = 1; cx.strokeRect(x0, y0, side, side);
      [0, 0.02, 0.05, 0.1, 0.2, 0.4, 0.7, 1].forEach(v => {
        const u = lgY(v);
        seg(cx, X(u), y0 + side, X(u), y0 + side + 4, VD); seg(cx, x0 - 4, Y(u), x0, Y(u), VD);
        if (v !== 0.02 && v !== 0.7) { vt(cx, String(v), X(u), y0 + side + 14, { c: VD, s: 9, a: 'center' }); vt(cx, String(v), x0 - 6, Y(u) + 3, { c: VD, s: 9, a: 'right' }); }
      });
      [[1, '1:1'], [3, '3:1'], [4.5, '4.5 AA'], [7, '7 AAA']].forEach(([r, l]) => {
        const d = Math.log(r), st = r === 1 ? VD : 'rgba(233,233,230,.32)', dash = r === 1 ? [] : [3, 4];
        seg(cx, X(LG0), Y(LG0 + d), X(LG1 - d), Y(LG1), st, 1, dash);
        if (r > 1) seg(cx, X(LG0 + d), Y(LG0), X(LG1), Y(LG1 - d), st, 1, dash);
        if (side > 160) vt(cx, l, X(LG1 - d) - 3, Y(LG1) + 11, { c: VD, s: 9, a: 'right' });
      });
      vt(cx, 'Y background →', x0 + side, y0 + side + 27, { c: VD, s: 9, a: 'right' });
      cx.save(); cx.translate(x0 - 36, y0 + side); cx.rotate(-Math.PI / 2); vt(cx, 'Y text →', 0, 0, { c: VD, s: 9 }); cx.restore();
      const q = prog(t, 0.3, 2.6), dS = q * span;
      if (q < 1) {
        const st = 'rgba(233,233,230,.85)';
        seg(cx, X(LG0), Y(LG0 + dS), X(LG1 - dS), Y(LG1), st, 1.2); seg(cx, X(LG0 + dS), Y(LG0), X(LG1), Y(LG1 - dS), st, 1.2);
        vt(cx, `${Math.exp(dS).toFixed(1)}:1`, X(LG0 + dS) + 4, Y(LG0) - 6, { w: 700 });
      }
      let pass = 0, tot = 0;
      P.forEach((bg, i) => P.forEach((tx, j) => {
        if (i === j) return;
        const a = lgY(lum(bg.rgb)), b = lgY(lum(tx.rgb)), d = Math.abs(a - b), ok = Math.exp(d) >= 4.5;
        tot++; if (ok) pass++;
        if (q < 1 && d > dS) return;
        const pop = q < 1 ? clamp((dS - d) / 0.2, 0, 1) : 1, r = 5.5 * (0.5 + 0.5 * ease(pop));
        cx.globalAlpha = ok ? 1 : 0.38;
        dot(cx, X(a), Y(b), r, bg.hex, ok ? 'rgba(255,255,255,.85)' : null);
        dot(cx, X(a), Y(b), r * 0.42, tx.hex);
        cx.globalAlpha = 1;
      }));
      if (legend) {
        const lx = x0 + side + 28;
        [['CONTRAST IN LOG SPACE', VI, 700], ['u = ln(Y + 0.05)', VD], ['ratio = e^|u_bg − u_text|', VD], ['', VD], ['iso-ratio lines run', VD], ['parallel to the diagonal', VD], ['shaded = AA, darker = AAA', VD], ['', VD],
          [`${pass} / ${tot} pairs ≥ 4.5:1`, VI, 700], [this.s.mx === 'mix' ? 'set: palette + harmony' : 'set: palette', VD]]
          .forEach(([l, c, wt], k) => vt(cx, l, lx, y0 + 12 + k * 15, { c, w: wt }));
      } else vt(cx, `${pass}/${tot} pairs ≥ 4.5:1`, x0 + side - 6, y0 + side - 8, { w: 700, a: 'right' });
      return q < 1;
    }

    // FIG 05: bisection on HSL lightness until the tone hits the target luminance
    drawBisect(cx, w, h, t) {
      vbg(cx, w, h);
      const B = this.fxB;
      if (!B) return false;
      const [hh, ss, l0] = rgb2hsl(B.rgb), Yb = lum(B.rgb), Yt = targetY(B.rgb, 7 * 1.012), Ylo = targetY(B.rgb, 1.25 * 1.012);
      const Yof = L => lum(hsl2rgb([hh, ss, L]));
      const solve = Y => { const st = []; let lo = 0, hi = 100; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2, y = Yof(m); st.push([lo, hi, m, y]); y < Y ? (lo = m) : (hi = m); } return { st, L: (lo + hi) / 2 }; };
      const hiS = solve(Yt), loS = solve(Ylo), cf = hsl2rgb([hh, ss, hiS.L]), cl = hsl2rgb([hh, ss, loS.L]);
      const nar = w < 640, pl = 44, pr = 14, pt = nar ? 44 : 30, pb = 24, W = w - pl - pr, Hh = h - pt - pb;
      const X = L => pl + (L / 100) * W, Y = y => pt + Hh - ((lgY(y) - LG0) / (LG1 - LG0)) * Hh;
      [0, 25, 50, 75, 100].forEach(v => { seg(cx, X(v), pt, X(v), pt + Hh, 'rgba(233,233,230,.06)'); vt(cx, 'L ' + v, X(v), h - 8, { c: VD, s: 9, a: v ? (v === 100 ? 'right' : 'center') : 'left' }); });
      [0, 0.05, 0.2, 0.5, 1].forEach(v => { seg(cx, pl, Y(v), pl + W, Y(v), 'rgba(233,233,230,.06)'); vt(cx, String(v), pl - 6, Y(v) + 3, { c: VD, s: 9, a: 'right' }); });
      cx.beginPath(); for (let L = 0; L <= 100; L++) (L ? cx.lineTo : cx.moveTo).call(cx, X(L), Y(Yof(L)));
      cx.strokeStyle = 'rgba(233,233,230,.08)'; cx.lineWidth = 9; cx.lineCap = 'round'; cx.stroke();
      for (let L = 0; L < 100; L++) seg(cx, X(L), Y(Yof(L)), X(L + 1), Y(Yof(L + 1)), rgba(hsl2rgb([hh, ss, L + 0.5])), 3);
      cx.lineCap = 'butt';
      const tags = spread([{ y: Y(Yt), l: `Y_t 7:1 = ${Yt.toFixed(3)}`, st: 'rgba(233,233,230,.85)', d: [] }, { y: Y(Ylo), l: `1.25:1 = ${Ylo.toFixed(3)}`, st: 'rgba(233,233,230,.5)', d: [4, 4] }, { y: Y(Yb), l: `Y_b base = ${Yb.toFixed(3)}`, st: 'rgba(233,233,230,.35)', d: [1, 3] }].map(o => ({ ...o, y0: o.y })), 11, pt + Hh);
      tags.forEach(o => { seg(cx, pl, o.y0, pl + W, o.y0, o.st, 1, o.d); vt(cx, o.l, pl + W - 4, o.y - 4, { c: VD, s: 9, a: 'right' }); });
      dot(cx, X(l0), Y(Yb), 6, B.hex, '#fff', 10);
      const sd = 0.55, NS = 12, si = Math.min(Math.floor(t / sd), NS);
      for (let k = 0; k < Math.min(si, NS); k++) seg(cx, X(hiS.st[k][2]), pt + Hh - 6, X(hiS.st[k][2]), pt + Hh, 'rgba(233,233,230,.55)');
      if (si < NS) {
        const [a, b, m, y] = hiS.st[si], f = ease(clamp((t % sd) / (sd * 0.6), 0, 1));
        cx.fillStyle = 'rgba(233,233,230,.07)'; cx.fillRect(X(a), pt, X(b) - X(a), Hh);
        seg(cx, X(a), pt, X(a), pt + Hh, 'rgba(233,233,230,.3)'); seg(cx, X(b), pt, X(b), pt + Hh, 'rgba(233,233,230,.3)');
        const yy = pt + Hh - (pt + Hh - Y(y)) * f;
        seg(cx, X(m), pt + Hh, X(m), yy, VI, 1, [2, 3]);
        if (f > 0.95) dot(cx, X(m), Y(y), 5, rgba(hsl2rgb([hh, ss, m])), '#fff', 10);
        vt(cx, nar ? `step ${si + 1} · Y(${m.toFixed(1)}) ${y < Yt ? '<' : '≥'} Y_t → ${y < Yt ? 'lo' : 'hi'} = m` : `step ${si + 1} · m = ${m.toFixed(2)} · Y(m) = ${y.toFixed(3)} ${y < Yt ? '<' : '≥'} Y_t → ${y < Yt ? 'lo' : 'hi'} = m`, 12, 18, { w: 700 });
        vt(cx, `interval ${(b - a).toFixed(b - a < 1 ? 3 : 1)}`, nar ? 12 : w - 12, nar ? 32 : 18, { c: VD, a: nar ? 'left' : 'right' });
      } else {
        dot(cx, X(hiS.L), Y(Yt), 7.5, rgba(cf), '#fff', 20);
        dot(cx, X(loS.L), Y(Ylo), 5, rgba(cl), 'rgba(255,255,255,.7)', 8);
        vt(cx, `solved · L* = ${hiS.L.toFixed(2)} → ${hex(cf)} · ${contrast(cf, B.rgb).toFixed(2)}:1${nar ? '' : ' on ' + B.hex}`, 12, 18, { w: 700 });
        vt(cx, `24 halvings · 1.25:1 tone ${hex(cl)}`, nar ? 12 : w - 12, nar ? 32 : 18, { c: VD, a: nar ? 'left' : 'right' });
      }
      return t < NS * sd + 0.3;
    }

    // FIG 06: how each language's score is built from its four weighted terms
    drawScore(cx, w, h, t) {
      vbg(cx, w, h);
      const O = this.options;
      if (!O) return false;
      const nar = w < 560, lw = clamp(w * 0.3, 104, 150), x0 = lw + 8, bw = w - x0 - 40, top = nar ? 54 : 40, rh = (h - top - 6) / O.length;
      const AL = [0.95, 0.62, 0.38, 0.2], names = ['text/bg ·50', 'accent/bg ·25', 'label/accent ·15', 'vivid ·10'];
      let lx = 12, ly = 9;
      names.forEach((n, k) => {
        const ww = 13 + n.length * 5.6 + 12;
        if (lx + ww > w - 8) { lx = 12; ly += 14; }
        cx.fillStyle = `rgba(233,233,230,${AL[k]})`; cx.fillRect(lx, ly, 9, 9); vt(cx, n, lx + 13, ly + 8, { c: VD, s: 9 }); lx += ww;
      });
      [0, 25, 50, 75, 100].forEach(v => { const x = x0 + (v / 100) * bw; seg(cx, x, top - 6, x, h - 6, 'rgba(233,233,230,.07)'); vt(cx, String(v), x, top - 9, { c: VD, s: 9, a: 'center' }); });
      O.forEach(({ key, P, v }, i) => {
        const y = top + i * rh, mid = y + rh / 2, bh = Math.min(14, rh * 0.5), q = prog(t, 0.1 + i * 0.09, 1);
        if (key === this.s.opt) { cx.fillStyle = 'rgba(233,233,230,.07)'; cx.fillRect(0, y + 1, w, rh - 2); cx.fillStyle = '#e9e9e6'; cx.fillRect(0, y + 1, 2, rh - 2); }
        vt(cx, `#${i + 1} ${P.label}`, 12, mid + (rh > 26 ? -2 : 3), { w: key === this.s.opt ? 700 : 400 });
        if (rh > 26) ['bg', 'sf', 'tx', 'ac', 'ac2'].forEach((k, j) => { cx.fillStyle = v[k].hex; cx.fillRect(12 + j * 9, mid + 4, 7, 5); });
        const parts = [Math.min(v.rt / 7, 1) * 50, Math.min(v.ra / 3, 1) * 25, Math.min(v.ro / 4.5, 1) * 15, Math.min(v.ac.C / 60, 1) * 10];
        let x = x0;
        parts.forEach((p, k) => { const ww = (p / 100) * bw * q; cx.fillStyle = `rgba(233,233,230,${AL[k]})`; cx.fillRect(x, mid - bh / 2, Math.max(0, ww - 1), bh); x += ww; });
        vt(cx, String(Math.round(v.score * q)), x + 6, mid + 4, { w: 700, s: 11 });
      });
      return t < 0.1 + O.length * 0.09 + 1.1;
    }

    // FIG 07: slopegraph of each colour role's luminance across the three variations
    drawSlope(cx, w, h, t) {
      vbg(cx, w, h);
      const V = this.variants;
      if (!V) return false;
      const roles = [['bg', 'bg'], ['sf', 'surface'], ['tx', 'text'], ['ac', 'accent'], ['ac2', 'accent 2']];
      const pl = w < 520 ? 62 : 110, pr = pl, pt = 46, pb = 16, W = w - pl - pr, Hh = h - pt - pb;
      const X = i => pl + (i * W) / 2, Y = c => pt + Hh - ((lgY(lum(c.rgb)) - LG0) / (LG1 - LG0)) * Hh;
      V.forEach((v, i) => {
        if (i === this.s.variant) { cx.fillStyle = 'rgba(233,233,230,.06)'; cx.fillRect(X(i) - 30, 4, 60, h - 8); }
        seg(cx, X(i), pt - 4, X(i), pt + Hh + 4, VF);
        vt(cx, `${'ABC'[i]} · ${['HIGH', 'BALANCED', 'LOW'][i]}`, X(i), 16, { w: 700, s: 9, a: 'center' });
        vt(cx, `text ${v.rt.toFixed(1)}:1`, X(i), 29, { c: VD, s: 9, a: 'center' });
      });
      const q = prog(t, 0.2, 1.6), s2 = q * 2;
      roles.forEach(([k]) => {
        const p = V.map((v, i) => [X(i), Y(v[k])]);
        cx.beginPath(); cx.moveTo(p[0][0], p[0][1]);
        const e1 = Math.min(s2, 1); cx.lineTo(p[0][0] + (p[1][0] - p[0][0]) * e1, p[0][1] + (p[1][1] - p[0][1]) * e1);
        if (s2 > 1) cx.lineTo(p[1][0] + (p[2][0] - p[1][0]) * (s2 - 1), p[1][1] + (p[2][1] - p[1][1]) * (s2 - 1));
        cx.strokeStyle = 'rgba(233,233,230,.42)'; cx.lineWidth = 1.4; cx.stroke();
      });
      V.forEach((v, i) => {
        cx.globalAlpha = clamp(s2 - i + 1, 0, 1);
        roles.forEach(([k]) => dot(cx, X(i), Y(v[k]), 5.5, v[k].hex, 'rgba(255,255,255,.85)', 8));
        cx.globalAlpha = 1;
      });
      spread(roles.map(([k, l]) => ({ y: Y(V[0][k]) + 3, l })), 11, pt + Hh + 3).forEach(o => vt(cx, o.l, X(0) - 12, o.y, { c: VD, s: 9, a: 'right' }));
      if (s2 >= 2) spread(roles.map(([k, l]) => ({ y: Y(V[2][k]) + 3, l: w < 520 ? V[2][k].hex : `${l} ${V[2][k].hex}` })), 11, pt + Hh + 3).forEach(o => vt(cx, o.l, X(2) + 12, o.y, { c: VD, s: 9 }));
      return q < 1;
    }


    /* ----- outcome sheet: one standalone SVG, rasterised for JPEG / PDF ----- */
    sheetSVG() {
      const s = this.s, P = this.P, Wd = 1500, M = 48, gap = 32, cw = (Wd - 2 * M - 2 * gap) / 3;
      const INKH = '#111111', MUTE = '#6B6B6B', mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', font = P.font.replace(/"/g, "'");
      const T = (x, y, t, o = {}) => `<text x="${x}" y="${y}" fill="${o.c || INKH}" font-family="${o.f || mono}" font-size="${o.s || 12}"${o.w ? ` font-weight="${o.w}"` : ''}${o.ls ? ` letter-spacing="${o.ls}"` : ''}${o.a ? ` text-anchor="${o.a}"` : ''}>${esc(t)}</text>`;
      const lines = (x, y, arr, o = {}) => arr.map((l, i) => T(x, y + i * (o.lh || 17), l, o)).join('');
      const nest = (svg, x, y, w, h) => svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${w}" height="${h}" `);
      const date = new Date().toISOString().slice(0, 10);
      let g = T(M, 62, 'BRAND / PALETTE — FINAL OUTCOMES', { s: 22, w: 700, ls: 1 }) +
        T(M, 88, `${P.label} language · ${HARM[s.harm].label} harmony · k=${this.pal.length} · pattern: ${PATTERNS[s.pattern]} · ${date}`, { c: MUTE, s: 13 });
      // palette strip with shares
      let px = M; const pw = Wd - 2 * M;
      this.pal.forEach(p => { const w = p.share * pw; g += `<rect x="${px}" y="104" width="${w}" height="30" fill="${p.hex}"/>` + (w > 70 ? T(px + 6, 124, p.hex, { s: 11, c: hex(onColor(p.rgb)) }) : ''); px += w; });
      g += `<rect x="${M}" y="104" width="${pw}" height="30" fill="none" stroke="${INKH}"/>`;
      const top = 160; let maxY = 0;
      this.variants.forEach((v, i) => {
        const x = M + i * (cw + gap), ah = cw * 0.6, R = P.r;
        let y = top;
        g += nest(pattern(s.pattern, v, v.mode, 10, 6), x, y, cw, ah);
        y += ah;
        // brand block
        const bh = 250, head = P.tt === 'uppercase' ? 'COLOUR THAT CARRIES THE BRAND.' : 'Colour that carries the brand.';
        g += `<rect x="${x}" y="${y}" width="${cw}" height="${bh}" fill="${v.bg.hex}"/>`;
        const eb = `${String.fromCharCode(65 + i)} · ${v.name}`.toUpperCase();
        g += `<rect x="${x + 20}" y="${y + 22}" width="${eb.length * 7 + 18}" height="20" rx="${Math.min(R, 10)}" fill="${v.ac2.hex}"/>` + T(x + 29, y + 36, eb, { s: 10, c: v.on2, ls: 0.8 });
        g += lines(x + 20, y + 80, wrap(head, P.tt === 'uppercase' ? 20 : 24), { f: font, s: 26, w: P.hw, c: v.tx.hex, lh: 30 });
        g += lines(x + 20, y + 152, wrap(`${P.label} language. ${v.note}.`, 52), { f: font, s: 13, c: v.tx.hex, lh: 18 });
        g += `<rect x="${x + 20}" y="${y + 180}" width="112" height="34" rx="${R}" fill="${v.ac.hex}"/>` + T(x + 76, y + 202, 'Get started', { f: font, s: 13, w: 600, c: v.on, a: 'middle' });
        g += `<rect x="${x + 142}" y="${y + 180}" width="112" height="34" rx="${R}" fill="none" stroke="${v.tx.hex}" stroke-width="1.5"/>` + T(x + 198, y + 202, 'Learn more', { f: font, s: 13, w: 600, c: v.tx.hex, a: 'middle' });
        g += `<rect x="${x + cw - 120}" y="${y + 180}" width="100" height="34" rx="${R}" fill="${v.sf.hex}"/>` + T(x + cw - 70, y + 202, 'surface', { s: 11, c: v.onsf, a: 'middle' });
        y += bh;
        g += `<rect x="${x}" y="${top}" width="${cw}" height="${y - top}" fill="none" stroke="${INKH}"/>`;
        // 60 / 30 / 10
        y += 18;
        const seg = [[0.6, v.bg, v.tx.hex, '60 bg'], [0.3, v.sf, v.onsf, '30 surface'], [0.1, v.ac, v.on, '10']];
        let sx = x; seg.forEach(([f, c, t, l]) => { g += `<rect x="${sx}" y="${y}" width="${cw * f}" height="22" fill="${c.hex}"/>` + T(sx + 5, y + 15, l, { s: 10, c: t }); sx += cw * f; });
        g += `<rect x="${x}" y="${y}" width="${cw}" height="22" fill="none" stroke="${INKH}"/>`;
        y += 34;
        g += nest(ladder([['bg', v.bg], ['surf', v.sf], ['text', v.tx], ['acc', v.ac], ['acc2', v.ac2]], [v.bg, v.tx], INKH), x, y, cw, cw * 74 / 300);
        y += cw * 74 / 300 + 14;
        // roles
        [['background', v.bg], ['surface', v.sf], ['text', v.tx], ['accent', v.ac], ['accent 2', v.ac2]].forEach(([n, c]) => {
          g += `<rect x="${x}" y="${y - 11}" width="14" height="14" fill="${c.hex}" stroke="${INKH}"/>` + T(x + 22, y, n, { s: 12 }) + T(x + cw, y, c.hex, { s: 12, a: 'end' });
          y += 20;
        });
        y += 6;
        [['text / bg', v.rt], ['label / accent', v.ro], ['text / surface', contrast(v.tx.rgb, v.sf.rgb)], ['accent / bg (UI 3:1)', v.ra, true]].forEach(([n, r, ui]) => {
          const l = ui ? (r >= 3 ? 'PASS' : 'FAIL') : rate(r);
          g += `<line x1="${x}" y1="${y + 6}" x2="${x + cw}" y2="${y + 6}" stroke="${INKH}" stroke-dasharray="1 3"/>` + T(x, y, n, { s: 12 }) + T(x + cw, y, `${r.toFixed(2)}:1  ${l}`, { s: 12, a: 'end', c: l === 'FAIL' ? '#C62828' : INKH, w: 700 });
          y += 22;
        });
        y += 10;
        g += lines(x, y, wrap(v.write, 62), { s: 12, c: '#333333', lh: 18 }) ;
        y += wrap(v.write, 62).length * 18;
        if (i === s.variant) g += T(x + cw, top - 10, '✓ selected for export', { s: 11, a: 'end', w: 700 });
        maxY = Math.max(maxY, y);
      });
      const method = `Method — colours extracted with k-means (k-means++ seeding) in CIELAB from a ${this.pix.n.toLocaleString()}-pixel sample. Contrast = (L1 + 0.05) / (L2 + 0.05) using WCAG relative luminance. High-contrast tones are solved by bisecting HSL lightness until luminance hits Y_t = (Y_b + 0.05)·R − 0.05; tonal steps use the same formula with R = 1.2–1.6. ${HARM[s.harm].label} harmony: ${HARM[s.harm].f}. Brand language ranked by text/bg (50) + accent/bg (25) + label/accent (15) + accent vividness (10).`;
      const my = maxY + 30;
      g += `<line x1="${M}" y1="${my}" x2="${Wd - M}" y2="${my}" stroke="${INKH}"/>` + lines(M, my + 26, wrap(method, 190), { s: 12, c: MUTE, lh: 18 });
      const H = Math.ceil(my + 26 + wrap(method, 190).length * 18 + 30);
      return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${H}" viewBox="0 0 ${Wd} ${H}"><rect width="${Wd}" height="${H}" fill="#FFFFFF"/>${g}</svg>`, w: Wd, h: H };
    }

    async exportSheet(fmt) {
      const f = this.$('.flash2'), say = t => { f.textContent = t; clearTimeout(this._f2); this._f2 = setTimeout(() => (f.textContent = ''), 2600); };
      const { svg, w, h } = this.sheetSVG(), name = `brand-outcomes-${this.s.opt}-${this.s.pattern}`;
      if (fmt === 'svg') return this.download(name + '.svg', svg, 'image/svg+xml');
      say('rendering…');
      try {
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        const img = await new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = url; });
        const sc = 2, cv = document.createElement('canvas'); cv.width = w * sc; cv.height = h * sc;
        const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        const jpg = cv.toDataURL('image/jpeg', 0.92);
        if (fmt === 'jpg') { const a = document.createElement('a'); a.href = jpg; a.download = name + '.jpg'; document.body.appendChild(a); a.click(); a.remove(); say('saved'); return; }
        // PDF: jsPDF is loaded from cdnjs only when first needed
        if (!window.jspdf) await new Promise((ok, no) => { const sc2 = document.createElement('script'); sc2.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; sc2.onload = ok; sc2.onerror = no; document.head.appendChild(sc2); });
        const pdf = new window.jspdf.jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'pt', format: [w * 0.75, h * 0.75] });
        pdf.addImage(jpg, 'JPEG', 0, 0, w * 0.75, h * 0.75);
        pdf.save(name + '.pdf');
        say('saved');
      } catch (e) { say(fmt === 'pdf' ? 'PDF library could not load — use .svg or .jpeg' : 'could not render — try .svg'); }
    }

    /* ----- export ----- */
    data() {
      const s = this.s, v = this.variants[s.variant], P = this.P;
      return {
        preset: s.opt, variant: v.name, k: this.pal.length, harmony: s.harm,
        roles: { bg: v.bg.hex, surface: v.sf.hex, text: v.tx.hex, accent: v.ac.hex, accent2: v.ac2.hex, onAccent: v.on, onAccent2: v.on2, onSurface: v.onsf },
        type: { font: P.font, headingWeight: P.hw, tracking: P.tr, transform: P.tt, radius: P.r },
        palette: this.pal.map(p => ({ hex: p.hex, share: +p.share.toFixed(4) })),
        harmonyColors: this.harm.map(h => h.hex),
        contrast: { textOnBg: +v.rt.toFixed(2), accentOnBg: +v.ra.toFixed(2), labelOnAccent: +v.ro.toFixed(2) },
      };
    }
    vars() {
      const d = this.data(), v = [
        ['--brand-bg', d.roles.bg], ['--brand-surface', d.roles.surface], ['--brand-text', d.roles.text],
        ['--brand-accent', d.roles.accent], ['--brand-accent-2', d.roles.accent2], ['--brand-on-accent', d.roles.onAccent],
        ['--brand-on-accent-2', d.roles.onAccent2], ['--brand-on-surface', d.roles.onSurface],
        ['--brand-font', d.type.font], ['--brand-heading-weight', String(d.type.headingWeight)],
        ['--brand-tracking', d.type.tracking], ['--brand-transform', d.type.transform], ['--brand-radius', d.type.radius + 'px'],
      ];
      d.palette.forEach((p, i) => v.push([`--palette-${i + 1}`, p.hex]));
      d.harmonyColors.forEach((h, i) => v.push([`--harmony-${i + 1}`, h]));
      return v;
    }
    css() {
      const d = this.data();
      return `/* brand-palette · ${PRESETS[d.preset].label} · ${d.variant} · k=${d.k} · text/bg ${d.contrast.textOnBg}:1 */\n:root {\n` +
        this.vars().map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n';
    }
    renderExport() {
      this.$('.code').textContent = this.css();
      if (this.s.apply) this.applyToPage();
      this.dispatchEvent(new CustomEvent('palettechange', { detail: this.data(), bubbles: true, composed: true }));
    }
    applyToPage() { const st = document.documentElement.style; this._applied = this.vars().map(([k, v]) => (st.setProperty(k, v), k)); }
    unapply() { (this._applied || []).forEach(k => document.documentElement.style.removeProperty(k)); this._applied = []; }
    flash(t) { const f = this.$('.flash'); f.textContent = t; clearTimeout(this._ft); this._ft = setTimeout(() => (f.textContent = ''), 1600); }
    copy() {
      const txt = this.css();
      (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject())
        .then(() => this.flash('copied'))
        .catch(() => { const r = document.createRange(); r.selectNodeContents(this.$('.code')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); this.flash('selected — press Ctrl/Cmd+C'); });
    }
    download(name, txt, type) {
      const a = document.createElement('a'), url = URL.createObjectURL(new Blob([txt], { type }));
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    disconnectedCallback() { if (this.s.apply) this.unapply(); }
  }

  customElements.define('brand-palette', BrandPalette);

  /* ---------- launcher: a card / button that opens the tool in a modal pop-up ---------- */
  const LCSS = `
:host{display:block;--bpl-bg:#fff;--bpl-fg:#111;--bpl-line:#111;font:14px/1.4 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
:host([variant=button]){display:inline-block}
:host([variant=none]){display:contents}
:host([hidden]){display:none}
*{box-sizing:border-box}
button{font:inherit;color:inherit;cursor:pointer}
.card{display:grid;grid-template-columns:132px 1fr auto;align-items:center;gap:16px;width:100%;max-width:580px;padding:10px 18px 10px 10px;background:var(--bpl-bg);color:var(--bpl-fg);border:1px solid var(--bpl-line);text-align:left;transition:transform .15s,box-shadow .15s}
.card:hover{transform:translate(-2px,-2px);box-shadow:4px 4px 0 var(--bpl-line)}
.card:focus-visible,.pill:focus-visible{outline:2px solid var(--bpl-fg);outline-offset:3px}
.art svg{display:block;width:132px;height:50px}
.txt b{display:block;font-size:16px}
.txt small{display:block;opacity:.7;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;margin-top:3px}
.go{font-size:20px}
.pill{background:var(--bpl-fg);color:var(--bpl-bg);border:0;padding:11px 20px;border-radius:999px;font-weight:600}
.pill:hover{opacity:.88}
dialog{padding:0;border:1px solid #111;width:min(1280px,calc(100vw - 32px));max-width:none;height:calc(100vh - 40px);max-height:none;background:#fff;color:#111;overflow:hidden}
dialog[open]{display:flex;flex-direction:column;animation:bpl-in .18s ease-out}
dialog::backdrop{background:rgba(10,10,10,.62);backdrop-filter:blur(2px)}
@keyframes bpl-in{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){dialog[open]{animation:none}.card{transition:none}}
.bar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:8px 8px 8px 14px;border-bottom:1px solid #111;font:12px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase}
.x{background:none;border:1px solid currentColor;width:34px;height:34px;flex:none}
.x:hover{background:#111;color:#fff}
.body{overflow:auto;flex:1;overscroll-behavior:contain}
@media (prefers-color-scheme:dark){:host(:not([theme=light])) dialog{background:#0f0f0f;color:#ececec;border-color:#ececec}:host(:not([theme=light])) .bar{border-color:#ececec}:host(:not([theme=light])) .x:hover{background:#ececec;color:#0f0f0f}}
:host([theme=dark]) dialog{background:#0f0f0f;color:#ececec;border-color:#ececec}
:host([theme=dark]) .bar{border-color:#ececec}
@media (max-width:640px){
  dialog{width:100vw;height:100dvh;max-height:100dvh;border:0;margin:0}
  .card{grid-template-columns:1fr auto}.art{grid-column:1/-1}.art svg{width:100%;height:56px}
}`;

  class BrandPaletteLauncher extends HTMLElement {
    constructor() {
      super();
      const r = this.attachShadow({ mode: 'open' }), mode = this.getAttribute('variant') || 'card';
      const label = this.getAttribute('label') || 'Brand palette lab';
      const sub = this.getAttribute('sublabel') || 'upload an image → palette, contrast, brand language';
      const v = { bg: col([244, 234, 219]), tx: col([31, 58, 95]), ac: col([217, 100, 58]), ac2: col([233, 180, 76]), sf: col([46, 139, 122]) };
      const trigger = mode === 'none' ? ''
        : mode === 'button' ? `<button class="pill" part="button" aria-haspopup="dialog">${esc(label)} <span aria-hidden="true">↗</span></button>`
        : `<button class="card" part="card" aria-haspopup="dialog"><span class="art">${pattern('rings', v, 'bal', 8, 3)}</span><span class="txt"><b>${esc(label)}</b><small>${esc(sub)}</small></span><span class="go" aria-hidden="true">↗</span></button>`;
      r.innerHTML = `<style>${LCSS}</style>${trigger}<dialog aria-label="${esc(label)}"><div class="bar"><span>${esc(label)}</span><button class="x" aria-label="Close">✕</button></div><div class="body"></div></dialog>`;
      this.dlg = r.querySelector('dialog');
      r.querySelector('.card, .pill')?.addEventListener('click', () => this.open());
      r.querySelector('.x').addEventListener('click', () => this.close());
      this.dlg.addEventListener('click', e => { if (e.target === this.dlg) this.close(); }); // backdrop click
      this.dlg.addEventListener('close', () => { document.documentElement.style.overflow = this._ov || ''; this._trigger?.focus?.(); });
    }
    open() {
      if (this.dlg.open) return;
      if (!this.tool) { // build the tool lazily on first open so the page stays light
        this.tool = document.createElement('brand-palette');
        ['k', 'preset', 'pattern', 'theme', 'src'].forEach(a => this.hasAttribute(a) && this.tool.setAttribute(a, this.getAttribute(a)));
        this.shadowRoot.querySelector('.body').appendChild(this.tool);
      }
      this._trigger = document.activeElement;
      this._ov = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';
      this.dlg.showModal();
      this.shadowRoot.querySelector('.x').focus();
    }
    close() { this.dlg.close(); }
  }
  customElements.define('brand-palette-launcher', BrandPaletteLauncher);

  // Any element with data-open-brand-palette (a link, a nav item, an image) opens the pop-up too.
  const launcher = () => {
    let l = document.querySelector('brand-palette-launcher');
    if (!l) { l = document.createElement('brand-palette-launcher'); l.setAttribute('variant', 'none'); document.body.appendChild(l); }
    return l;
  };
  window.openBrandPalette = () => launcher().open();
  document.addEventListener('click', e => {
    const t = e.target.closest?.('[data-open-brand-palette]');
    if (t) { e.preventDefault(); launcher().open(); }
  });
})();
