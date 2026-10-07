document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const pad2 = n => String(n).padStart(2, '0');
  const typeOf = Object.fromEntries(TYPES.map(t => [t.key, t]));
  const materialOf = Object.fromEntries(MATERIALS.map(m => [m.key, m]));
  const byId = Object.fromEntries(REPAIRS.map(r => [r.id, r]));

  const state = { type: 'all', material: 'all', route: '' };

  // Small copy for the grid, original for the viewer. Falls back to the original
  // when no thumbnail has been made yet.
  const thumbSrc = r => `image/thumbs/${r.file.replace(/\.[^.]+$/, '.jpg')}`;
  const fullSrc = r => `image/${r.file}`;
  const thumb = (r, lazy = true) => {
    const img = new Image();
    img.src = thumbSrc(r);
    img.alt = r.title;
    img.width = r.w;
    img.height = r.h;
    img.decoding = 'async';
    if (lazy) img.loading = 'lazy';
    img.onerror = () => { img.onerror = null; img.src = fullSrc(r); };
    return img;
  };

  // Same seed, same arrangement on every visit
  const seeded = str => {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
    return () => ((h = (Math.imul(h, 1664525) + 1013904223) >>> 0) / 4294967296);
  };

  const matches = r =>
    (state.type === 'all' || r.type === state.type) &&
    (state.material === 'all' || r.material === state.material);

  $('foot-count').textContent = `${pad2(REPAIRS.length)} photographs`;

  /* ---------- Archive canvas ---------- */
  const canvas = $('canvas');
  const order = (() => {
    const rand = seeded('imperfect-repairs/order');
    const list = [...REPAIRS];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  })();

  const photos = order.map(r => {
    const el = document.createElement('button');
    el.className = 'photo';
    el.setAttribute('aria-label', `${r.id}, ${typeOf[r.type].label}, ${materialOf[r.material].label}`);
    el.appendChild(thumb(r, false));
    const no = document.createElement('span');
    no.className = 'no';
    no.textContent = r.id;
    el.appendChild(no);
    el.addEventListener('click', () => {
      const list = photos.filter(p => matches(p.r)).map(p => p.r);
      openViewer(list, list.indexOf(r), el);
    });
    canvas.appendChild(el);
    return { r, el };
  });

  // Photographs are placed band by band on the column grid. Each band holds a
  // few photographs at different columns and heights, with at least one empty
  // column between them, so the page reads as placed rather than packed.
  function compose() {
    const W = canvas.clientWidth;
    const cols = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cols'), 10) || 12;
    const wide = cols >= 12;
    const gutter = wide ? Math.min(20, Math.max(12, W * 0.014)) : 12;
    const colW = (W - gutter * (cols - 1)) / cols;
    const rand = seeded(`imperfect-repairs/${cols}`);

    let i = 0, bandTop = 0, bottom = 0;
    while (i < photos.length) {
      const used = new Array(cols).fill(false);
      const perBand = wide ? 5 : (rand() < .5 ? 1 : 2);
      let bandBottom = bandTop;

      for (let k = 0; k < perBand && i < photos.length; k++) {
        const p = photos[i];
        const ratio = p.r.w / p.r.h;
        let span;
        if (wide) span = ratio > 1.1 && rand() < .5 ? 2 : (rand() < .78 ? 1 : 2);
        else span = perBand === 1 ? 3 : 2;

        const gap = wide ? 1 : 0;
        const fits = s => {
          for (let c = s - gap; c < s + span + gap; c++) {
            if (c >= 0 && c < cols && used[c]) return false;
          }
          return s + span <= cols;
        };
        const starts = [];
        for (let s = 0; s <= cols - span; s++) if (fits(s)) starts.push(s);
        if (!starts.length) break;   // band is full; this photograph opens the next one

        const s = starts[Math.floor(rand() * starts.length)];
        for (let c = s; c < s + span; c++) used[c] = true;

        const w = span * colW + (span - 1) * gutter;
        const h = w / ratio;
        const offset = Math.floor(rand() * 3) * (wide ? 0.4 : 0.5) * colW;
        const x = s * (colW + gutter);
        const y = bandTop + offset;

        Object.assign(p.el.style, { width: `${w}px`, transform: `translate(${x}px, ${y}px)` });
        bandBottom = Math.max(bandBottom, y + h);
        i++;
      }
      bottom = bandBottom;
      bandTop = bandBottom + (wide ? colW * 0.45 : colW * 0.9);
    }
    canvas.style.height = `${bottom + 24}px`;
  }

  /* ---------- Filters ---------- */
  const facetButtons = { type: [], material: [] };
  const buildFacet = (key, list, boxId) => {
    [{ key: 'all', label: 'All' }, ...list].forEach(item => {
      const b = document.createElement('button');
      b.className = 'opt';
      b.dataset.value = item.key;
      b.textContent = item.label;
      b.setAttribute('aria-pressed', item.key === 'all');
      b.addEventListener('click', () => setFacet(key, item.key));
      $(boxId).appendChild(b);
      facetButtons[key].push(b);
    });
  };
  buildFacet('type', TYPES, 'f-type');
  buildFacet('material', MATERIALS, 'f-material');

  function setFacet(key, value) {
    state[key] = value;
    facetButtons[key].forEach(b => b.setAttribute('aria-pressed', b.dataset.value === value));
    applyFilter();
  }

  /* ---------- Index ---------- */
  const indexed = [...REPAIRS].sort((a, b) => a.id.localeCompare(b.id));
  const rows = indexed.map(r => {
    const tr = document.createElement('tr');
    tr.tabIndex = 0;
    tr.setAttribute('aria-label', `Open ${r.id}`);
    const cells = [r.id, '', typeOf[r.type].label, materialOf[r.material].label, r.place || '—', r.date || '—'];
    cells.forEach((v, i) => {
      const td = document.createElement('td');
      if (i === 1) td.appendChild(thumb(r)); else td.textContent = v;
      tr.appendChild(td);
    });
    const open = () => {
      const list = rows.filter(x => !x.tr.hidden).map(x => x.r);
      openViewer(list, list.indexOf(r), tr);
    };
    tr.addEventListener('click', open);
    tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    $('index-body').appendChild(tr);
    return { r, tr };
  });

  function applyFilter() {
    let n = 0;
    photos.forEach(p => {
      const on = matches(p.r);
      p.el.classList.toggle('is-out', !on);
      p.el.tabIndex = on ? 0 : -1;
      if (on) n++;
    });
    rows.forEach(({ r, tr }) => { tr.hidden = !matches(r); });
    $('filter-count').textContent = `${pad2(n)} / ${pad2(REPAIRS.length)}`;
    $('index-count').textContent = `${pad2(n)} / ${pad2(REPAIRS.length)}`;
  }

  const toggle = $('filter-toggle');
  toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', open);
    $('filters').hidden = !open;
  });

  /* ---------- Research ---------- */
  const para = (text, cls) => {
    const div = document.createElement('div');
    div.className = cls;
    text.forEach(t => { const p = document.createElement('p'); p.textContent = t; div.appendChild(p); });
    return div;
  };
  const imageRow = ids => {
    const list = ids.map(id => byId[id]).filter(Boolean);
    const row = document.createElement('div');
    row.className = 'chapter-images';
    list.forEach((r, i) => {
      const b = document.createElement('button');
      b.className = 'photo-static';
      b.setAttribute('aria-label', `${r.id}, open photograph`);
      b.appendChild(thumb(r));
      b.addEventListener('click', () => openViewer(list, i, b));
      row.appendChild(b);
    });
    return row;
  };

  RESEARCH.forEach(ch => {
    const sec = document.createElement('article');
    sec.className = 'chapter grid';
    sec.innerHTML = '<span class="chapter-no"></span><h2 class="chapter-title"></h2>';
    sec.querySelector('.chapter-no').textContent = ch.no;
    sec.querySelector('h2').textContent = ch.title;

    if (ch.text.length) sec.appendChild(para(ch.text, 'chapter-text'));
    else if (!ch.gazes) {
      const f = document.createElement('p');
      f.className = 'forthcoming';
      f.textContent = 'Text forthcoming.';
      sec.appendChild(f);
    }

    (ch.gazes || []).forEach((g, i) => {
      const box = document.createElement('div');
      box.className = `gaze ${i === 0 ? 'a' : 'b'}`;
      const h = document.createElement('h3');
      h.textContent = `— ${g.title}`;
      box.appendChild(h);
      g.text.forEach(t => { const p = document.createElement('p'); p.textContent = t; box.appendChild(p); });
      sec.appendChild(box);
    });
    (ch.gazes || []).forEach(g => { if (g.images.length) sec.appendChild(imageRow(g.images)); });

    if (ch.images.length) sec.appendChild(imageRow(ch.images));
    $('research-body').appendChild(sec);
  });

  /* ---------- Viewer ---------- */
  const viewer = $('viewer');
  const view = { list: [], i: 0, opener: null };

  function openViewer(list, i, opener) {
    if (!list.length || i < 0) return;
    view.list = list; view.i = i;
    if (opener) view.opener = opener;
    const r = list[i];

    const img = new Image();
    img.src = fullSrc(r);
    img.alt = r.title;
    $('v-img').replaceChildren(img);
    $('v-pos').textContent = `${pad2(i + 1)} / ${pad2(list.length)}`;

    const meta = [
      ['No.', r.id],
      ['Type', typeOf[r.type].label],
      ['Material', materialOf[r.material].label],
      ['Location', r.place],
      ['Date', r.date]
    ].filter(([, v]) => v);
    $('v-meta').replaceChildren(...meta.map(([k, v]) => {
      const d = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      d.append(dt, dd);
      return d;
    }));
    $('v-note').textContent = r.note || '';
    $('v-note').hidden = !r.note;

    const single = list.length < 2;
    $('v-prev').hidden = single;
    $('v-next').hidden = single;

    if (viewer.hidden) {
      viewer.hidden = false;
      document.body.style.overflow = 'hidden';
      $('v-close').focus();
    }
  }

  function closeViewer() {
    viewer.hidden = true;
    document.body.style.overflow = '';
    if (view.opener) view.opener.focus({ preventScroll: true });
  }

  const step = d => openViewer(view.list, (view.i + d + view.list.length) % view.list.length);
  $('v-prev').addEventListener('click', () => step(-1));
  $('v-next').addEventListener('click', () => step(1));
  $('v-close').addEventListener('click', closeViewer);
  $('v-img').addEventListener('click', e => { if (e.target === e.currentTarget) closeViewer(); });

  document.addEventListener('keydown', e => {
    if (viewer.hidden) return;
    if (e.key === 'Escape') closeViewer();
    else if (e.key === 'ArrowRight' && view.list.length > 1) step(1);
    else if (e.key === 'ArrowLeft' && view.list.length > 1) step(-1);
    else if (e.key === 'Tab') {
      // keep focus inside the viewer
      const f = [...viewer.querySelectorAll('button')].filter(b => !b.hidden);
      const at = f.indexOf(document.activeElement);
      e.preventDefault();
      f[(at + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
    }
  });

  /* ---------- Routes ---------- */
  const views = { '': 'view-archive', index: 'view-index', research: 'view-research', about: 'view-about' };

  function route() {
    const name = location.hash.replace('#', '');
    const key = name in views ? name : '';
    state.route = key;
    Object.entries(views).forEach(([k, id]) => { $(id).hidden = k !== key; });
    document.querySelectorAll('.menu [data-route]').forEach(a => {
      if (a.dataset.route === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.body.className = key ? `route-${key}` : '';

    // filters only apply where the photographs are listed
    const filterable = key === '' || key === 'index';
    toggle.hidden = !filterable;
    if (!filterable) { $('filters').hidden = true; toggle.setAttribute('aria-expanded', 'false'); }

    if (key === '') compose();
    if (!viewer.hidden) closeViewer();
    window.scrollTo(0, 0);
    if (key) $('main').focus({ preventScroll: true });
  }
  window.addEventListener('hashchange', route);

  let lastW = window.innerWidth, t;
  window.addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (window.innerWidth !== lastW && state.route === '') compose();
      lastW = window.innerWidth;
    }, 120);
  });

  applyFilter();
  route();
});
