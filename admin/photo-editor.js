/*
 * Tamara Artist · photo editor for the site editor (Sveltia CMS)
 * ---------------------------------------------------------------
 * Adds an "Edit photo" button beside "Replace" on every photo field. It opens a full-screen editor
 * to crop, rotate, straighten, flip and adjust colour. The edited copy is handed back to the field
 * through its normal upload route, so it is saved as a new file in the same folder as the original
 * (the original is never changed) and thumbnails, folders and upload settings keep working.
 *
 * Everything runs in the browser; no outside libraries are needed.
 */
(function () {
  'use strict';

  /* ============================== image maths ============================== */

  const MAX_SOURCE = 3000;   // longest edge kept in memory while editing
  const MAX_OUTPUT = 2000;   // longest edge of the saved photo (matches the upload setting)
  const MAX_PREVIEW = 1100;  // longest edge of the on-screen working copy

  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  const scaled = (src, maxEdge) => {
    const w = src.width, h = src.height, k = Math.min(1, maxEdge / Math.max(w, h));
    const c = canvas(w * k, h * k), x = c.getContext('2d');
    x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    return c;
  };

  /* Rotate (quarter turns + fine straighten angle) and flip. Returns a new canvas sized to the
     rotated image's bounding box; uncovered corners are filled white, like paper. */
  const transform = (src, t) => {
    const quarter = ((t.rot % 4) + 4) % 4;
    const a = (quarter * 90 + t.angle) * Math.PI / 180;
    const cos = Math.abs(Math.cos(a)), sin = Math.abs(Math.sin(a));
    const w = src.width * cos + src.height * sin, h = src.width * sin + src.height * cos;
    const c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    x.imageSmoothingQuality = 'high';
    x.translate(c.width / 2, c.height / 2);
    x.rotate(a);
    if (t.flip) x.scale(-1, 1);
    x.drawImage(src, -src.width / 2, -src.height / 2);
    return c;
  };

  /* Colour adjustments, each -100…100. Done pixel by pixel so the preview and the saved photo
     match exactly in every browser. */
  const isNeutral = adj => !adj.brightness && !adj.contrast && !adj.saturation && !adj.warmth && !adj.highlights;
  const adjust = (cv, adj) => {
    if (isNeutral(adj)) return cv;
    const x = cv.getContext('2d'), img = x.getImageData(0, 0, cv.width, cv.height), d = img.data;
    const bright = 1 + adj.brightness / 100 * 0.6;
    const con = 1 + adj.contrast / 100 * 0.8;
    const sat = 1 + adj.saturation / 100;
    const warm = adj.warmth / 100 * 28;
    const hi = adj.highlights / 100;   // lift (or dim) the light tones, e.g. grey paper → white
    // per-channel lookup for brightness, contrast and highlights
    const lut = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      let v = i * bright;
      v = (v - 128) * con + 128;
      if (hi) { const t = Math.min(1, Math.max(0, (v - 110) / 145)); v += hi * 70 * t * t; }
      lut[i] = v;
    }
    for (let i = 0; i < d.length; i += 4) {
      let r = lut[d[i]] + warm, g = lut[d[i + 1]] + warm * 0.25, b = lut[d[i + 2]] - warm;
      if (sat !== 1) { const l = 0.2126 * r + 0.7152 * g + 0.0722 * b; r = l + (r - l) * sat; g = l + (g - l) * sat; b = l + (b - l) * sat; }
      d[i] = r; d[i + 1] = g; d[i + 2] = b;   // Uint8ClampedArray clamps to 0…255
    }
    x.putImageData(img, 0, 0);
    return cv;
  };

  const cropCanvas = (src, r) => {
    const sx = Math.round(r.x * src.width), sy = Math.round(r.y * src.height);
    const sw = Math.max(1, Math.round(r.w * src.width)), sh = Math.max(1, Math.round(r.h * src.height));
    const c = canvas(sw, sh); c.getContext('2d').drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    return c;
  };

  const toBlob = (cv, type, q) => new Promise(res => cv.toBlob(res, type, q));
  const encode = async cv => {
    let b = await toBlob(cv, 'image/webp', 0.9);
    if (!b || b.type !== 'image/webp') b = await toBlob(cv, 'image/jpeg', 0.92); // Safari can't make WebP
    return b;
  };

  const loadSource = async input => {
    const blob = input instanceof Blob ? input : await (await fetch(input)).blob();
    let bmp;
    try { bmp = await createImageBitmap(blob, {imageOrientation: 'from-image'}); }
    catch (e) {
      bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('This file could not be opened as a photo.')); i.src = URL.createObjectURL(blob); });
    }
    const w = bmp.naturalWidth || bmp.width, h = bmp.naturalHeight || bmp.height;
    const c = canvas(w, h); c.getContext('2d').drawImage(bmp, 0, 0);
    return scaled(c, MAX_SOURCE);
  };

  /* Full-quality export of a given edit state (also used by the tests). */
  const render = (source, state) => {
    let out = transform(source, state);
    out = cropCanvas(out, state.crop);
    out = scaled(out, MAX_OUTPUT);
    return adjust(out, state.adj);
  };

  /* ================================ the editor ================================ */

  const CSS = `
.tpe{position:fixed; inset:0; z-index:2147483000; background:#1d1c1a; color:#f4f2ee; display:flex; flex-direction:column; font:14px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif; -webkit-user-select:none; user-select:none}
.tpe *{box-sizing:border-box}
.tpe [hidden]{display:none!important}
.tpe-top{display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid #34322e}
.tpe-top h2{font-size:16px; font-weight:600; margin:0; flex:1}
.tpe button{white-space:nowrap; font:inherit; color:inherit; background:#2c2a27; border:1px solid #46433e; border-radius:999px; padding:7px 14px; cursor:pointer; min-height:36px}
.tpe button:hover{background:#38352f}
.tpe button[aria-pressed="true"]{background:#f4f2ee; color:#1d1c1a; border-color:#f4f2ee}
.tpe button.tpe-save{background:#f4f2ee; color:#1d1c1a; border-color:#f4f2ee; font-weight:600}
.tpe button:disabled{opacity:.5; cursor:default}
.tpe-stage{flex:1; position:relative; min-height:0; touch-action:none}
.tpe-stage canvas{position:absolute; left:0; top:0}
.tpe-panel{border-top:1px solid #34322e; padding:10px 14px 14px; display:flex; flex-direction:column; gap:10px; max-height:46vh; overflow:auto}
.tpe-tabs{display:flex; gap:8px; justify-content:center}
.tpe-row{display:flex; flex-wrap:wrap; gap:8px; justify-content:center; align-items:center}
.tpe-col{display:flex; flex-direction:column; gap:10px; align-items:center}
.tpe-label{color:#b9b4ab; font-size:12px; text-transform:uppercase; letter-spacing:.06em; margin-right:4px}
.tpe-sliders{display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:10px 22px; max-width:820px; margin:0 auto; width:100%}
.tpe-slider{display:grid; grid-template-columns:96px 1fr 38px; align-items:center; gap:8px}
.tpe-slider span:last-child{text-align:right; font-variant-numeric:tabular-nums; color:#b9b4ab}
.tpe input[type=range]{width:100%; accent-color:#f4f2ee}
.tpe-busy{position:absolute; inset:0; display:grid; place-items:center; background:rgba(29,28,26,.6); font-size:15px}
.tpe-hint{color:#b9b4ab; font-size:12.5px; text-align:center}
@media (max-width:600px){ .tpe-top h2{display:none} .tpe-top{justify-content:flex-end} .tpe-slider{grid-template-columns:84px 1fr 34px} .tpe button{padding:6px 11px} }
`;

  const RATIOS = [
    {id: 'free', label: 'Free', r: null},
    {id: 'original', label: 'Original', r: 'original'},
    {id: '1:1', label: 'Square', r: 1},
    {id: '4:5', label: 'Portrait 4:5', r: 4 / 5},
    {id: '3:4', label: 'Portrait 3:4', r: 3 / 4},
    {id: '4:3', label: 'Landscape 4:3', r: 4 / 3},
  ];
  const SLIDERS = [
    {id: 'brightness', label: 'Brightness'},
    {id: 'contrast', label: 'Contrast'},
    {id: 'highlights', label: 'Whiten paper'},
    {id: 'saturation', label: 'Saturation'},
    {id: 'warmth', label: 'Warmth'},
  ];

  const blankState = () => ({rot: 0, angle: 0, flip: false, crop: {x: 0, y: 0, w: 1, h: 1}, ratio: 'free', adj: {brightness: 0, contrast: 0, highlights: 0, saturation: 0, warmth: 0}});

  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    for (const k in attrs || {}) { if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]); else if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    kids.flat().forEach(c => n.append(c));
    return n;
  };

  /**
   * Open the editor. Resolves to a Blob with the edited photo, or null if cancelled.
   * @param {Blob|string} input  the photo (Blob or URL)
   */
  async function open(input, opts) {
    opts = opts || {};
    if (!document.getElementById('tpe-style')) document.head.append(el('style', {id: 'tpe-style'}, CSS));

    const root = el('div', {class: 'tpe', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Edit photo'});
    const stage = el('div', {class: 'tpe-stage'});
    const view = el('canvas'), overlay = el('canvas');
    const busy = el('div', {class: 'tpe-busy'}, 'Opening photo…');
    stage.append(view, overlay, busy);
    const btnCancel = el('button', {type: 'button'}, 'Cancel');
    const btnReset = el('button', {type: 'button'}, 'Start over');
    const btnSave = el('button', {type: 'button', class: 'tpe-save', disabled: ''}, 'Save edited copy');
    root.append(el('div', {class: 'tpe-top'}, el('h2', null, 'Edit photo'), btnReset, btnCancel, btnSave), stage);
    const panel = el('div', {class: 'tpe-panel'}); root.append(panel);
    document.body.append(root);
    const prevOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';

    let finish; const done = new Promise(r => finish = r);
    let source, preview, state = blankState(), shown = null, tab = 'crop';
    const close = result => { window.removeEventListener('resize', layout); document.removeEventListener('keydown', onKey, true); root.remove(); document.body.style.overflow = prevOverflow; finish(result); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); close(null); } };
    document.addEventListener('keydown', onKey, true);
    btnCancel.onclick = () => close(null);

    try { source = await loadSource(input); }
    catch (e) { busy.textContent = e.message || 'This photo could not be opened.'; return done; }
    preview = scaled(source, MAX_PREVIEW);

    /* ---- layout + drawing ---- */
    let geo = {x: 0, y: 0, w: 1, h: 1};   // where the transformed image sits on screen (css px)
    const dpr = () => Math.min(2, window.devicePixelRatio || 1);
    const rebuild = () => { shown = adjust(transform(preview, state), state.adj); };
    function layout() {
      const W = stage.clientWidth, H = stage.clientHeight, pad = 18, k = dpr();
      [view, overlay].forEach(c => { c.width = W * k; c.height = H * k; c.style.width = W + 'px'; c.style.height = H + 'px'; });
      const s = Math.min((W - pad * 2) / shown.width, (H - pad * 2) / shown.height);
      geo = {w: shown.width * s, h: shown.height * s}; geo.x = (W - geo.w) / 2; geo.y = (H - geo.h) / 2;
      draw();
    }
    function draw() {
      const k = dpr(), v = view.getContext('2d'), o = overlay.getContext('2d');
      v.setTransform(k, 0, 0, k, 0, 0); v.clearRect(0, 0, view.width, view.height);
      v.imageSmoothingQuality = 'high'; v.drawImage(shown, geo.x, geo.y, geo.w, geo.h);
      o.setTransform(k, 0, 0, k, 0, 0); o.clearRect(0, 0, overlay.width, overlay.height);
      const c = state.crop, rx = geo.x + c.x * geo.w, ry = geo.y + c.y * geo.h, rw = c.w * geo.w, rh = c.h * geo.h;
      o.fillStyle = tab === 'crop' ? 'rgba(20,19,17,.62)' : 'rgba(29,28,26,1)';
      o.beginPath(); o.rect(0, 0, overlay.width / k, overlay.height / k); o.rect(rx, ry, rw, rh); o.fill('evenodd');
      if (tab !== 'crop') return;
      o.strokeStyle = 'rgba(255,255,255,.9)'; o.lineWidth = 1.5; o.strokeRect(rx, ry, rw, rh);
      o.strokeStyle = 'rgba(255,255,255,.35)'; o.lineWidth = 1;
      for (let i = 1; i < 3; i++) { o.beginPath(); o.moveTo(rx + rw * i / 3, ry); o.lineTo(rx + rw * i / 3, ry + rh); o.moveTo(rx, ry + rh * i / 3); o.lineTo(rx + rw, ry + rh * i / 3); o.stroke(); }
      o.fillStyle = '#fff';
      [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(([x, y]) => { o.fillRect(x - 6, y - 6, 12, 12); });
    }

    /* ---- crop box ---- */
    const imgAspect = () => shown.width / shown.height;
    /* chosen shape as width ÷ height on screen, or null for free cropping */
    const ratioValue = () => {
      const r = RATIOS.find(q => q.id === state.ratio); if (!r || !r.r) return null;
      if (r.r !== 'original') return r.r;
      const a = source.width / source.height; return state.rot % 2 ? 1 / a : a;
    };
    /* area guaranteed to be photo (no white corners) after straightening, in normalised units */
    const safeArea = () => {
      if (!state.angle) return {w: 1, h: 1};
      const t = Math.abs(state.angle) * Math.PI / 180, c = Math.cos(t), sn = Math.sin(t);
      const W = state.rot % 2 ? preview.height : preview.width, H = state.rot % 2 ? preview.width : preview.height;
      const k = Math.min(W / (W * c + H * sn), H / (W * sn + H * c));
      return {w: k * W / shown.width, h: k * H / shown.height};
    };
    const fitCrop = () => {   // largest centred box with the chosen ratio, inside the photo
      const r = ratioValue(), safe = safeArea();
      let w = safe.w, h = safe.h;
      if (r) { const nr = r / imgAspect(); if (w / h > nr) w = h * nr; else h = w / nr; }
      state.crop = {x: (1 - w) / 2, y: (1 - h) / 2, w, h};
    };
    let drag = null;
    const toNorm = e => { const b = overlay.getBoundingClientRect(); return {x: (e.clientX - b.left - geo.x) / geo.w, y: (e.clientY - b.top - geo.y) / geo.h}; };
    const hit = p => {
      const c = state.crop, tol = 16 / Math.min(geo.w, geo.h);
      const near = (a, b) => Math.abs(a - b) < tol;
      const corners = {nw: [c.x, c.y], ne: [c.x + c.w, c.y], sw: [c.x, c.y + c.h], se: [c.x + c.w, c.y + c.h]};
      for (const k in corners) if (near(p.x, corners[k][0]) && near(p.y, corners[k][1])) return k;
      const inY = p.y > c.y && p.y < c.y + c.h, inX = p.x > c.x && p.x < c.x + c.w;
      if (near(p.x, c.x) && inY) return 'w'; if (near(p.x, c.x + c.w) && inY) return 'e';
      if (near(p.y, c.y) && inX) return 'n'; if (near(p.y, c.y + c.h) && inX) return 's';
      if (inX && inY) return 'move';
      return null;
    };
    const CURSORS = {nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move'};
    overlay.addEventListener('pointerdown', e => {
      if (tab !== 'crop') return;
      const p = toNorm(e), h = hit(p); if (!h) return;
      drag = {h, p, c: Object.assign({}, state.crop)}; overlay.setPointerCapture(e.pointerId); e.preventDefault();
    });
    overlay.addEventListener('pointermove', e => {
      if (tab !== 'crop') { overlay.style.cursor = ''; return; }
      const p = toNorm(e);
      if (!drag) { overlay.style.cursor = CURSORS[hit(p)] || 'default'; return; }
      const dx = p.x - drag.p.x, dy = p.y - drag.p.y, c0 = drag.c, min = 0.04;
      let {x, y, w, h} = c0;
      if (drag.h === 'move') { x = Math.min(1 - w, Math.max(0, c0.x + dx)); y = Math.min(1 - h, Math.max(0, c0.y + dy)); }
      else {
        let L = c0.x, T = c0.y, R = c0.x + c0.w, B = c0.y + c0.h;
        if (drag.h.includes('w')) L = Math.min(R - min, Math.max(0, L + dx));
        if (drag.h.includes('e')) R = Math.max(L + min, Math.min(1, R + dx));
        if (drag.h.includes('n')) T = Math.min(B - min, Math.max(0, T + dy));
        if (drag.h.includes('s')) B = Math.max(T + min, Math.min(1, B + dy));
        const r = ratioValue();
        if (r) {   // keep the chosen shape
          const nr = r / imgAspect();   // width ÷ height in normalised units
          if (drag.h === 'n' || drag.h === 's') {            // height drives width, centred
            const nw = (B - T) * nr, cx = (c0.x + c0.w / 2); L = cx - nw / 2; R = cx + nw / 2;
          } else if (drag.h === 'e' || drag.h === 'w') {     // width drives height, centred
            const nh = (R - L) / nr, cy = (c0.y + c0.h / 2); T = cy - nh / 2; B = cy + nh / 2;
          } else {                                           // corner: width drives height, opposite corner fixed
            const nh = (R - L) / nr;
            if (drag.h.includes('n')) T = B - nh; else B = T + nh;
          }
          const eps = 1e-6;
          if (L < -eps || T < -eps || R > 1 + eps || B > 1 + eps || R - L < min || B - T < min) return;  // would leave the photo: ignore this step
        }
        x = L; y = T; w = R - L; h = B - T;
      }
      state.crop = {x, y, w, h}; draw();
    });
    const endDrag = () => { drag = null; };
    overlay.addEventListener('pointerup', endDrag); overlay.addEventListener('pointercancel', endDrag);

    /* ---- controls ---- */
    const tabBtns = {};
    const cropPane = el('div', {class: 'tpe-col'}), adjPane = el('div', {class: 'tpe-sliders'});
    const ratioBtns = RATIOS.map(r => { const b = el('button', {type: 'button', 'aria-pressed': String(state.ratio === r.id)}, r.label); b.onclick = () => { state.ratio = r.id; ratioBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(RATIOS[i].id === r.id))); fitCrop(); draw(); }; return b; });
    const turn = d => { state.rot = (state.rot + d + 4) % 4; rebuild(); fitCrop(); layout(); };
    const btnL = el('button', {type: 'button', title: 'Rotate left', 'aria-label': 'Rotate left'}, '⟲ Rotate left');
    const btnR = el('button', {type: 'button', title: 'Rotate right', 'aria-label': 'Rotate right'}, 'Rotate right ⟳');
    const btnF = el('button', {type: 'button', 'aria-pressed': 'false'}, '⇋ Flip');
    btnL.onclick = () => turn(-1); btnR.onclick = () => turn(1);
    btnF.onclick = () => { state.flip = !state.flip; btnF.setAttribute('aria-pressed', String(state.flip)); rebuild(); draw(); };
    const straight = el('input', {type: 'range', min: '-15', max: '15', step: '0.5', value: '0', 'aria-label': 'Straighten'});
    const straightVal = el('span', null, '0°');
    straight.oninput = () => { state.angle = Number(straight.value); straightVal.textContent = state.angle + '°'; rebuild(); fitCrop(); layout(); };
    cropPane.append(
      el('div', {class: 'tpe-row'}, el('span', {class: 'tpe-label'}, 'Shape'), ratioBtns),
      el('div', {class: 'tpe-row'}, btnL, btnR, btnF),
      el('div', {class: 'tpe-slider', style: 'width:min(420px,100%)'}, el('span', null, 'Straighten'), straight, straightVal),
      el('p', {class: 'tpe-hint'}, 'Drag the corners or edges of the box to crop. Drag inside it to move it.'));
    const sliderEls = {};
    let pending = 0;
    SLIDERS.forEach(s => {
      const input = el('input', {type: 'range', min: '-100', max: '100', step: '1', value: '0', 'aria-label': s.label});
      const out = el('span', null, '0');
      input.oninput = () => {
        state.adj[s.id] = Number(input.value); out.textContent = input.value;
        cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { rebuild(); draw(); });
      };
      input.ondblclick = () => { input.value = '0'; input.oninput(); };
      sliderEls[s.id] = {input, out};
      adjPane.append(el('label', {class: 'tpe-slider'}, el('span', null, s.label), input, out));
    });
    adjPane.append(el('p', {class: 'tpe-hint', style: 'grid-column:1/-1'}, 'Tip: double-click a slider to set it back to 0. “Whiten paper” brightens grey-looking paper without washing out the drawing.'));

    const setTab = t => { tab = t; for (const k in tabBtns) tabBtns[k].setAttribute('aria-pressed', String(k === t)); cropPane.hidden = t !== 'crop'; adjPane.hidden = t !== 'adjust'; draw(); };
    tabBtns.crop = el('button', {type: 'button'}, 'Crop & rotate'); tabBtns.crop.onclick = () => setTab('crop');
    tabBtns.adjust = el('button', {type: 'button'}, 'Colour'); tabBtns.adjust.onclick = () => setTab('adjust');
    panel.append(el('div', {class: 'tpe-tabs'}, tabBtns.crop, tabBtns.adjust), cropPane, adjPane);

    btnReset.onclick = () => {
      state = blankState(); straight.value = '0'; straightVal.textContent = '0°'; btnF.setAttribute('aria-pressed', 'false');
      ratioBtns.forEach((x, i) => x.setAttribute('aria-pressed', String(RATIOS[i].id === 'free')));
      SLIDERS.forEach(s => { sliderEls[s.id].input.value = '0'; sliderEls[s.id].out.textContent = '0'; });
      rebuild(); layout();
    };
    btnSave.onclick = async () => {
      btnSave.disabled = true; busy.textContent = 'Saving…'; busy.hidden = false;
      await new Promise(r => setTimeout(r, 30));
      try { const blob = await encode(render(source, state)); close(blob); }
      catch (e) { busy.textContent = 'Sorry, the photo could not be saved. ' + (e.message || ''); btnSave.disabled = false; }
    };

    rebuild(); setTab('crop'); busy.hidden = true; btnSave.disabled = false;
    window.addEventListener('resize', layout); layout();
    root._tpe = {get state() { return state; }, set state(s) { state = s; rebuild(); layout(); }};   // used by tests
    return done;
  }

  window.TamaraPhotoEditor = {open, render, loadSource, encode, blankState};

  /* ============ "Edit photo" button on every photo field in the site editor ============ */
  /* Sveltia's own photo fields stay exactly as they are (so thumbnails, folders and upload settings
     keep working). We add an "Edit photo" button beside "Replace"; the edited copy is handed back to
     the field through its normal upload route, as if it had been chosen with "Replace". */

  const baseName = path => (String(path || 'photo').split('/').pop().split('?')[0].replace(/\.[^.]+$/, '').replace(/-edited(-[a-z0-9]+)?$/, '') || 'photo');

  const giveToField = (section, file) => {
    const input = section.querySelector('input[type=file]');
    if (!input) throw new Error('This photo field could not take the edited copy.');
    const dt = new DataTransfer(); dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', {bubbles: true}));
  };

  const editField = async (section, button) => {
    const img = section.querySelector('.filled .preview img, .filled img');
    const pathEl = section.querySelector('.filled .value, [role=textbox]');
    if (!img || !img.src) return;
    const label = button.querySelector('.label, span') || button;
    const old = label.textContent; button.disabled = true; label.textContent = 'Opening…';
    try {
      const res = await fetch(img.src);
      if (!res.ok) throw new Error('The photo could not be loaded for editing.');
      const edited = await open(await res.blob());
      if (edited) {
        const ext = edited.type === 'image/webp' ? 'webp' : 'jpg';
        const name = baseName(pathEl && pathEl.textContent) + '-edited-' + Date.now().toString(36) + '.' + ext;
        giveToField(section, new File([edited], name, {type: edited.type}));
      }
    } catch (e) {
      alert((e && e.message) || 'Sorry, something went wrong while editing this photo.');
    } finally { button.disabled = false; label.textContent = old; }
  };

  const enhance = () => {
    document.querySelectorAll('section[data-field-type="image"]').forEach(section => {
      const replace = section.querySelector('.filled button[aria-label^="Replace"], .filled button[data-label="Replace"]');
      if (!replace || replace.parentElement.querySelector('.tpe-edit-btn')) return;
      const btn = replace.cloneNode(true);   // same look as Sveltia's own "Replace" button
      btn.classList.add('tpe-edit-btn');
      btn.removeAttribute('aria-controls'); btn.setAttribute('aria-label', 'Edit photo (crop, rotate, colour)'); btn.dataset.label = 'Edit photo';
      const text = btn.querySelector('.truncated-text') || btn.querySelector('.label') || btn;
      text.textContent = 'Edit photo';
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); editField(section, btn); });
      replace.after(btn);
    });
  };

  if (window.MutationObserver) {
    let queued = false;
    new MutationObserver(() => { if (!queued) { queued = true; setTimeout(() => { queued = false; enhance(); }, 60); } })
      .observe(document.documentElement, {childList: true, subtree: true});
  }
  enhance();
})();
