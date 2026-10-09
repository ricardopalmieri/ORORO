/* =========================================================================
   OROЯO — EDITOR de salas (tipo editor do three.js)
   -------------------------------------------------------------------------
   Carrega rooms/data/<sala>.json, renderiza a cena com os MESMOS builders da
   engine, permite selecionar objetos (clique na cena), editar transformação
   geral (posição/rotação/escala) e todos os parâmetros do tipo, além dos
   textos (título/corpo pt/en) dos objetos clicáveis e do objeto central.
   Exporta o JSON atualizado da sala e o HTML enxuto correspondente.

   Reaproveita ororo-core.js: buildProp, buildRelic, createFloorMaterial,
   buildBoundary, buildFireflies.
   ========================================================================= */
import {
  THREE, buildProp, buildRelic, createFloorMaterial, buildBoundary, buildFireflies,
} from './ororo-core.js?v=38';

const $ = (sel) => document.querySelector(sel);

/* ---- heurística de widget por nome/valor de campo ---------------------- */
const COLOR_KEYS = new Set([
  'accent', 'accent2', 'glow', 'tint', 'base', 'itemTint', 'colorA', 'colorB',
  'colorDeep', 'fog', 'eyeColor',
]);
function isColorKey(k) { return COLOR_KEYS.has(k) || /color/i.test(k); }

const TYPE_LIST = [
  'vitrine', 'totem', 'cable', 'shard', 'mirror-shard', 'panel', 'pedestal',
  'bones', 'root', 'banner', 'table', 'chair-ghost', 'tank', 'pillar',
  'speaker', 'rock', 'plant', 'palm', 'lowpoly-jaguar', 'fish-school', 'oil-blob',
];
const CENTRAL_TYPES = [
  'egg', 'core', 'jaguar', 'astrolabe', 'drill', 'villa-table', 'radio',
  'mirror-monolith', 'heart', 'shell', 'constellation', 'bowl', 'mask',
  'fusion', 'roots-core', 'ghost-pack', 'cosmic-dissolve',
];

/* defaults mínimos ao adicionar um objeto novo */
function defaultSpec(type) {
  const s = { type, position: [0, 0, -4], rotation: [0, 0, 0] };
  if (type === 'vitrine') Object.assign(s, { size: [0.9, 1.3, 0.9], accent: '#0E8C86' });
  if (type === 'totem') Object.assign(s, { accent: '#243B8F', height: 3.0, segments: 4 });
  if (type === 'plant') Object.assign(s, { accent: '#14603a', glow: '#B7F03B', count: 8, height: 1.2 });
  if (type === 'palm') Object.assign(s, { accent: '#14603a', glow: '#B7F03B', height: 3.2, fronds: 7 });
  if (type === 'lowpoly-jaguar') Object.assign(s, { base: '#070809', glow: '#B7F03B', bodyScale: 1 });
  if (type === 'fish-school') Object.assign(s, { count: 6, glow: '#0E8C86' });
  if (type === 'oil-blob') Object.assign(s, { radius: 1.0, glow: '#4B1F68' });
  if (type === 'tank') Object.assign(s, { radius: 0.42, height: 1.5, colorA: '#0E8C86', colorB: '#4B1F68', glow: '#B7F03B' });
  return s;
}

/* =========================================================================
   estado
   ========================================================================= */
let renderer, scene, camera, raycaster;
let roomData = null;            // { id, stage, name, scene, props, central }
let propGroups = [];            // [{ group, index }]
let relic = null;               // { group, update, interactRadius }
let floorMat = null;
let selection = { kind: null, index: -1 }; // 'prop'|'central'|'scene'
let boxHelper = null;
let dynamicMats = [];           // materiais com uTime/uCameraPos

const clock = new THREE.Clock();

/* órbita simples da câmera */
const orbit = { target: new THREE.Vector3(0, 1, -3), yaw: 0.3, pitch: -0.25, dist: 12 };
function updateCamera() {
  const cp = orbit.pitch, cy = orbit.yaw;
  const x = orbit.target.x + orbit.dist * Math.cos(cp) * Math.sin(cy);
  const y = orbit.target.y + orbit.dist * Math.sin(-cp);
  const z = orbit.target.z + orbit.dist * Math.cos(cp) * Math.cos(cy);
  camera.position.set(x, y, z);
  camera.lookAt(orbit.target);
}

