document.addEventListener('DOMContentLoaded', async () => {
  // Visitor photographs that have been approved join the archive (CR-01, CR-02 ...)
  REPAIRS.push(...await Community.approvedPhotos());
  const srcOf = r => r.src || `image/${r.file}`;
  // Archive photographs first, then visitor photographs, each in number order
  const byOrder = (a, b) => (a.r.community ? 1 : 0) - (b.r.community ? 1 : 0) || a.r.id.localeCompare(b.r.id);

  // Title: each letter turns white on a dark patch when touched, then fades back
  const title = document.getElementById('title');
  title.innerHTML = '<span aria-hidden="true">' + [...title.textContent]
    .map(ch => ch === ' ' ? ' ' : `<span class="ch">${ch}</span>`).join('') + '</span>';

  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const sheet = document.getElementById('sheet');
  const countEl = document.getElementById('count');
  const emptyEl = document.getElementById('empty');
  const zLevel = document.getElementById('z-level');
  const viewer = document.getElementById('viewer');

  const CAP_H = 46;            // caption line under each photograph
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
      <div class="ph"><img src="${srcOf(r)}" alt="" decoding="async"></div>
      <div class="cap"><span class="t">${r.id}</span><span class="id">${materialOf[r.material].label}</span></div>`;

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
      if (!n) return;            // e.g. no unsorted photographs right now
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

  // View all: every filter back on and the whole sheet in view
  document.getElementById('view-all').addEventListener('click', () => {
    state.type = new Set(TYPES.map(t => t.key));
    state.material = new Set(MATERIALS.map(m => m.key));
    document.querySelectorAll('#f-type .opt, #f-material .opt').forEach(b => b.setAttribute('aria-pressed', 'true'));
    if (state.current) close();
    layout(true);
  });

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

  const contentW = () => stage.clientWidth < 760 ? GROUP_W : 2 * GROUP_W + GROUP_GAP;
  const sortedAll = () => [...nodes].sort(byOrder);

  // Work out where each visible photograph goes for one arrangement.
  // Only sets numbers on the nodes; nothing is drawn here.
  function placeGroups(arrange, visible, rowH) {
    const zones = [], order = [];
    let bh = 0;
    const groups = arrange === 'type' ? TYPES : MATERIALS;
    const filled = groups
      .map(g => ({ g, members: visible.filter(n => n.r[arrange] === g.key) }))
      .filter(x => x.members.length);
    // Groups sit in a grid: two across on wide screens, one on phones
    const cols = stage.clientWidth < 760 ? 1 : 2;
    let oy = 0, rowBottom = 0;
    filled.forEach(({ g, members }, i) => {
      const col = i % cols;
      if (col === 0 && i > 0) { oy = rowBottom + GROUP_GAP; rowBottom = 0; }
      const ox = col * (GROUP_W + GROUP_GAP);
      const bottom = justify(members, GROUP_W, rowH, ox, oy + GROUP_TOP);
      zones.push({ g, count: members.length, ox, oy });
      rowBottom = Math.max(rowBottom, bottom);
      bh = Math.max(bh, bottom);
      order.push(...members);
    });
    return { bh, zones, order };
  }

  function place(arrange, visible) {
    const { bw, bh, indexRowH } = sheetSize();
    if (arrange === 'index') {
      justify(visible, bw, indexRowH, 0, 0);
      return { zones: [], order: visible };
    }
    // Grouped views use the largest photographs that still fit inside the sheet
    let rowH = 420, result = placeGroups(arrange, visible, rowH);
    while (result.bh > bh && rowH > 40) {
      rowH *= 0.94;
      result = placeGroups(arrange, visible, rowH);
    }
    return result;
  }

  // The sheet takes the size of the Index view of every photograph, with the
  // row height chosen so the sheet has the same shape as the screen and fills
  // it. Every other view and filter then works inside that one fixed sheet.
  let sheetFor = null;
  function sheetSize() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const key = `${W}x${H}`;
    if (sheetFor && sheetFor.key === key) return sheetFor;
    const bw = contentW();
    const target = H / W;
    const all = sortedAll();
    let best = null;
    for (let rowH = 100; rowH <= 520; rowH += 10) {
      const bh = justify(all, bw, rowH, 0, 0);
      const ratio = (bh + SHEET_TOP + SHEET_BOTTOM + 2 * EDGE) / (bw + 2 * SHEET_X + 2 * EDGE);
      const miss = Math.abs(ratio - target);
      if (!best || miss < best.miss) best = { miss, rowH, bh };
    }
    sheetFor = { key, bw, bh: best.bh, indexRowH: best.rowH };
    return sheetFor;
  }

  function layout(fit) {
    // Map view: the same filtered photographs, pinned on Manhattan
    const onMap = state.arrange === 'map';
    stage.hidden = onMap;
    if (onMap) {
      const shown = nodes.filter(n => isOn(n.r)).sort(byOrder);
      state.order = shown;
      if (state.current && !isOn(state.current.r)) close();
      MapView.show(shown.map(n => n.r), srcOf, id => {
        const node = nodes.find(n => n.r.id === id);
        if (node) open(node);
      }).then(pinned => {
        if (pinned === undefined) return;
        document.getElementById('map-count').textContent = `${pad2(pinned)} of ${pad2(shown.length)} located`;
      });
      return;
    }
    MapView.hide();

    world.querySelectorAll('.zone').forEach(z => z.remove());
    const { bw, bh } = sheetSize();
    const visible = nodes.filter(n => isOn(n.r)).sort(byOrder);
    const result = place(state.arrange, visible);
    state.order = result.order;

    result.zones.forEach(({ g, count, ox, oy }) => {
      const zone = document.createElement('div');
      zone.className = 'zone';
      zone.style.width = `${GROUP_W}px`;
      zone.style.transform = `translate(${ox}px, ${oy}px)`;
      zone.innerHTML = `<span class="name">${g.label}</span><span class="num">${pad2(count)}</span>`;
      sheet.after(zone);
    });

    let i = 0;
    nodes.forEach(n => {
      const on = isOn(n.r);
      n.el.classList.toggle('off', !on);
      n.el.tabIndex = on ? 0 : -1;
      if (!on) return;
      n.el.style.transitionDelay = `${Math.min(i++ * 14, 300)}ms`;
      n.el.style.width = `${n.w}px`;
      n.el.querySelector('.ph').style.height = `${n.h}px`;
      n.el.style.transform = `translate(${n.x}px, ${n.y}px)`;
    });

    // Fixed sheet; its edge is the wall
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
    // the whole sheet, as large as the screen allows
    cam.k = Math.min(W / bw, H / bh);
    minK = cam.k;
    cam.x = (W - bw * cam.k) / 2 - bounds.x0 * cam.k;
    cam.y = (H - bh * cam.k) / 2 - bounds.y0 * cam.k;
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
  // Loupe: a round magnifier that follows the pointer over the photograph,
  // for reading the texture of a surface the way you would with a print
  const ZOOM = 3;
  const LENS = 190;
  const lens = document.createElement('div');
  lens.className = 'loupe';
  lens.setAttribute('aria-hidden', 'true');
  const lensHint = document.createElement('p');
  lensHint.className = 'loupe-hint';
  lensHint.textContent = matchMedia('(hover: hover)').matches
    ? 'Move over the photograph to look closer · ×3'
    : 'Press and drag on the photograph to look closer · ×3';

  function attachLoupe(img) {
    const fig = img.parentElement;
    lens.hidden = true;
    lens.style.backgroundImage = `url("${img.src.replace(/"/g, '%22')}")`;

    const move = e => {
      const box = img.getBoundingClientRect();
      const x = e.clientX - box.left, y = e.clientY - box.top;
      if (x < 0 || y < 0 || x > box.width || y > box.height) { lens.hidden = true; return; }
      const figBox = fig.getBoundingClientRect();
      lens.hidden = false;
      lens.style.width = lens.style.height = `${LENS}px`;
      lens.style.left = `${e.clientX - figBox.left - LENS / 2}px`;
      lens.style.top = `${e.clientY - figBox.top - LENS / 2}px`;
      lens.style.backgroundSize = `${box.width * ZOOM}px ${box.height * ZOOM}px`;
      lens.style.backgroundPosition = `${-(x * ZOOM - LENS / 2)}px ${-(y * ZOOM - LENS / 2)}px`;
    };
    const hide = () => { lens.hidden = true; };

    img.addEventListener('pointermove', move);
    img.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') { img.setPointerCapture(e.pointerId); move(e); } });
    img.addEventListener('pointerleave', hide);
    img.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') hide(); });
    img.addEventListener('pointercancel', hide);
  }

  function open(node) {
    state.current = node;
    const r = node.r;
    const pos = state.order.indexOf(node) + 1;

    const img = new Image();
    img.src = srcOf(r);
    img.alt = r.title;
    document.getElementById('v-fig').replaceChildren(img, lens, lensHint);
    attachLoupe(img);

    document.getElementById('v-pos').textContent = `Plate ${pad2(pos)} of ${pad2(state.order.length)}`;
    document.getElementById('v-id').textContent = r.id;
    document.getElementById('v-title').textContent = r.title;

    const rows = [
      ['Type', typeOf[r.type].label],
      ['Material', materialOf[r.material].label],
      ['Location', r.place],
      ['Date', r.date],
      ['Found by', r.by],
      ['Format', `${r.w} × ${r.h} px`]
    ].filter(([, v]) => v);
    // textContent, never innerHTML: visitor photographs carry visitor text
    document.getElementById('v-meta').replaceChildren(...rows.flatMap(([k, v]) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      return [dt, dd];
    }));
    // a passage from the book that speaks to this photograph
    const quote = typeof EXCERPTS !== 'undefined' && EXCERPTS[r.excerpt];
    document.getElementById('v-quote').hidden = !quote;
    if (quote) {
      document.getElementById('v-quote-text').textContent = quote.text;
      document.getElementById('v-quote-theme').textContent = quote.theme;
    }
    Community.showComments(r.id);
    Community.showPhotoVote(r.id);

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
    // typing in a form never moves the archive
    const typing = e.target.closest && e.target.closest('input, textarea, select');
    if (typing && e.key !== 'Escape') return;
    if (!document.getElementById('drawer').hidden) return;
    if (state.current) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === 'ArrowLeft') step(-1);
      return;
    }
    if (e.metaKey || e.ctrlKey || state.arrange === 'map') return;
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
