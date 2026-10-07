document.addEventListener('DOMContentLoaded', () => {
  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const sheet = document.getElementById('sheet');
  const countEl = document.getElementById('count');
  const emptyEl = document.getElementById('empty');
  const zLevel = document.getElementById('z-level');
  const viewer = document.getElementById('viewer');

  const CAP_H = 34;            // caption line under each photograph
  const GAP = 20;              // space between photographs
  const ROW_GAP = GAP + CAP_H;
  const GROUP_W = 960;         // width of one group in the field
  const GROUP_GAP = 140;
  const GROUP_TOP = 76;        // space for the group heading
  const SHEET_X = 96;          // paper margin left and right of the photographs
  const SHEET_TOP = 150;       // room for the running head
  const SHEET_BOTTOM = 96;     // paper margin below the photographs
  const EDGE = 56;             // table visible around the sheet (crop marks live here)
  const MAX_K = 3;

  const typeOf = Object.fromEntries(TYPES.map(t => [t.key, t]));
  const materialOf = Object.fromEntries(MATERIALS.map(m => [m.key, m]));
  const pad2 = n => String(n).padStart(2, '0');
  const sheetTitles = {
    type: 'Plates, arranged by type',
    material: 'Plates, arranged by material',
    index: 'Index of all plates'
  };

  const state = {
    type: new Set(TYPES.map(t => t.key)),
    material: new Set(MATERIALS.map(m => m.key)),
    arrange: 'type',
    order: [],                 // visible photographs in reading order
    current: null
  };
  const cam = { x: 0, y: 0, k: 1 };
  let bounds = { x0: 0, y0: 0, x1: 1, y1: 1 };   // the sheet plus its margin: the walls
  let minK = 0.1;

  /* ---------- Build photographs ---------- */
  const nodes = REPAIRS.map(r => {
    const el = document.createElement('button');
    el.className = 'node';
    el.setAttribute('aria-label', `${r.id}, ${r.title}`);
    el.innerHTML = `
      <div class="ph"><img src="image/${r.file}" alt="" decoding="async"></div>
      <div class="cap"><span class="id">${r.id}</span><span class="t">${r.title}</span></div>`;

    const node = { r, el, ratio: r.w / r.h, x: 0, y: 0, w: 0, h: 0 };
    el.addEventListener('click', () => { if (!moved) open(node); });
    el.addEventListener('pointerenter', () => {
      if (pointers.size) return;
      el.classList.add('hover');
      world.classList.add('hovering');
    });
    el.addEventListener('pointerleave', () => {
      el.classList.remove('hover');
      world.classList.remove('hovering');
    });
    world.appendChild(el);
    return node;
  });

  /* ---------- Filters ---------- */
  const buildFilter = (boxId, list, key) => {
    const box = document.getElementById(boxId);
    list.forEach(item => {
      const n = REPAIRS.filter(r => r[key] === item.key).length;
      const b = document.createElement('button');
      b.className = 'opt';
      b.setAttribute('aria-pressed', 'true');
      b.innerHTML = `${item.label}<span class="n">${pad2(n)}</span>`;
      b.addEventListener('click', () => {
        const set = state[key];
        set.has(item.key) ? set.delete(item.key) : set.add(item.key);
        b.setAttribute('aria-pressed', set.has(item.key));
        layout(true);
      });
      box.appendChild(b);
    });
  };
  buildFilter('f-type', TYPES, 'type');
  buildFilter('f-material', MATERIALS, 'material');

  document.querySelectorAll('[data-arrange]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-arrange]').forEach(o => o.setAttribute('aria-pressed', o === b));
    state.arrange = b.dataset.arrange;
    layout(true);
  }));

  /* ---------- Layout ---------- */
  const isOn = r => state.type.has(r.type) && state.material.has(r.material);

  // Pack photographs into rows of equal height that fill `width` exactly.
  // The last row keeps the target height instead of stretching.
  function justify(list, width, rowH, ox, oy) {
    let y = oy, row = [];
    const flush = last => {
      const natural = row.reduce((s, n) => s + n.ratio * rowH, 0);
      const free = width - GAP * (row.length - 1);
      const h = last ? Math.min(rowH, rowH * free / natural) : rowH * free / natural;
      let x = ox;
      row.forEach(n => {
        n.w = n.ratio * h; n.h = h; n.x = x; n.y = y;
        x += n.w + GAP;
      });
      y += h + ROW_GAP;
      row = [];
    };
    list.forEach(n => {
      row.push(n);
      const w = row.reduce((s, m) => s + m.ratio * rowH, 0) + GAP * (row.length - 1);
      if (w >= width) flush(false);
    });
    if (row.length) flush(true);
    return y - ROW_GAP;        // bottom edge
  }

  function layout(fit) {
    world.querySelectorAll('.zone').forEach(z => z.remove());
    const visible = nodes.filter(n => isOn(n.r)).sort((a, b) => a.r.id.localeCompare(b.r.id));
    let bw = 0, bh = 0;
    state.order = [];

    if (state.arrange === 'index') {
      const width = Math.max(320, stage.clientWidth - 2 * (SHEET_X + EDGE));
      const rowH = stage.clientWidth < 760 ? 150 : 250;
      bh = justify(visible, width, rowH, 0, 0);
      bw = width;
      state.order = visible;
    } else {
      const key = state.arrange;
      const groups = key === 'type' ? TYPES : MATERIALS;
      const filled = groups
        .map(g => ({ g, members: visible.filter(n => n.r[key] === g.key) }))
        .filter(x => x.members.length);
      // Groups sit in a grid: two across on wide screens, one on phones
      const cols = stage.clientWidth < 760 ? 1 : Math.min(2, filled.length);
      let oy = 0, rowBottom = 0;
      filled.forEach(({ g, members }, i) => {
        const col = i % cols;
        if (col === 0 && i > 0) { oy = rowBottom + GROUP_GAP; rowBottom = 0; }
        const ox = col * (GROUP_W + GROUP_GAP);
        const bottom = justify(members, GROUP_W, 300, ox, oy + GROUP_TOP);

        const zone = document.createElement('div');
        zone.className = 'zone';
        zone.style.width = `${GROUP_W}px`;
        zone.style.transform = `translate(${ox}px, ${oy}px)`;
        zone.innerHTML = `<span class="name">${g.label}</span><span class="num">${pad2(members.length)} plates</span>`;
        sheet.after(zone);

        rowBottom = Math.max(rowBottom, bottom);
        bh = Math.max(bh, bottom);
        bw = Math.max(bw, ox + GROUP_W);
        state.order.push(...members);
      });
    }

    let i = 0;
    nodes.forEach(n => {
      const on = isOn(n.r);
      n.el.classList.toggle('off', !on);
      n.el.tabIndex = on ? 0 : -1;
      if (!on) return;
      n.el.style.transitionDelay = `${Math.min(i++ * 18, 300)}ms`;
      n.el.style.width = `${n.w}px`;
      n.el.querySelector('.ph').style.height = `${n.h}px`;
      n.el.style.transform = `translate(${n.x}px, ${n.y}px)`;
    });

    // The sheet wraps whatever is on it; its edge is the wall
    if (!visible.length) { bw = GROUP_W; bh = 300; }
    const sw = bw + 2 * SHEET_X, sh = bh + SHEET_TOP + SHEET_BOTTOM;
    sheet.style.width = `${sw}px`;
    sheet.style.height = `${sh}px`;
    sheet.style.transform = `translate(${-SHEET_X}px, ${-SHEET_TOP}px)`;
    bounds = { x0: -SHEET_X - EDGE, y0: -SHEET_TOP - EDGE, x1: bw + SHEET_X + EDGE, y1: bh + SHEET_BOTTOM + EDGE };

    document.getElementById('sheet-title').textContent = sheetTitles[state.arrange];
    document.getElementById('sheet-count').textContent = `${pad2(visible.length)} photographs`;
    countEl.textContent = `${pad2(visible.length)} of ${pad2(REPAIRS.length)} photographs`;
    emptyEl.hidden = visible.length > 0;

    if (state.current && !isOn(state.current.r)) close();
    if (fit) fitTo(true);
  }

  /* ---------- Camera ---------- */
  // How far the camera may travel at zoom k before the sheet would leave the screen.
  // If the sheet is smaller than the screen on an axis, it stays centred on that axis.
  function range(k) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const axis = (lo, hi, size) => {
      const len = (hi - lo) * k;
      if (len <= size) { const c = (size - len) / 2 - lo * k; return [c, c]; }
      return [size - hi * k, -lo * k];
    };
    const [minX, maxX] = axis(bounds.x0, bounds.x1, W);
    const [minY, maxY] = axis(bounds.y0, bounds.y1, H);
    return { minX, maxX, minY, maxY };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // Past the wall the sheet still follows the finger a little, then springs back
  const rubber = (v, lo, hi) => {
    if (v < lo) return lo - Math.pow(lo - v, 0.7);
    if (v > hi) return hi + Math.pow(v - hi, 0.7);
    return v;
  };

  function applyCam(mode) {
    world.classList.toggle('glide', mode === 'glide');
    world.classList.toggle('settle', mode === 'settle');
    world.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.k})`;
    zLevel.textContent = `${Math.round(cam.k * 100)}%`;
  }

  function hardClamp() {
    const r = range(cam.k);
    cam.x = clamp(cam.x, r.minX, r.maxX);
    cam.y = clamp(cam.y, r.minY, r.maxY);
  }

  function fitTo(glide) {
    const W = stage.clientWidth, H = stage.clientHeight;
    const bw = bounds.x1 - bounds.x0, bh = bounds.y1 - bounds.y0;
    if (state.arrange === 'index') {
      cam.k = Math.min(1, W / bw);
      minK = cam.k;
      cam.x = (W - bw * cam.k) / 2 - bounds.x0 * cam.k;
      cam.y = -bounds.y0 * cam.k;
    } else {
      cam.k = Math.min(1, W / bw, H / bh);
      minK = cam.k;
      cam.x = (W - bw * cam.k) / 2 - bounds.x0 * cam.k;
      cam.y = (H - bh * cam.k) / 2 - bounds.y0 * cam.k;
    }
    hardClamp();
    applyCam(glide ? 'glide' : null);
  }

  function zoomAt(px, py, factor, glide) {
    const k = clamp(cam.k * factor, minK, MAX_K);
    cam.x = px - (px - cam.x) * (k / cam.k);
    cam.y = py - (py - cam.y) * (k / cam.k);
    cam.k = k;
    hardClamp();
    applyCam(glide ? 'glide' : null);
  }

  const center = () => [stage.clientWidth / 2, stage.clientHeight / 2];
  document.getElementById('z-in').addEventListener('click', () => zoomAt(...center(), 1.3, true));
  document.getElementById('z-out').addEventListener('click', () => zoomAt(...center(), 1 / 1.3, true));
  document.getElementById('z-reset').addEventListener('click', () => layout(true));

  stage.addEventListener('wheel', e => {
    e.preventDefault();
    const r = stage.getBoundingClientRect();
    if (e.ctrlKey || e.metaKey) {
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
    } else {
      cam.x -= e.deltaX;
      cam.y -= e.deltaY;
      hardClamp();
      applyCam();
    }
  }, { passive: false });

  // Drag to move, two fingers to pinch
  const pointers = new Map();
  let moved = false;
  let pinch = null;
  let raw = null;              // where the drag would put the camera without walls

  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('.zoom')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = false;
    pinch = null;
    raw = { x: cam.x, y: cam.y };
  });

  stage.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      if (!moved && Math.hypot(dx, dy) < 2) return;
      if (!moved) {
        moved = true;
        stage.setPointerCapture(e.pointerId);
        stage.classList.add('dragging');
        world.classList.remove('hovering');
      }
      raw.x += dx; raw.y += dy;
      const r = range(cam.k);
      cam.x = rubber(raw.x, r.minX, r.maxX);
      cam.y = rubber(raw.y, r.minY, r.maxY);
      applyCam();
    } else if (pointers.size === 2) {
      moved = true;
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const r = stage.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top;
      if (pinch) {
        cam.x += mx - pinch.mx; cam.y += my - pinch.my;
        zoomAt(mx, my, dist / pinch.dist);
        raw = { x: cam.x, y: cam.y };
      }
      pinch = { dist, mx, my };
    }
  });

  const release = e => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) {
      stage.classList.remove('dragging');
      if (moved) { hardClamp(); applyCam('settle'); }
    }
  };
  stage.addEventListener('pointerup', release);
  stage.addEventListener('pointercancel', release);

  /* ---------- Viewer ---------- */
  function open(node) {
    state.current = node;
    const r = node.r;
    const pos = state.order.indexOf(node) + 1;

    const img = new Image();
    img.src = `image/${r.file}`;
    img.alt = r.title;
    document.getElementById('v-fig').replaceChildren(img);

    document.getElementById('v-pos').textContent = `Plate ${pad2(pos)} of ${pad2(state.order.length)}`;
    document.getElementById('v-id').textContent = r.id;
    document.getElementById('v-title').textContent = r.title;

    const rows = [
      ['Type', typeOf[r.type].label],
      ['Material', materialOf[r.material].label],
      ['Location', r.place],
      ['Date', r.date],
      ['Format', `${r.w} × ${r.h} px`]
    ].filter(([, v]) => v);
    document.getElementById('v-meta').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

    const note = document.getElementById('v-note');
    note.textContent = r.note;
    note.hidden = !r.note;

    const body = document.getElementById('v-body');
    body.classList.remove('play');
    void body.offsetWidth;
    body.classList.add('play');

    viewer.hidden = false;
    document.getElementById('v-close').focus({ preventScroll: true });
  }

  function close() {
    viewer.hidden = true;
    if (state.current) state.current.el.focus({ preventScroll: true });
    state.current = null;
  }

  const step = d => {
    if (!state.current || !state.order.length) return;
    const i = state.order.indexOf(state.current);
    open(state.order[(i + d + state.order.length) % state.order.length]);
  };
  document.getElementById('v-prev').addEventListener('click', () => step(-1));
  document.getElementById('v-next').addEventListener('click', () => step(1));
  document.getElementById('v-close').addEventListener('click', close);
  viewer.addEventListener('click', e => { if (e.target.id === 'v-fig') close(); });

  document.addEventListener('keydown', e => {
    if (state.current) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      return;
    }
    if (e.metaKey || e.ctrlKey) return;
    if (e.key === '+' || e.key === '=') zoomAt(...center(), 1.3, true);
    else if (e.key === '-') zoomAt(...center(), 1 / 1.3, true);
    else if (e.key === '0') layout(true);
  });

  let resizeT;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => layout(true), 150);
  });

  layout(true);
});