/* =========================================================================
   cena
   ========================================================================= */
export async function initEditor() {
  const canvas = $('#edit-canvas');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  scene = new THREE.Scene();
  scene.background = new THREE.Color('#05070c');
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  raycaster = new THREE.Raycaster();

  resize();
  window.addEventListener('resize', resize);
  wireOrbit(canvas);
  wireSelection(canvas);

  await loadRoomList();
  animate();
}

function resize() {
  const wrap = $('#viewport');
  const w = wrap.clientWidth, h = wrap.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function clearScene() {
  [...scene.children].forEach((c) => scene.remove(c));
  propGroups = []; relic = null; floorMat = null; dynamicMats = [];
  if (boxHelper) { boxHelper = null; }
}

function collectDynamic(obj) {
  obj.traverse((o) => {
    const u = o.material && o.material.uniforms;
    if (u && (u.uTime || u.uCameraPos)) dynamicMats.push(o.material);
  });
}

function buildLights(sc) {
  const s = roomData.scene || {};
  scene.add(new THREE.AmbientLight(new THREE.Color(s.ambient?.color || '#1a2230'), (s.ambient?.intensity ?? 0.85) * 1.5));
  scene.add(new THREE.HemisphereLight(new THREE.Color(s.accent2 || '#243B8F'), new THREE.Color('#090c14'), 1.0));
  const fill = new THREE.DirectionalLight('#c8d0e2', 0.5); fill.position.set(2, 9, 3); scene.add(fill);
  if (s.keyLight) {
    const k = new THREE.PointLight(new THREE.Color(s.keyLight.color || s.accent), (s.keyLight.intensity ?? 4) * 1.4, s.keyLight.distance ?? 15, 2);
    k.position.set(...(s.keyLight.position || [0, 5, 2])); scene.add(k);
  }
  /* luzes de apoio para enxergar bem no editor */
  const p1 = new THREE.PointLight('#ffffff', 0.5, 40); p1.position.set(0, 8, 6); scene.add(p1);
}

function buildFloor() {
  const s = roomData.scene || {};
  const boundaryRadius = s.boundary?.radius ?? 13;
  floorMat = createFloorMaterial(Object.assign({ fogColor: s.fog, fogDensity: 0 }, s.floor || {}));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(boundaryRadius + 3, 48), floorMat);
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const boundary = buildBoundary(boundaryRadius, { glow: s.boundary?.glow || s.accent || '#0E8C86', height: s.boundary?.height });
  scene.add(boundary);
  const fireflies = buildFireflies(Object.assign({ radius: boundaryRadius - 1 }, s.fireflies || {}));
  scene.add(fireflies.points); dynamicMats.push(fireflies.mat);
}

function buildProps() {
  (roomData.props || []).forEach((spec, i) => addPropGroup(spec, i));
}
function addPropGroup(spec, i) {
  const g = buildProp(spec);
  g.userData.editorIndex = i;
  collectDynamic(g);
  scene.add(g);
  propGroups[i] = { group: g, index: i };
}
function rebuildProp(i) {
  const old = propGroups[i];
  if (old) scene.remove(old.group);
  addPropGroup(roomData.props[i], i);
  if (selection.kind === 'prop' && selection.index === i) highlight(propGroups[i].group);
}

function buildCentral() {
  const c = Object.assign({}, roomData.central || { type: 'egg' });
  relic = buildRelic(c);
  scene.add(relic.group);
  collectDynamic(relic.group);
}
function rebuildCentral() {
  if (relic) scene.remove(relic.group);
  buildCentral();
  if (selection.kind === 'central') highlight(relic.group);
}

/* =========================================================================
   carregar / trocar sala
   ========================================================================= */
async function loadRoomList() {
  let ids = [];
  try {
    const res = await fetch('./rooms/data/rooms.json');
    ids = (await res.json()).rooms || [];
  } catch (e) { console.warn('sem rooms.json', e); }
  const sel = $('#room-select');
  sel.innerHTML = ids.map((id) => `<option value="${id}">${id}</option>`).join('');
  sel.addEventListener('change', () => loadRoom(sel.value));
  if (ids.length) await loadRoom(ids[0]);
}

