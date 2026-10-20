/*
  Repair Imperfectly: choose a crack or breach that no one has mended and fix
  it with tape, asphalt, a patch or staples. Each tool is a little unsteady,
  so every repair comes out slightly off, like the ones in the archive.
  Finished repairs can be saved as an image and are listed under
  "Your repairs" in this browser.
*/
document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const pad2 = n => String(n).padStart(2, '0');
  const typeOf = Object.fromEntries(TYPES.map(t => [t.key, t]));
  const materialOf = Object.fromEntries(MATERIALS.map(m => [m.key, m]));

  // Cracks and breaches are the damage still waiting for a repair
  const awaiting = REPAIRS.filter(r => r.type === 'crack' || r.type === 'breach')
    .sort((a, b) => a.id.localeCompare(b.id));

  const canvas = $('canvas');
  const ctx = canvas.getContext('2d');
  const frame = $('bench-frame');

  const state = {
    photo: null, img: null,
    tool: 'tape',
    actions: [],          // every intervention, kept so it can be redrawn or undone
    current: null,
    w: 0, h: 0,
    tone: null            // average colour of the photograph, for patches
  };

  /* ---------- Seeded wobble ---------- */
  const seeded = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const newSeed = () => (Math.random() * 4294967296) >>> 0;

  /* ---------- Awaiting list ---------- */
  $('awaiting-count').textContent = pad2(awaiting.length);
  awaiting.forEach(r => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.dataset.id = r.id;
    const th = document.createElement('span');
    th.className = 'aw-thumb';
    th.style.backgroundImage = `url("image/${r.file}")`;
    const t = document.createElement('span');
    t.className = 'aw-text';
    const id = document.createElement('b'); id.textContent = r.id;
    const meta = document.createElement('span');
    meta.textContent = `${typeOf[r.type].label} · ${materialOf[r.material].label}`;
    t.append(id, meta);
    b.append(th, t);
    b.addEventListener('click', () => choose(r));
    li.appendChild(b);
    $('awaiting-list').appendChild(li);
  });

  /* ---------- Choosing a photograph ---------- */
  function choose(r) {
    if (state.actions.length && state.photo && state.photo.id !== r.id) {
      const ok = $('bench-msg');
      ok.hidden = false;
      ok.textContent = 'Starting a new repair. The last one was left as it was.';
      setTimeout(() => { ok.hidden = true; }, 2600);
    }
    state.photo = r;
    state.actions = [];
    state.tone = null;
    document.querySelectorAll('#awaiting-list button').forEach(b => b.classList.toggle('is-active', b.dataset.id === r.id));
    $('bench-id').textContent = `${r.id} · ${typeOf[r.type].label} · ${materialOf[r.material].label}`;
    $('bench-caption').textContent = r.title;
    showFinished(false);

    const img = new Image();
    img.onload = () => { state.img = img; fit(); sampleTone(); draw(); };
    img.src = `image/${r.file}`;
  }

  // Average colour of the photograph, used to tint patches a shade off.
  // Fails quietly when the page is opened from a local file.
  function sampleTone() {
    try {
      const c = document.createElement('canvas');
      c.width = c.height = 24;
      const x = c.getContext('2d');
      x.drawImage(state.img, 0, 0, 24, 24);
      const d = x.getImageData(0, 0, 24, 24).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4;
      state.tone = [r / n, g / n, b / n];
    } catch { state.tone = [138, 134, 126]; }
  }

  /* ---------- Canvas size ---------- */
  function fit() {
    if (!state.img) return;
    const pad = 28;
    const maxW = frame.clientWidth - pad, maxH = frame.clientHeight - pad;
    const ratio = state.img.naturalWidth / state.img.naturalHeight;
    let w = maxW, h = w / ratio;
    if (h > maxH) { h = maxH; w = h * ratio; }
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = `${Math.round(w)}px`;
    canvas.style.height = `${Math.round(h)}px`;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    state.w = w; state.h = h;
  }
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { fit(); draw(); }, 120); });

  /* ---------- Drawing the interventions ---------- */
  // Points are stored as fractions of the photograph so a resize keeps them in place
  const P = ([fx, fy]) => [fx * state.w, fy * state.h];
  const unit = () => state.w / 600;

  function tape(a) {
    const rng = seeded(a.seed);
    let [x0, y0] = P(a.pts[0]);
    let [x1, y1] = P(a.pts[a.pts.length - 1]);
    if (Math.hypot(x1 - x0, y1 - y0) < 8) {            // a click lays a short strip
      const ang = rng() * Math.PI;
      x1 = x0 + Math.cos(ang) * 70 * unit(); y1 = y0 + Math.sin(ang) * 70 * unit();
    }
    const ang = Math.atan2(y1 - y0, x1 - x0) + (rng() - 0.5) * 0.12;   // never quite straight
    const len = Math.hypot(x1 - x0, y1 - y0) + (8 + rng() * 10) * unit();
    const wid = (22 + rng() * 6) * unit();
    ctx.save();
    ctx.translate((x0 + x1) / 2 + (rng() - 0.5) * 3 * unit(), (y0 + y1) / 2 + (rng() - 0.5) * 3 * unit());
    ctx.rotate(ang);
    const hw = len / 2, hh = wid / 2;
    const tear = () => (rng() - 0.5) * 5 * unit();
    ctx.beginPath();
    ctx.moveTo(-hw + tear(), -hh);
    ctx.lineTo(hw + tear(), -hh);
    for (let i = 1; i < 6; i++) ctx.lineTo(hw + tear(), -hh + (wid * i) / 6);
    ctx.lineTo(hw + tear(), hh);
    ctx.lineTo(-hw + tear(), hh);
    for (let i = 5; i > 0; i--) ctx.lineTo(-hw + tear(), -hh + (wid * i) / 6);
    ctx.closePath();
    ctx.shadowColor = 'rgba(40, 32, 20, .25)';
    ctx.shadowBlur = 3 * unit();
    ctx.shadowOffsetY = 1 * unit();
    ctx.fillStyle = 'rgba(233, 222, 192, .82)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // a crease where the tape didn't lie flat
    ctx.strokeStyle = 'rgba(255, 255, 255, .35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const cx = (rng() - 0.5) * hw;
    ctx.moveTo(cx - wid * 0.2, -hh + 2); ctx.lineTo(cx + wid * 0.25, hh - 2);
    ctx.stroke();
    ctx.restore();
  }

  function trace(pts) {
    ctx.beginPath();
    pts.map(P).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  }

  // Asphalt is poured, not drawn: holding the pointer down lets a heavy pool
  // collect and spread; moving slowly drags the pool along. Each pool is an
  // irregular blob; they merge into one glossy, slightly raised mass.
  function blob(x, y, r, rng) {
    const n = 18;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2;
      const k = 0.82 + rng() * 0.3;
      pts.push([x + Math.cos(t) * r * k, y + Math.sin(t) * r * k * 0.92]);
    }
    ctx.moveTo(...pts[0]);
    for (let i = 0; i < n; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % n];
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    ctx.closePath();
  }

  function asphalt(a) {
    const settle = a.settle || 1;
    const drops = a.drops.map(([fx, fy, fr]) => [fx * state.w, fy * state.h, fr * state.w * settle]);
    ctx.save();
    // the mass: one fill so the pools merge
    let rng = seeded(a.seed);
    ctx.beginPath();
    drops.forEach(([x, y, r]) => blob(x, y, r, rng));
    ctx.shadowColor = 'rgba(15, 12, 8, .45)';
    ctx.shadowBlur = 6 * unit();
    ctx.shadowOffsetY = 2.5 * unit();
    ctx.fillStyle = '#1C1B18';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    // a darker lip where it thickens at the edge
    ctx.strokeStyle = 'rgba(0, 0, 0, .55)';
    ctx.lineWidth = 1.4 * unit();
    ctx.stroke();
    // wet gloss on top of each pool
    ctx.clip();
    // only every few pools catch the light, so the mass reads as one pour
    drops.forEach(([x, y, r], i) => {
      if (i % 4 && i !== drops.length - 1) return;
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.38, 0, x - r * 0.3, y - r * 0.38, r * 1.1);
      g.addColorStop(0, 'rgba(255, 255, 255, .16)');
      g.addColorStop(0.5, 'rgba(255, 255, 255, .04)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    });
    // a few grains of aggregate caught in the tar
    rng = seeded(a.seed + 7);
    drops.forEach(([x, y, r]) => {
      for (let i = 0; i < r / (3 * unit()); i++) {
        ctx.fillStyle = `rgba(150, 142, 128, ${0.35 + rng() * 0.3})`;
        const ang = rng() * Math.PI * 2, d = rng() * r * 0.8;
        ctx.fillRect(x + Math.cos(ang) * d, y + Math.sin(ang) * d, 1.3 * unit(), 1.3 * unit());
      }
    });
    ctx.restore();
  }

  function gold(a) {
    if (a.pts.length < 2) return;
    const rng = seeded(a.seed);
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // a thin dark bed under the lacquer
    ctx.strokeStyle = 'rgba(60, 45, 20, .55)';
    ctx.lineWidth = 6.6 * unit();
    trace(a.pts); ctx.stroke();
    const [x0, y0] = P(a.pts[0]), [x1, y1] = P(a.pts[a.pts.length - 1]);
    const g = ctx.createLinearGradient(x0, y0, x1 + 1, y1 + 1);
    g.addColorStop(0, '#B08A3E'); g.addColorStop(0.35, '#E6C878'); g.addColorStop(0.6, '#C49A48'); g.addColorStop(1, '#EED9A0');
    ctx.strokeStyle = g;
    ctx.lineWidth = (4.4 + rng() * 1) * unit();
    trace(a.pts); ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 248, 225, .55)';
    ctx.lineWidth = 0.9 * unit();
    ctx.translate(-0.7 * unit(), -0.9 * unit());
    trace(a.pts); ctx.stroke();
    ctx.restore();
  }

  const MOSS = ['#5E6B3A', '#6F7D44', '#7F8C4F', '#8E9A5C', '#55603A', '#9AA36A'];
  function moss(a) {
    const rng = seeded(a.seed);
    ctx.save();
    a.pts.forEach((p, i) => {
      if (i % 2) return;
      const [x, y] = P(p);
      // a soft damp base, then the cushion of tiny tufts
      ctx.fillStyle = 'rgba(62, 74, 34, .32)';
      ctx.beginPath(); ctx.arc(x, y, (8 + rng() * 5) * unit(), 0, Math.PI * 2); ctx.fill();
      const n = 14 + Math.floor(rng() * 8);
      for (let k = 0; k < n; k++) {
        const ang = rng() * Math.PI * 2, d = rng() * 12 * unit();
        ctx.fillStyle = MOSS[Math.floor(rng() * MOSS.length)];
        ctx.globalAlpha = 0.7 + rng() * 0.3;
        ctx.beginPath();
        ctx.arc(x + Math.cos(ang) * d, y + Math.sin(ang) * d, (1.6 + rng() * 2.8) * unit(), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    ctx.restore();
  }

  function weeds(a) {
    const rng = seeded(a.seed);
    const grow = a.grow == null ? 1 : a.grow;
    const [x, y] = P(a.pts[0]);
    const size = (34 + rng() * 26) * unit() * grow;
    const kind = Math.floor(rng() * 3);
    const green = () => ['#56653A', '#687A43', '#7A8B4E', '#4D5A33'][Math.floor(rng() * 4)];
    ctx.save();
    ctx.lineCap = 'round';
    const blade = (bx, by, len, lean, w) => {
      ctx.strokeStyle = green();
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + lean * 0.3, by - len * 0.6, bx + lean, by - len);
      ctx.stroke();
    };
    const leaf = (lx, ly, ang, len) => {
      ctx.fillStyle = green();
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(ang);
      ctx.beginPath(); ctx.ellipse(len / 2, 0, len / 2, len / 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    };
    if (kind === 0) {                                      // a tuft of grass
      const n = 6 + Math.floor(rng() * 5);
      for (let i = 0; i < n; i++) blade(x + (rng() - 0.5) * 8 * unit(), y, size * (0.5 + rng() * 0.6), (rng() - 0.5) * size * 0.7, (1.2 + rng()) * unit());
    } else if (kind === 1) {                               // a leafy weed
      blade(x, y, size, (rng() - 0.5) * size * 0.3, 1.6 * unit());
      for (let i = 1; i < 5; i++) {
        const t = i / 5;
        const side = i % 2 ? -1 : 1;
        leaf(x + (rng() - 0.5) * 3, y - size * t, -Math.PI / 2 + side * (0.9 + rng() * 0.4), size * (0.35 - t * 0.12));
      }
    } else {                                               // a small wild flower
      const lean = (rng() - 0.5) * size * 0.35;
      blade(x, y, size, lean, 1.3 * unit());
      leaf(x, y - size * 0.25, -Math.PI / 2 - 0.9, size * 0.3);
      leaf(x, y - size * 0.4, -Math.PI / 2 + 0.9, size * 0.26);
      const fx = x + lean, fy = y - size;
      const petal = rng() < 0.5 ? '#F2EEE2' : '#E8D27A';
      for (let i = 0; i < 5; i++) {
        const ang = (i / 5) * Math.PI * 2 + rng() * 0.3;
        ctx.fillStyle = petal;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(ang) * 3.2 * unit(), fy + Math.sin(ang) * 3.2 * unit(), 3 * unit(), 1.8 * unit(), ang, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#C9A040';
      ctx.beginPath(); ctx.arc(fx, fy, 1.8 * unit(), 0, Math.PI * 2); ctx.fill();
    }
    // a little soil where it came through
    ctx.fillStyle = 'rgba(60, 50, 35, .35)';
    ctx.beginPath(); ctx.ellipse(x, y + 1, 6 * unit() * grow, 2 * unit() * grow, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* Stickers: bedazzled gems, cut with facets that catch the light */
  const STICKERS = {
    crystal: { label: 'Round crystal' },
    heart: { label: 'Heart gem' },
    star: { label: 'Star gem' },
    drop: { label: 'Teardrop gem' },
    pearl: { label: 'Pearl' },
    flower: { label: 'Crystal flower' }
  };

  const mix = (hex, amt) => {                       // lighten (amt > 0) or darken (amt < 0)
    const n = parseInt(hex.slice(1), 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt)));
    return `rgb(${ch[0]}, ${ch[1]}, ${ch[2]})`;
  };

  const shapes = {
    round: (r) => Array.from({ length: 16 }, (_, i) => { const t = (i / 16) * Math.PI * 2; return [Math.cos(t) * r, Math.sin(t) * r]; }),
    heart: (r) => Array.from({ length: 28 }, (_, i) => {
      const t = (i / 28) * Math.PI * 2;
      return [r * 0.062 * 16 * Math.pow(Math.sin(t), 3), -r * 0.062 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) - r * 0.1];
    }),
    star: (r) => Array.from({ length: 10 }, (_, i) => { const t = (i / 10) * Math.PI * 2 - Math.PI / 2; const k = i % 2 ? r * 0.48 : r; return [Math.cos(t) * k, Math.sin(t) * k]; }),
    drop: (r) => Array.from({ length: 24 }, (_, i) => {
      const t = (i / 24) * Math.PI * 2;
      const x = Math.sin(t) * r * 0.72 * (1 - 0.55 * (1 + Math.cos(t)) / 2 * 0.9);
      return [x * (1 + 0.2 * Math.max(0, -Math.cos(t))), -Math.cos(t) * r * 1.05];
    })
  };

  // a faceted stone: triangular facets from the centre, lit from the upper left,
  // a lighter table on top, a dark girdle and a small star of light
  function gem(c, pts, color, setting) {
    const poly = (list) => { c.beginPath(); list.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); };
    if (setting) {                                   // a thin silver claw setting behind the stone
      c.save();
      poly(pts.map(([x, y]) => [x * 1.16, y * 1.16]));
      const g = c.createLinearGradient(-20, -20, 20, 20);
      g.addColorStop(0, '#F4F4F2'); g.addColorStop(0.5, '#A9A9A6'); g.addColorStop(1, '#E2E2DF');
      c.fillStyle = g; c.fill();
      c.restore();
    }
    poly(pts);
    c.fillStyle = color; c.fill();
    c.save();
    c.clip();
    for (let i = 0; i < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const light = (-mx - my) / (Math.hypot(mx, my) || 1);   // facing the upper left
      c.beginPath(); c.moveTo(0, 0); c.lineTo(ax, ay); c.lineTo(bx, by); c.closePath();
      c.fillStyle = mix(color.startsWith('#') ? color : '#CCCCCC', light * 0.45 + (i % 2 ? 0.08 : -0.08));
      c.fill();
    }
    // the table: a smaller, brighter face in the middle
    poly(pts.map(([x, y]) => [x * 0.46 - 1, y * 0.46 - 1]));
    c.fillStyle = mix(color, 0.45);
    c.fill();
    c.restore();
    poly(pts);
    c.strokeStyle = mix(color, -0.45); c.lineWidth = 0.9; c.stroke();
    sparkle(c, -6, -7, 6);
  }

  function sparkle(c, x, y, r) {
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(255, 255, 255, .95)';
    c.beginPath();
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      const k = i % 2 ? r * 0.18 : r;
      c.lineTo(Math.cos(t) * k, Math.sin(t) * k);
    }
    c.closePath(); c.fill();
    c.beginPath(); c.arc(0, 0, r * 0.28, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function pearl(c, r) {
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#FFFFFF'); g.addColorStop(0.45, '#F1ECE3'); g.addColorStop(0.85, '#D8CFC2'); g.addColorStop(1, '#BDB2A3');
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2);
    c.fillStyle = g; c.fill();
    // a faint pink-blue lustre
    const l = c.createLinearGradient(-r, r, r, -r);
    l.addColorStop(0, 'rgba(214, 190, 220, .25)'); l.addColorStop(1, 'rgba(190, 220, 225, .2)');
    c.fillStyle = l; c.fill();
    c.beginPath(); c.ellipse(-r * 0.32, -r * 0.38, r * 0.22, r * 0.14, -0.6, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255, 255, 255, .9)'; c.fill();
  }

  function drawSticker(c, kind, x, y, s, rot) {
    c.save();
    c.translate(x, y);
    c.rotate(rot);
    c.scale(s, s);
    c.shadowColor = 'rgba(30, 24, 16, .35)';
    c.shadowBlur = 3;
    c.shadowOffsetY = 1.5;
    if (kind === 'crystal') gem(c, shapes.round(17), '#D9E0E8', true);
    else if (kind === 'heart') gem(c, shapes.heart(22), '#E7A3B4', false);
    else if (kind === 'star') gem(c, shapes.star(22), '#E5C15E', false);
    else if (kind === 'drop') gem(c, shapes.drop(20), '#8FCBCF', true);
    else if (kind === 'pearl') pearl(c, 15);
    else if (kind === 'flower') {
      const colors = ['#D9E0E8', '#E7A3B4', '#D9E0E8', '#C9B6E0', '#D9E0E8', '#8FCBCF'];
      for (let i = 0; i < 6; i++) {
        const t = (i / 6) * Math.PI * 2;
        c.save(); c.translate(Math.cos(t) * 15, Math.sin(t) * 15); c.scale(0.5, 0.5);
        gem(c, shapes.round(17), colors[i], true);
        c.restore();
      }
      pearl(c, 8);
    }
    c.restore();
  }

  function sticker(a) {
    const rng = seeded(a.seed);
    const [x, y] = P(a.pts[a.pts.length - 1]);
    const pop = a.grow == null ? 1 : 0.85 + 0.15 * a.grow;
    drawSticker(ctx, a.kind, x, y, unit() * (0.55 + rng() * 0.25) * pop, (rng() - 0.5) * 0.7);
  }

  function patch(a) {
    const rng = seeded(a.seed);
    let [x0, y0] = P(a.pts[0]);
    let [x1, y1] = P(a.pts[a.pts.length - 1]);
    const min = 46 * unit();
    if (Math.abs(x1 - x0) < min) x1 = x0 + min * (x1 < x0 ? -1 : 1);
    if (Math.abs(y1 - y0) < min) y1 = y0 + min * (y1 < y0 ? -1 : 1);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const hw = Math.abs(x1 - x0) / 2, hh = Math.abs(y1 - y0) / 2;
    const j = () => (rng() - 0.5) * Math.min(hw, hh) * 0.16;
    // a shade that doesn't quite match the surface around it
    const [r, g, b] = state.tone || [138, 134, 126];
    const shift = (rng() < 0.5 ? -1 : 1) * (18 + rng() * 16);
    const fill = `rgb(${Math.round(r + shift)}, ${Math.round(g + shift)}, ${Math.round(b + shift * 0.8)})`;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rng() - 0.5) * 0.09);
    ctx.beginPath();
    ctx.moveTo(-hw + j(), -hh + j());
    ctx.lineTo(hw + j(), -hh + j());
    ctx.lineTo(hw + j(), hh + j());
    ctx.lineTo(-hw + j(), hh + j());
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < (hw * hh) / (24 * unit()); i++) {           // aggregate
      ctx.fillStyle = rng() < 0.5 ? 'rgba(0, 0, 0, .14)' : 'rgba(255, 255, 255, .16)';
      ctx.fillRect((rng() - 0.5) * hw * 2, (rng() - 0.5) * hh * 2, 1.4 * unit(), 1.4 * unit());
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(25, 22, 18, .45)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }

  function stitch(a) {
    const rng = seeded(a.seed);
    const pts = a.pts.map(P);
    if (pts.length < 2) pts.push([pts[0][0] + 40 * unit(), pts[0][1]]);
    const gap = 16 * unit();
    let carry = gap * 0.5;
    ctx.save();
    ctx.strokeStyle = '#25231F';
    ctx.fillStyle = '#25231F';
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const seg = Math.hypot(bx - ax, by - ay);
      const dir = Math.atan2(by - ay, bx - ax);
      let d = carry;
      while (d < seg) {
        const x = ax + Math.cos(dir) * d, y = ay + Math.sin(dir) * d;
        const across = dir + Math.PI / 2 + (rng() - 0.5) * 0.45;
        const half = (9 + rng() * 5) * unit();
        const x0 = x - Math.cos(across) * half, y0 = y - Math.sin(across) * half;
        const x1 = x + Math.cos(across) * half, y1 = y + Math.sin(across) * half;
        ctx.lineWidth = 2.2 * unit();
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        [[x0, y0], [x1, y1]].forEach(([hx, hy]) => { ctx.beginPath(); ctx.arc(hx, hy, 1.7 * unit(), 0, Math.PI * 2); ctx.fill(); });
        d += gap * (0.7 + rng() * 0.7);                               // uneven spacing
      }
      carry = d - seg;
    }
    ctx.restore();
  }

  const drawers = { tape, asphalt, patch, stitch, gold, moss, weeds, sticker };

  function draw() {
    if (!state.img) return;
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.drawImage(state.img, 0, 0, state.w, state.h);
    state.actions.forEach(a => drawers[a.tool](a));
    if (state.current) drawers[state.current.tool](state.current);
    const n = state.actions.length;
    $('bench-count').textContent = n ? `${pad2(n)} intervention${n === 1 ? '' : 's'}` : 'Untouched';
  }

  /* ---------- Things that move: pouring, settling, growing ---------- */
  const moving = new Set();
  let ticking = false;
  function tick(now) {
    moving.forEach(a => {
      if (a.tool === 'asphalt' && a === state.current) {
        // keep pouring where the pointer rests
        const last = a.drops[a.drops.length - 1];
        const max = 0.06 + (a.seed % 100) / 100 * 0.025;
        last[2] += (max - last[2]) * 0.05;
      } else if (a.tool === 'asphalt') {
        a.settle = Math.min(1.08, (a.settle || 1) + 0.006);
        if (a.settle >= 1.08) moving.delete(a);
      } else {
        a.grow = Math.min(1, (a.grow || 0) + 0.06);
        if (a.grow >= 1) moving.delete(a);
      }
    });
    draw();
    if (moving.size) requestAnimationFrame(tick); else ticking = false;
  }
  const animate = a => {
    if (reduceMotion) { if (a.tool === 'asphalt') a.settle = 1.08; else a.grow = 1; return; }
    moving.add(a);
    if (!ticking) { ticking = true; requestAnimationFrame(tick); }
  };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Pointer ---------- */
  const at = e => {
    const b = canvas.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)), Math.min(1, Math.max(0, (e.clientY - b.top) / b.height))];
  };
  canvas.addEventListener('pointerdown', e => {
    if (!state.img || !$('finished').hidden) return;
    const p = at(e);
    // single clicks: plant a weed or stick a label
    if (state.tool === 'weeds' || state.tool === 'sticker') {
      const a = { tool: state.tool, seed: newSeed(), pts: [p], grow: 0 };
      if (state.tool === 'sticker') a.kind = state.sticker;
      state.actions.push(a);
      animate(a);
      draw();
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    state.current = { tool: state.tool, seed: newSeed(), pts: [p] };
    if (state.tool === 'asphalt') {
      state.current.drops = [[p[0], p[1], 0.024]];
      reduceMotion ? (state.current.drops[0][2] = 0.04) : animate(state.current);
    }
    draw();
  });
  canvas.addEventListener('pointermove', e => {
    if (!state.current) return;
    const p = at(e);
    const cur = state.current;
    if (cur.tool === 'tape' || cur.tool === 'patch') cur.pts[1] = p;
    else if (cur.tool === 'asphalt') {
      // a heavy pour lags behind the hand: a new pool only once you move
      // past the edge of the last one
      const last = cur.drops[cur.drops.length - 1];
      const dist = Math.hypot((p[0] - last[0]) * state.w, (p[1] - last[1]) * state.h);
      const step = last[2] * state.w * 0.55;
      if (dist > step) {
        // fill the gap with thinner pools, so a quick drag leaves a dribble
        const n = Math.min(12, Math.floor(dist / step));
        for (let i = 1; i <= n; i++) {
          const t = i / n;
          cur.drops.push([last[0] + (p[0] - last[0]) * t, last[1] + (p[1] - last[1]) * t, Math.max(0.02, last[2] * (0.85 - 0.2 * t))]);
        }
      }
    } else cur.pts.push(p);
    draw();
  });
  const end = () => {
    if (!state.current) return;
    const a = state.current;
    state.actions.push(a);
    state.current = null;
    if (a.tool === 'asphalt') { moving.delete(a); animate(a); }
    draw();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  /* ---------- Tools ---------- */
  const tools = [...document.querySelectorAll('.tool')];
  const ORDER = tools.map(t => t.dataset.tool);
  const pick = name => {
    state.tool = name;
    tools.forEach(t => t.setAttribute('aria-checked', t.dataset.tool === name));
    canvas.dataset.tool = name;
    $('stickers').hidden = name !== 'sticker';
  };
  tools.forEach(t => t.addEventListener('click', () => pick(t.dataset.tool)));

  // sticker sheet: each choice is drawn with the same code that sticks it on
  state.sticker = 'crystal';
  Object.entries(STICKERS).forEach(([kind, info]) => {
    const b = document.createElement('button');
    b.className = 'sticker-choice';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', info.label);
    b.setAttribute('aria-checked', kind === state.sticker);
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 58 * dpr; c.height = 42 * dpr;
    c.style.width = '58px'; c.style.height = '42px';
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    b.appendChild(c);
    b.addEventListener('click', () => {
      state.sticker = kind;
      document.querySelectorAll('.sticker-choice').forEach(o => o.setAttribute('aria-checked', o === b));
    });
    $('stickers').appendChild(b);
    const paint = () => { x.clearRect(0, 0, 58, 42); drawSticker(x, kind, 29, 21, kind === 'flower' ? 0.68 : 0.82, 0); };
    paint();
  });
  pick('tape');

  $('undo').addEventListener('click', () => { state.actions.pop(); draw(); });
  $('clear').addEventListener('click', () => { state.actions = []; draw(); });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); state.actions.pop(); draw(); }
    const n = +e.key;
    if (n >= 1 && n <= ORDER.length && !e.target.closest('input, textarea')) pick(ORDER[n - 1]);
  });

  /* ---------- Finishing ---------- */
  const today = () => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  function showFinished(on) {
    $('finished').hidden = !on;
    $('finish').hidden = on;
    tools.forEach(t => { t.disabled = on; });
    $('undo').disabled = on;
    $('clear').disabled = on;
    canvas.classList.toggle('is-done', on);
  }

  // The finished repair as a print: the photograph on paper with a caption
  function composite() {
    const scale = 2;
    const pw = state.w * scale, ph = state.h * scale;
    const m = 48 * scale / 2, foot = 64 * scale / 2;
    const out = document.createElement('canvas');
    out.width = pw + m * 2; out.height = ph + m + foot;
    const o = out.getContext('2d');
    o.fillStyle = '#FCFBF7';
    o.fillRect(0, 0, out.width, out.height);
    o.filter = 'saturate(.72) sepia(.1) contrast(.97) brightness(1.02)';   // the archive's shared tone
    o.drawImage(canvas, m, m, pw, ph);
    o.filter = 'none';
    o.fillStyle = '#1D1D1B';
    o.font = `italic ${15 * scale}px Newsreader, Georgia, serif`;
    o.fillText('Repaired imperfectly', m, m + ph + 30 * scale);
    o.fillStyle = '#8B887F';
    o.font = `${8.5 * scale}px "Schibsted Grotesk", Helvetica, Arial, sans-serif`;
    const line = `${state.photo.id} · ${pad2(state.actions.length)} INTERVENTIONS · ${today().toUpperCase()} · IMPERFECT REPAIRS`;
    o.fillText(line.split('').join(String.fromCharCode(8202)), m, m + ph + 48 * scale);
    return out;
  }

  const MINE = 'ir-my-repairs';
  const loadMine = () => { try { return JSON.parse(localStorage.getItem(MINE)) || []; } catch { return []; } };
  function renderMine() {
    const list = loadMine();
    $('mine').hidden = !list.length;
    $('mine-list').replaceChildren(...list.map(m => {
      const li = document.createElement('li');
      const img = new Image();
      img.src = m.thumb;
      img.alt = `Your repair of ${m.id}`;
      const cap = document.createElement('span');
      cap.textContent = `${m.id} · ${m.date}`;
      li.append(img, cap);
      return li;
    }));
  }

  $('finish').addEventListener('click', () => {
    if (!state.img) return;
    if (!state.actions.length) {
      const msg = $('bench-msg');
      msg.hidden = false;
      msg.textContent = 'Make at least one repair first.';
      setTimeout(() => { msg.hidden = true; }, 2200);
      return;
    }
    showFinished(true);
    $('finished-meta').textContent = `${state.photo.id} · ${pad2(state.actions.length)} interventions · ${today()}`;
    try {
      const small = document.createElement('canvas');
      small.width = 240; small.height = Math.round(240 * state.h / state.w);
      small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);
      const list = [{ id: state.photo.id, date: today(), thumb: small.toDataURL('image/jpeg', 0.75) }, ...loadMine()].slice(0, 12);
      localStorage.setItem(MINE, JSON.stringify(list));
      renderMine();
    } catch { /* a local file or full storage: the repair just isn't listed */ }
  });

  $('again').addEventListener('click', () => showFinished(false));

  $('download').addEventListener('click', () => {
    try {
      const url = composite().toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `repaired-imperfectly-${state.photo.id}.png`;
      a.click();
    } catch {
      $('finished-meta').textContent = 'The image can be saved on the published site; this local copy of the page cannot export it.';
    }
  });

  renderMine();
  choose(awaiting[Math.floor(Math.random() * awaiting.length)]);
});
