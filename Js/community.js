/*
  Community: visitor uploads, comments on photographs, an open discussion,
  and the Beauty / Vulnerability poll. Talks to Supabase over plain fetch.
  Connection details live in Js/config.js; with them empty, everything here
  shows a "not connected yet" state and the archive works as before.
*/
const Community = (() => {
  const enabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  const $ = id => document.getElementById(id);
  const pad2 = n => String(n).padStart(2, '0');
  const headers = (extra = {}) => ({
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra
  });

  /* ---------- Small helpers ---------- */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };
  const clientId = (() => {
    let id = store.get('ir-client');
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
      store.set('ir-client', id);
    }
    return id;
  })();
  const date = iso => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

  // Wait 20 seconds between posts from the same browser
  const tooSoon = () => Date.now() - Number(store.get('ir-last-post') || 0) < 20000;
  const markPosted = () => store.set('ir-last-post', String(Date.now()));

  async function select(table, query) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: headers() });
    if (!res.ok) throw new Error(`Could not load ${table} (${res.status})`);
    return res.json();
  }
  async function insert(table, row) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: headers({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
      body: JSON.stringify(row)
    });
    if (!res.ok) {
      const err = new Error(`Could not save (${res.status})`);
      err.status = res.status;
      throw err;
    }
  }
  const publicUrl = path => `${SUPABASE_URL}/storage/v1/object/public/submissions/${path}`;

  function entry(name, when, body) {
    const li = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'entry-head';
    const who = document.createElement('span');
    who.textContent = name || 'Anonymous';
    const t = document.createElement('time');
    t.dateTime = when;
    t.textContent = date(when);
    head.append(who, t);
    const p = document.createElement('p');
    p.textContent = body;
    li.append(head, p);
    return li;
  }

  const rememberName = id => { const v = $(id).value.trim(); if (v) store.set('ir-name', v); return v; };
  ['c-name', 'd-name', 'u-name'].forEach(id => { $(id).value = store.get('ir-name') || ''; });

  /* ---------- Approved visitor photographs join the archive ---------- */
  async function approvedPhotos() {
    if (!enabled) return [];
    const timeout = new Promise(resolve => setTimeout(() => resolve([]), 4000));
    const load = select('submissions', 'select=id,name,place,found_on,type,material,caption,file_path,width,height,lat,lng&approved=eq.true&order=id.asc')
      .then(rows => rows.map(s => ({
        id: `CR-${pad2(s.id)}`,
        community: true,
        src: publicUrl(s.file_path),
        w: s.width,
        h: s.height,
        type: s.type,
        material: s.material,
        title: s.caption || `Found by ${s.name || 'a visitor'}`,
        place: s.place || '',
        date: s.found_on || '',
        note: s.caption || '',
        by: s.name || 'Anonymous',
        lat: s.lat,
        lng: s.lng
      })))
      .catch(() => []);
    return Promise.race([load, timeout]);
  }

  /* ---------- Drawer ---------- */
  const drawer = $('drawer');
  let opener = null;

  function openDrawer(tab, from) {
    opener = from || document.activeElement;
    drawer.hidden = false;
    showTab(tab);
    drawer.querySelector(`[data-tab="${tab}"]`).focus();
  }
  function closeDrawer() {
    drawer.hidden = true;
    if (opener) opener.focus({ preventScroll: true });
  }
  function showTab(tab) {
    drawer.querySelectorAll('[role="tab"]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === tab));
    ['contribute', 'discussion', 'poll'].forEach(t => { $(`panel-${t}`).hidden = t !== tab; });
    if (tab === 'discussion') loadOpinions();
    if (tab === 'poll') loadPoll();
    if (tab === 'contribute' && enabled) MapView.startPicker().catch(() => {});
  }

  document.querySelectorAll('[data-open]').forEach(b =>
    b.addEventListener('click', () => openDrawer(b.dataset.open, b)));
  drawer.querySelectorAll('[role="tab"]').forEach(b =>
    b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('drawer-close').addEventListener('click', closeDrawer);
  drawer.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.stopPropagation(); closeDrawer(); }
  });

  if (!enabled) {
    $('offline').hidden = false;
    drawer.querySelectorAll('form input, form textarea, form select, form button').forEach(el => { el.disabled = true; });
    drawer.querySelectorAll('.choice').forEach(el => { el.disabled = true; });
    document.querySelectorAll('#c-form input, #c-form textarea, #c-form button').forEach(el => { el.disabled = true; });
    $('c-msg').textContent = 'Comments open once the database is connected.';
  }

  /* ---------- Contribute ---------- */
  const typeSel = $('u-type'), matSel = $('u-material');
  const option = (sel, list) => list.filter(x => x.key !== 'unsorted').forEach(x => {
    const o = document.createElement('option');
    o.value = x.key; o.textContent = x.label;
    sel.appendChild(o);
  });
  option(typeSel, TYPES);
  option(matSel, MATERIALS);

  const fileInput = $('u-file'), drop = $('u-drop'), preview = $('u-preview');
  let prepared = null;   // { blob, w, h }

  // Re-encode in the browser: caps the size at 2000px and drops EXIF data,
  // including any GPS position stored in the photograph.
  async function prepare(file) {
    if (file.size > 15 * 1024 * 1024) throw new Error('This file is larger than 15 MB. Please choose a smaller photograph.');
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('This browser cannot read that file. Please choose a JPG or PNG.'));
        i.src = url;
      });
      const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.86));
      return { blob, w, h };
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function choose(file) {
    $('u-msg').textContent = '';
    prepared = null;
    preview.hidden = true;
    if (!file) return;
    try {
      prepared = await prepare(file);
      preview.src = URL.createObjectURL(prepared.blob);
      preview.hidden = false;
      $('u-drop-text').hidden = true;
    } catch (err) {
      $('u-drop-text').hidden = false;
      $('u-msg').textContent = err.message;
    }
  }
  fileInput.addEventListener('change', () => choose(fileInput.files[0]));
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) { const dt = new DataTransfer(); dt.items.add(f); fileInput.files = dt.files; choose(f); }
  });

  $('u-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('u-msg');
    if ($('u-trap').value) return;
    if (!prepared) { msg.textContent = 'Choose a photograph first.'; return; }
    if (!$('u-consent').checked) { msg.textContent = 'Please confirm that you took this photograph.'; return; }
    if (tooSoon()) { msg.textContent = 'Please wait a few seconds before sending again.'; return; }

    const btn = $('u-submit');
    btn.disabled = true;
    msg.textContent = 'Uploading…';
    try {
      const month = new Date().toISOString().slice(0, 7);
      const name = crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      const path = `${month}/${name}.jpg`;
      const up = await fetch(`${SUPABASE_URL}/storage/v1/object/submissions/${path}`, {
        method: 'POST',
        headers: headers({ 'Content-Type': 'image/jpeg', 'x-upsert': 'false' }),
        body: prepared.blob
      });
      if (!up.ok) throw new Error(`Upload failed (${up.status})`);
      await insert('submissions', {
        name: rememberName('u-name') || null,
        place: $('u-place').value.trim() || null,
        found_on: $('u-date').value || null,
        type: typeSel.value,
        material: matSel.value,
        caption: $('u-caption').value.trim() || null,
        file_path: path,
        width: prepared.w,
        height: prepared.h,
        lat: MapView.pickedLocation()?.lat ?? null,
        lng: MapView.pickedLocation()?.lng ?? null
      });
      markPosted();
      $('u-form').reset();
      ['u-name'].forEach(id => { $(id).value = store.get('ir-name') || ''; });
      prepared = null;
      MapView.clearPicker();
      preview.hidden = true;
      $('u-drop-text').hidden = false;
      msg.textContent = 'Thank you. Your photograph will appear in the archive after review.';
    } catch (err) {
      msg.textContent = `${err.message}. Please try again.`;
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- Discussion ---------- */
  async function loadOpinions() {
    if (!enabled) return;
    const list = $('d-list');
    try {
      const rows = await select('opinions', 'select=name,body,created_at&order=created_at.desc&limit=200');
      list.replaceChildren(...rows.map(r => entry(r.name, r.created_at, r.body)));
      if (!rows.length) list.innerHTML = '<li class="entries-empty">No thoughts yet. Be the first to share one.</li>';
    } catch (err) {
      list.innerHTML = '<li class="entries-empty">The discussion could not be loaded. Try again in a moment.</li>';
    }
  }

  $('d-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('d-msg'), body = $('d-body').value.trim();
    if ($('d-trap').value) return;
    if (!body) { msg.textContent = 'Write something first.'; return; }
    if (tooSoon()) { msg.textContent = 'Please wait a few seconds before posting again.'; return; }
    try {
      await insert('opinions', { name: rememberName('d-name') || null, body });
      markPosted();
      $('d-body').value = '';
      msg.textContent = 'Shared.';
      loadOpinions();
    } catch (err) {
      msg.textContent = `${err.message}. Please try again.`;
    }
  });

  /* ---------- Comments on a photograph ---------- */
  let commentFor = null;

  async function showComments(photoId) {
    commentFor = photoId;
    const list = $('c-list');
    list.replaceChildren();
    $('c-count').textContent = '';
    if (!enabled) return;
    $('c-msg').textContent = '';
    try {
      const rows = await select('comments', `select=name,body,created_at&photo_id=eq.${encodeURIComponent(photoId)}&order=created_at.asc&limit=200`);
      if (commentFor !== photoId) return;   // moved on to another photograph
      list.replaceChildren(...rows.map(r => entry(r.name, r.created_at, r.body)));
      $('c-count').textContent = rows.length ? pad2(rows.length) : '';
      if (!rows.length) list.innerHTML = '<li class="entries-empty">No comments yet.</li>';
    } catch (err) {
      list.innerHTML = '<li class="entries-empty">Comments could not be loaded.</li>';
    }
  }

  $('c-form').addEventListener('submit', async e => {
    e.preventDefault();
    const msg = $('c-msg'), body = $('c-body').value.trim();
    if ($('c-trap').value || !commentFor) return;
    if (!body) { msg.textContent = 'Write a comment first.'; return; }
    if (tooSoon()) { msg.textContent = 'Please wait a few seconds before posting again.'; return; }
    try {
      await insert('comments', { photo_id: commentFor, name: rememberName('c-name') || null, body });
      markPosted();
      $('c-body').value = '';
      msg.textContent = 'Posted.';
      showComments(commentFor);
    } catch (err) {
      msg.textContent = `${err.message}. Please try again.`;
    }
  });

  /* ---------- Per-photograph vote: beauty or vulnerability ---------- */
  const gazeBtns = [...document.querySelectorAll('.gaze-btn')];
  let gazeFor = null;
  const gazeKey = id => `ir-pv-${id}`;

  function drawGaze(totals) {
    const b = totals.beauty || 0, v = totals.vulnerability || 0, all = b + v;
    const pb = all ? Math.round((b / all) * 100) : 50, pv = 100 - pb;
    $('g-bar-b').style.width = `${pb}%`;
    $('g-bar-v').style.width = `${pv}%`;
    $('g-pct-b').textContent = `${pb}%`;
    $('g-pct-v').textContent = `${pv}%`;
    $('g-total').textContent = `${all} vote${all === 1 ? '' : 's'}`;
    $('g-result').hidden = false;
  }

  // Results stay hidden until this browser has voted, so no one is nudged
  async function showPhotoVote(photoId) {
    gazeFor = photoId;
    const mine = store.get(gazeKey(photoId));
    gazeBtns.forEach(b => {
      b.setAttribute('aria-pressed', b.dataset.choice === mine);
      b.disabled = !enabled || Boolean(mine);
    });
    $('g-result').hidden = true;
    if (!enabled) { $('g-msg').textContent = 'Votes open once the database is connected.'; return; }
    if (!mine) { $('g-msg').textContent = 'Vote to see how others read it.'; return; }
    $('g-msg').textContent = `You read it as ${mine === 'beauty' ? 'beauty' : 'vulnerability'}.`;
    try {
      const rows = await select('photo_vote_totals', `select=choice,total&photo_id=eq.${encodeURIComponent(photoId)}`);
      if (gazeFor !== photoId) return;
      drawGaze(Object.fromEntries(rows.map(r => [r.choice, r.total])));
    } catch (err) {
      $('g-msg').textContent = 'Results could not be loaded.';
    }
  }

  gazeBtns.forEach(btn => btn.addEventListener('click', async () => {
    const id = gazeFor;
    if (!id || store.get(gazeKey(id))) return;
    gazeBtns.forEach(b => { b.disabled = true; });
    try {
      await insert('photo_votes', { photo_id: id, client_id: clientId, choice: btn.dataset.choice });
    } catch (err) {
      if (err.status !== 409) {     // 409: already voted from this browser
        $('g-msg').textContent = `${err.message}. Please try again.`;
        gazeBtns.forEach(b => { b.disabled = false; });
        return;
      }
    }
    store.set(gazeKey(id), btn.dataset.choice);
    showPhotoVote(id);
  }));

  /* ---------- Poll ---------- */
  const choices = [...document.querySelectorAll('.choice')];

  function drawPoll(totals) {
    const b = totals.beauty || 0, v = totals.vulnerability || 0, all = b + v;
    const pb = all ? Math.round((b / all) * 100) : 50;
    const pv = all ? 100 - pb : 50;
    $('p-bar-b').style.width = `${pb}%`;
    $('p-bar-v').style.width = `${pv}%`;
    $('p-pct-b').textContent = all ? `${pb}%` : '—';
    $('p-pct-v').textContent = all ? `${pv}%` : '—';
    $('p-total').textContent = all ? `${all} vote${all === 1 ? '' : 's'}` : 'No votes yet';
    $('poll-mini').textContent = all ? `${pb} / ${pv}` : '';
    $('p-result').classList.toggle('is-empty', !all);
  }

  function markVoted() {
    const mine = store.get('ir-vote');
    choices.forEach(c => {
      c.setAttribute('aria-pressed', c.dataset.choice === mine);
      if (mine) c.disabled = true;
    });
    if (mine) $('p-msg').textContent = `You voted ${mine === 'beauty' ? 'Beauty' : 'Vulnerability'}.`;
  }

  async function loadPoll() {
    if (!enabled) { drawPoll({}); return; }
    try {
      const rows = await select('vote_totals', 'select=choice,total');
      drawPoll(Object.fromEntries(rows.map(r => [r.choice, r.total])));
    } catch (err) {
      $('p-msg').textContent = 'Results could not be loaded.';
    }
    markVoted();
  }

  choices.forEach(c => c.addEventListener('click', async () => {
    if (store.get('ir-vote')) return;
    choices.forEach(x => { x.disabled = true; });
    try {
      await insert('votes', { client_id: clientId, choice: c.dataset.choice });
    } catch (err) {
      // 409: this browser has already voted; keep its earlier choice
      if (err.status !== 409) {
        $('p-msg').textContent = `${err.message}. Please try again.`;
        choices.forEach(x => { x.disabled = false; });
        return;
      }
    }
    store.set('ir-vote', c.dataset.choice);
    loadPoll();
  }));

  // Show the current split in the header right away
  loadPoll();

  return { enabled, approvedPhotos, showComments, showPhotoVote };
})();