async function loadRoom(id) {
  const res = await fetch(`./rooms/data/${id}.json`);
  roomData = await res.json();
  clearScene();
  buildLights();
  buildFloor();
  buildProps();
  buildCentral();
  /* centraliza a órbita na sala */
  orbit.target.set(0, 1, -3); orbit.dist = (roomData.scene?.boundary?.radius ?? 13) * 0.9; orbit.yaw = 0.3; orbit.pitch = -0.25;
  updateCamera();
  selectScene();
  $('#room-title').textContent = `${id}  ·  ${roomData.name?.pt || ''}`;
}

/* =========================================================================
   seleção + destaque
   ========================================================================= */
function highlight(group) {
  if (boxHelper) scene.remove(boxHelper);
  boxHelper = new THREE.BoxHelper(group, 0xB7F03B);
  scene.add(boxHelper);
}
function clearHighlight() { if (boxHelper) { scene.remove(boxHelper); boxHelper = null; } }

function selectProp(i) { selection = { kind: 'prop', index: i }; highlight(propGroups[i].group); buildInspector(); }
function selectCentral() { selection = { kind: 'central', index: -1 }; highlight(relic.group); buildInspector(); }
function selectScene() { selection = { kind: 'scene', index: -1 }; clearHighlight(); buildInspector(); }

function wireSelection(canvas) {
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y);
    down = null;
    if (moved > 5) return; // foi arraste de câmera
    const rect = canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(scene.children, true);
    for (const h of hits) {
      /* central? */
      let o = h.object;
      let isRelic = false, idx = -1;
      while (o) {
        if (relic && o === relic.group) { isRelic = true; break; }
        if (o.userData && o.userData.editorIndex !== undefined) { idx = o.userData.editorIndex; break; }
        o = o.parent;
      }
      if (isRelic) { selectCentral(); return; }
      if (idx >= 0) { selectProp(idx); return; }
    }
  });
}

/* =========================================================================
   órbita da câmera
   ========================================================================= */
function wireOrbit(canvas) {
  let mode = null, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => {
    mode = e.button === 2 || e.shiftKey ? 'pan' : 'rot';
    lx = e.clientX; ly = e.clientY;
  });
  window.addEventListener('pointermove', (e) => {
    if (!mode) return;
    const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
    if (mode === 'rot') {
      orbit.yaw -= dx * 0.005; orbit.pitch += dy * 0.005;
      orbit.pitch = Math.max(-1.4, Math.min(1.4, orbit.pitch));
    } else {
      const panScale = orbit.dist * 0.0016;
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
      orbit.target.addScaledVector(right, -dx * panScale);
      orbit.target.addScaledVector(up, dy * panScale);
    }
    updateCamera();
  });
  window.addEventListener('pointerup', () => { mode = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    orbit.dist = Math.max(2, Math.min(60, orbit.dist * (1 + Math.sign(e.deltaY) * 0.08)));
    updateCamera();
  }, { passive: false });
}

/* =========================================================================
   inspetor
   ========================================================================= */
function fieldRow(label, inputEl) {
  const row = document.createElement('div'); row.className = 'insp-row';
  const l = document.createElement('label'); l.textContent = label; l.className = 'insp-label';
  row.append(l, inputEl); return row;
}
function numInput(val, onChange, step = 0.1) {
  const i = document.createElement('input'); i.type = 'number'; i.step = step; i.value = val ?? 0;
  i.addEventListener('input', () => onChange(parseFloat(i.value)));
  return i;
}
function vecInputs(arr, onChange, step = 0.1, n = 3) {
  const wrap = document.createElement('div'); wrap.className = 'insp-vec';
  const a = (arr && arr.slice()) || new Array(n).fill(0);
  for (let k = 0; k < n; k++) {
    const i = document.createElement('input'); i.type = 'number'; i.step = step; i.value = a[k] ?? 0;
    i.addEventListener('input', () => { a[k] = parseFloat(i.value); onChange(a.slice()); });
    wrap.append(i);
  }
  return wrap;
}
function colorInput(val, onChange) {
  const i = document.createElement('input'); i.type = 'color'; i.value = toHex(val || '#0E8C86');
  i.addEventListener('input', () => onChange(i.value));
  return i;
}
function textInput(val, onChange, area = false) {
  const i = document.createElement(area ? 'textarea' : 'input');
  if (!area) i.type = 'text';
  i.value = val ?? '';
  i.addEventListener('input', () => onChange(i.value));
  return i;
}
function toHex(c) {
  if (typeof c === 'string' && c[0] === '#') return c.length === 7 ? c : '#0E8C86';
  return '#0E8C86';
}

function buildInspector() {
  const box = $('#inspector'); box.innerHTML = '';
  if (selection.kind === 'scene') return buildSceneInspector(box);
  if (selection.kind === 'central') return buildObjectInspector(box, roomData.central, true);
  if (selection.kind === 'prop') return buildObjectInspector(box, roomData.props[selection.index], false);
}

function buildSceneInspector(box) {
  const s = roomData.scene || (roomData.scene = {});
  const h = document.createElement('h3'); h.textContent = 'SALA / CENA'; box.append(h);

  box.append(fieldRow('id', textInput(roomData.id, (v) => { roomData.id = v; })));
  box.append(fieldRow('stage', numInput(roomData.stage, (v) => { roomData.stage = v; }, 1)));
  box.append(fieldRow('nome (pt)', textInput(roomData.name?.pt, (v) => { roomData.name = roomData.name || {}; roomData.name.pt = v; })));
  box.append(fieldRow('nome (en)', textInput(roomData.name?.en, (v) => { roomData.name = roomData.name || {}; roomData.name.en = v; })));

  const sep = document.createElement('div'); sep.className = 'insp-sep'; sep.textContent = 'parâmetros da cena'; box.append(sep);
  box.append(fieldRow('accent', colorInput(s.accent, (v) => { s.accent = v; softReload(); })));
  box.append(fieldRow('accent2', colorInput(s.accent2, (v) => { s.accent2 = v; softReload(); })));
  box.append(fieldRow('fog', colorInput(s.fog, (v) => { s.fog = v; })));
  box.append(fieldRow('fogDensity', numInput(s.fogDensity, (v) => { s.fogDensity = v; }, 0.005)));
  box.append(fieldRow('exposure', numInput(s.exposure ?? 1.25, (v) => { s.exposure = v; renderer.toneMappingExposure = v * 1.25; }, 0.05)));
  s.ambient = s.ambient || {};
  box.append(fieldRow('ambient int.', numInput(s.ambient.intensity ?? 0.85, (v) => { s.ambient.intensity = v; softReload(); }, 0.05)));
  s.boundary = s.boundary || {};
  box.append(fieldRow('raio da sala', numInput(s.boundary.radius ?? 13, (v) => { s.boundary.radius = v; softReload(); }, 0.5)));
  s.spawn = s.spawn || { position: [0, 1.65, 8] };
  box.append(fieldRow('spawn pos', vecInputs(s.spawn.position, (v) => { s.spawn.position = v; }, 0.1)));
  s.audio = s.audio || {};
  box.append(fieldRow('audio intensity', numInput(s.audio.intensity ?? 0.55, (v) => { s.audio.intensity = v; }, 0.02)));

  const hint = document.createElement('p'); hint.className = 'insp-hint';
  hint.textContent = 'Clique num objeto na cena para editá-lo. Arraste = orbitar · Shift/botão direito = pan · scroll = zoom.';
  box.append(hint);
}

function buildObjectInspector(box, spec, isCentral) {
  const h = document.createElement('h3');
  h.textContent = isCentral ? 'OBJETO CENTRAL' : `OBJETO #${selection.index}`;
  box.append(h);

  /* tipo */
  const typeSel = document.createElement('select');
  (isCentral ? CENTRAL_TYPES : TYPE_LIST).forEach((t) => {
    const o = document.createElement('option'); o.value = t; o.textContent = t; if (t === spec.type) o.selected = true; typeSel.append(o);
  });
  typeSel.addEventListener('change', () => { spec.type = typeSel.value; isCentral ? rebuildCentral() : rebuildProp(selection.index); });
  box.append(fieldRow('tipo', typeSel));

  /* transform */
  const sepT = document.createElement('div'); sepT.className = 'insp-sep'; sepT.textContent = 'transformação'; box.append(sepT);
  box.append(fieldRow('posição', vecInputs(spec.position, (v) => { spec.position = v; applyTransformLive(spec, isCentral); }, 0.1)));
  box.append(fieldRow('rotação', vecInputs(spec.rotation, (v) => { spec.rotation = v; applyTransformLive(spec, isCentral); }, 0.05)));
  const scaleVal = Array.isArray(spec.scale) ? spec.scale : [spec.scale ?? 1, spec.scale ?? 1, spec.scale ?? 1];
  box.append(fieldRow('escala', vecInputs(scaleVal, (v) => { spec.scale = v; applyTransformLive(spec, isCentral); }, 0.05)));

  /* parâmetros do tipo (todos os campos que não sejam sistema) */
  const skip = new Set(['type', 'position', 'rotation', 'scale', 'info', 'content', 'title', 'body', 'choices']);
  const sepP = document.createElement('div'); sepP.className = 'insp-sep'; sepP.textContent = 'parâmetros'; box.append(sepP);
  Object.keys(spec).forEach((k) => {
    if (skip.has(k)) return;
    const val = spec[k];
    let input;
    if (isColorKey(k) && typeof val === 'string') input = colorInput(val, (v) => { spec[k] = v; rebuildCurrent(isCentral); });
    else if (typeof val === 'number') input = numInput(val, (v) => { spec[k] = v; rebuildCurrent(isCentral); }, 0.05);
    else if (Array.isArray(val)) input = vecInputs(val, (v) => { spec[k] = v; rebuildCurrent(isCentral); }, 0.05, val.length);
    else if (typeof val === 'string') input = textInput(val, (v) => { spec[k] = v; rebuildCurrent(isCentral); });
    else return;
    box.append(fieldRow(k, input));
  });

  /* adicionar parâmetro conhecido ainda não presente */
  const addWrap = document.createElement('div'); addWrap.className = 'insp-add';
  const addKey = document.createElement('input'); addKey.placeholder = 'novo parâmetro (ex: glow, height)';
  const addBtn = document.createElement('button'); addBtn.textContent = '+';
  addBtn.addEventListener('click', () => {
    const k = addKey.value.trim(); if (!k || k in spec) return;
    spec[k] = isColorKey(k) ? '#0E8C86' : 0;
    rebuildCurrent(isCentral); buildInspector();
  });
  addWrap.append(addKey, addBtn); box.append(addWrap);

  /* texto (clicáveis e central) */
  const sepC = document.createElement('div'); sepC.className = 'insp-sep'; sepC.textContent = 'texto / conteúdo'; box.append(sepC);
  if (!isCentral) {
    box.append(fieldRow('info (id)', textInput(spec.info, (v) => { spec.info = v || undefined; })));
  }
  const content = isCentral ? spec : (spec.content = spec.content || {});
  content.title = content.title || { pt: '', en: '' };
  content.body = content.body || { pt: '', en: '' };
  box.append(fieldRow('título pt', textInput(content.title.pt, (v) => { content.title.pt = v; })));
  box.append(fieldRow('título en', textInput(content.title.en, (v) => { content.title.en = v; })));
  box.append(fieldRow('corpo pt', textInput(content.body.pt, (v) => { content.body.pt = v; }, true)));
  box.append(fieldRow('corpo en', textInput(content.body.en, (v) => { content.body.en = v; }, true)));

  /* escolhas (só central) */
  if (isCentral && Array.isArray(spec.choices)) {
    const sepCh = document.createElement('div'); sepCh.className = 'insp-sep'; sepCh.textContent = 'verbos (escolhas)'; box.append(sepCh);
    spec.choices.forEach((ch, ci) => {
      ch.verb = ch.verb || { pt: '', en: '' };
      ch.detail = ch.detail || { pt: '', en: '' };
      const card = document.createElement('div'); card.className = 'insp-choice';
      const t = document.createElement('div'); t.className = 'insp-choice-t'; t.textContent = 'verbo ' + (ci + 1); card.append(t);
      card.append(fieldRow('verbo pt', textInput(ch.verb.pt, (v) => { ch.verb.pt = v; })));
      card.append(fieldRow('verbo en', textInput(ch.verb.en, (v) => { ch.verb.en = v; })));
      card.append(fieldRow('detalhe pt', textInput(ch.detail.pt, (v) => { ch.detail.pt = v; })));
      card.append(fieldRow('próx. sala', textInput(ch.next, (v) => { ch.next = v; })));
      box.append(card);
    });
  }

  /* ações */
  if (!isCentral) {
    const sepA = document.createElement('div'); sepA.className = 'insp-sep'; box.append(sepA);
    const del = document.createElement('button'); del.className = 'insp-danger'; del.textContent = 'excluir objeto';
    del.addEventListener('click', () => deleteProp(selection.index));
    box.append(del);
  }
}

function applyTransformLive(spec, isCentral) {
  const g = isCentral ? relic.group : propGroups[selection.index].group;
  const p = spec.position || [0, 0, 0], r = spec.rotation || [0, 0, 0];
  const s = spec.scale ?? 1;
  g.position.set(p[0], p[1], p[2]);
  g.rotation.set(r[0], r[1], r[2]);
  if (Array.isArray(s)) g.scale.set(s[0], s[1], s[2]); else g.scale.setScalar(s);
  if (boxHelper) boxHelper.update();
}
function rebuildCurrent(isCentral) { isCentral ? rebuildCentral() : rebuildProp(selection.index); }

function deleteProp(i) {
  scene.remove(propGroups[i].group);
  roomData.props.splice(i, 1);
  clearScene(); buildLights(); buildFloor(); buildProps(); buildCentral();
  selectScene();
}

function addObject(type) {
  roomData.props = roomData.props || [];
  const spec = defaultSpec(type);
  roomData.props.push(spec);
  const i = roomData.props.length - 1;
  addPropGroup(spec, i);
  selectProp(i);
}

/* =========================================================================
   soft reload (mudanças de cena que exigem reconstruir tudo)
   ========================================================================= */
function softReload() {
  const sel = selection;
  clearScene(); buildLights(); buildFloor(); buildProps(); buildCentral();
  selection = sel;
  if (sel.kind === 'prop' && propGroups[sel.index]) highlight(propGroups[sel.index].group);
  else if (sel.kind === 'central') highlight(relic.group);
}

/* =========================================================================
   exportar
   ========================================================================= */
function download(name, text) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportJSON() {
  download(`${roomData.id}.json`, JSON.stringify(roomData, null, 2));
}
function exportHTML() {
  const id = roomData.id;
  const html = `<!doctype html>
<html lang="pt-BR" data-room="${id}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>OROЯO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="../style.css" />
  <link rel="stylesheet" href="../multiplayer/style.css?v=38" />
  <script type="importmap">
    { "imports": { "three": "../assets/js/three.module.js" } }
  <\/script>
</head>
<body class="ororo-room">
  <canvas id="scene-canvas" tabindex="0"></canvas>
  <script type="module">
    import { initRoom } from '../ororo-core.js?v=38';
    initRoom({ dataPath: './data/${id}.json' });
  <\/script>
</body>
</html>
`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${id}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================================
   loop
   ========================================================================= */
function animate() {
  requestAnimationFrame(animate);
  const t = clock.elapsedTime;
  if (floorMat?.uniforms) { floorMat.uniforms.uTime.value = t; if (floorMat.uniforms.uCameraPos) floorMat.uniforms.uCameraPos.value.copy(camera.position); }
  dynamicMats.forEach((m) => {
    if (m.uniforms.uTime) m.uniforms.uTime.value = t;
    if (m.uniforms.uCameraPos) m.uniforms.uCameraPos.value.copy(camera.position);
  });
  if (relic && relic.update) relic.update(t, camera);
  if (boxHelper) boxHelper.update();
  renderer.render(scene, camera);
}

/* =========================================================================
   UI bindings do topo
   ========================================================================= */
export function wireToolbar() {
  const addSel = $('#add-select');
  TYPE_LIST.forEach((t) => { const o = document.createElement('option'); o.value = t; o.textContent = t; addSel.append(o); });
  $('#add-btn').addEventListener('click', () => addObject(addSel.value));
  $('#btn-scene').addEventListener('click', selectScene);
  $('#btn-export-json').addEventListener('click', exportJSON);
  $('#btn-export-html').addEventListener('click', exportHTML);
}
