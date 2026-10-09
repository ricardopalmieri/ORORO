import { profile as avatarProfile, chooseAvatar, accessKey as avatarAccessKey } from './multiplayer/avatar.js?v=38';
import { connectRoom } from './multiplayer/client.js?v=38';
/* =========================================================================
   OROЯO — núcleo 3D / navegação / memória (rastros)
   -------------------------------------------------------------------------
   Módulo único, importado por cada sala (rooms/sala-XX-*.html).
   Cada sala chama `initRoom(config)` passando título, paleta, objetos de
   cena, frases, placas e o objeto central de decisão.

   Onde trocar por assets reais depois:
   - `buildProp()` e `buildRelic()` usam geometria + shaders procedurais.
     Para usar modelos .glb reais, troque o retorno dessas funções por um
     GLTFLoader e mantenha a mesma assinatura (recebe spec, devolve Object3D).
   - `makeWordmarkTexture()` / `makeGlitchTexture()` geram canvases em tempo
     de execução. Podem ser substituídas por `THREE.TextureLoader` apontando
     para arquivos em /assets/textures.
   - O áudio generativo está em `ororo-audio.js`. Pode ser trocado por
     faixas gravadas mantendo a API `start/stop/duck/unduck`.
   ========================================================================= */

import * as THREE from './assets/js/three.module.js';
import { EffectComposer } from './assets/js/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './assets/js/addons/postprocessing/RenderPass.js';
import { ShaderPass } from './assets/js/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from './assets/js/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './assets/js/addons/postprocessing/OutputPass.js';
import * as ORORO_AUDIO from './ororo-audio.js?v=38';
import { getAudioConfig } from './audio-config.js?v=38';

let ACTIVE_ROOM_HANDLE=null;
let ROOM_POPSTATE_BOUND=false;
let ROOM_NAV_BUSY=false;

async function navigateRoomDocument(nextHref,{push=true}={}){
  const target=new URL(nextHref,location.href);
  const match=target.pathname.match(/\/(sala-[a-z0-9-]+)\.html$/i);
  if(!match){location.href=target.href;return null;}
  if(ROOM_NAV_BUSY)return null;
  ROOM_NAV_BUSY=true;
  const roomId=match[1];
  const previous=ACTIVE_ROOM_HANDLE;
  try{
    if(push)history.pushState({ororoRoom:roomId},'',target.href);
    previous?.destroy?.({preserveMultiplayer:true});
    ACTIVE_ROOM_HANDLE=null;
    const next=await initRoom({dataPath:`./data/${roomId}.json`,autoEnter:true,internalTransition:true});
    return next;
  }catch(err){
    console.error('ORORO room transition:',err);
    location.href=target.href;
    return null;
  }finally{ROOM_NAV_BUSY=false;}
}

/* =========================================================================
   1. RASTROS — memória poética em localStorage
   ========================================================================= */

export const RASTRO_KEYS = ['oleo', 'sangue', 'raiz', 'ouro', 'espelho', 'voz', 'cinza'];

export const RASTRO_LABELS = {
  oleo: 'óleo',
  sangue: 'sangue',
  raiz: 'raiz',
  ouro: 'ouro',
  espelho: 'espelho',
  voz: 'voz',
  cinza: 'cinza',
};

export const RASTRO_COLORS = {
  oleo: '#0E8C86',
  sangue: '#C1121F',
  raiz: '#0F6F5C',
  ouro: '#C9A24A',
  espelho: '#243B8F',
  voz: '#872D67',
  cinza: '#858B94',
};

const RASTRO_STORE = 'ororo_rastros_v1';
const VISITED_STORE = 'ororo_visited_v1';
const PATH_STORE = 'ororo_path_v1';

export function getRastros() {
  let data = {};
  try { data = JSON.parse(localStorage.getItem(RASTRO_STORE)) || {}; } catch (e) { data = {}; }
  const out = {};
  RASTRO_KEYS.forEach((k) => { out[k] = data[k] || 0; });
  return out;
}

export function addRastros(map) {
  const cur = getRastros();
  Object.entries(map || {}).forEach(([k, v]) => {
    if (RASTRO_KEYS.includes(k)) cur[k] = (cur[k] || 0) + v;
  });
  localStorage.setItem(RASTRO_STORE, JSON.stringify(cur));
  return cur;
}

export function dominantRastro() {
  const r = getRastros();
  let best = null;
  let bestVal = 0;
  RASTRO_KEYS.forEach((k) => { if (r[k] > bestVal) { bestVal = r[k]; best = k; } });
  return best;
}

export function totalRastros() {
  const r = getRastros();
  return RASTRO_KEYS.reduce((a, k) => a + r[k], 0);
}

export function resetExperience() {
  localStorage.removeItem(RASTRO_STORE);
  localStorage.removeItem(VISITED_STORE);
  localStorage.removeItem(PATH_STORE);
}

export function markVisited(id) {
  let v = [];
  try { v = JSON.parse(localStorage.getItem(VISITED_STORE)) || []; } catch (e) { v = []; }
  if (!v.includes(id)) v.push(id);
  localStorage.setItem(VISITED_STORE, JSON.stringify(v));
  return v;
}

export function getVisited() {
  try { return JSON.parse(localStorage.getItem(VISITED_STORE)) || []; } catch (e) { return []; }
}

export function logChoice(roomId, verb) {
  let p = [];
  try { p = JSON.parse(localStorage.getItem(PATH_STORE)) || []; } catch (e) { p = []; }
  p.push({ room: roomId, verb, t: Date.now() });
  if (p.length > 64) p = p.slice(-64);
  localStorage.setItem(PATH_STORE, JSON.stringify(p));
  return p;
}

export function getPath() {
  try { return JSON.parse(localStorage.getItem(PATH_STORE)) || []; } catch (e) { return []; }
}

/* =========================================================================
   2. GLSL — ruído, fbm, paleta iridescente, névoa manual
   ========================================================================= */

export const GLSL_NOISE = /* glsl */`
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

/* fbm "completo" (3 oitavas) - usado em deslocamento de vértice (poucos
   vértices, custo desprezível) */
float fbm(vec3 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<3;i++){ v += a*snoise(p); p = p*2.03 + 7.0; a *= 0.5; }
  return v;
}

/* fbm "leve" (2 oitavas) - usado por fragment shaders que cobrem grandes
   áreas da tela (piso). Mantém o aspecto orgânico com bem menos custo. */
float fbm2(vec3 p){
  float v = 0.0;
  float a = 0.5;
  for(int i=0;i<2;i++){ v += a*snoise(p); p = p*2.03 + 7.0; a *= 0.5; }
  return v;
}
`;

export const GLSL_PALETTE = /* glsl */`
vec3 oilPalette(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b * cos(6.28318 * (c * t + d));
}
`;

/* uniforms padrão de uma paleta iridescente "óleo" (mancha de óleo: teal,
   roxo, magenta e ouro circulando conforme ângulo / ruído / tempo) */
export function defaultPaletteUniforms(overrides = {}) {
  return Object.assign({
    uPalA: { value: new THREE.Color(0.07, 0.09, 0.13) },
    uPalB: { value: new THREE.Color(0.46, 0.42, 0.5) },
    uPalC: { value: new THREE.Color(1.0, 1.0, 1.0) },
    uPalD: { value: new THREE.Color(0.0, 0.33, 0.67) },
  }, overrides);
}

/* =========================================================================
   3. TEXTURAS PROCEDURAIS (canvas)
   ========================================================================= */

/* aceita string CSS ou THREE.Color e devolve sempre uma string CSS */
export function cssColor(c, fallback = '#0E8C86') {
  if (!c) return fallback;
  if (typeof c === 'string') return c;
  if (c.isColor) return `#${c.getHexString()}`;
  return fallback;
}

export function makeWordmarkTexture(text = 'OROЯO', opts = {}) {
  const w = opts.width || 1024;
  const h = opts.height || 512;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${opts.size || 150}px "Exo", "IBM Plex Sans", sans-serif`;
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, opts.colorA || '#E8E1D2');
  grad.addColorStop(0.5, opts.colorB || '#0E8C86');
  grad.addColorStop(1, opts.colorC || '#C9A24A');
  ctx.fillStyle = grad;
  ctx.shadowColor = opts.glow || '#0E8C86';
  ctx.shadowBlur = 40;
  ctx.fillText(text, w / 2, h / 2);
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/* textura tipo "painel de dados" - linhas de scan + ruído, para telas/painéis */
export function makeGlitchTexture(opts = {}) {
  const w = 256; const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = opts.bg || '#04060a';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = opts.line || 'rgba(14,140,134,0.5)';
  for (let y = 4; y < h; y += 7) {
    if (Math.random() > 0.55) continue;
    ctx.globalAlpha = 0.1 + Math.random() * 0.5;
    ctx.beginPath();
    const len = 20 + Math.random() * (w - 20);
    const x0 = Math.random() * (w - len);
    ctx.moveTo(x0, y);
    ctx.lineTo(x0 + len, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = opts.accent || 'rgba(183,240,59,0.6)';
  for (let i = 0; i < 14; i++) {
    const bw = 4 + Math.random() * 40;
    const bh = 1 + Math.random() * 3;
    ctx.fillRect(Math.random() * w, Math.random() * h, bw, bh);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* textura de ruído cinza para vidro/poeira/superfícies foscas */
export function makeNoiseTexture(size = 128, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v;
    img.data[i + 3] = opts.alpha ?? 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/* =========================================================================
   4. MATERIAIS PROCEDURAIS
   ========================================================================= */

/* --- 4.1 Piso: óleo / lama / vidro líquido com iridescência e névoa ----- */
export function createFloorMaterial(opts = {}) {
  const u = {
    uTime: { value: 0 },
    uColorDeep: { value: new THREE.Color(opts.colorDeep || '#05070a') },
    uColorA: { value: new THREE.Color(opts.colorA || '#0E8C86') },
    uColorB: { value: new THREE.Color(opts.colorB || '#243B8F') },
    uGlow: { value: new THREE.Color(opts.glow || '#B7F03B') },
    uGridColor: { value: new THREE.Color(opts.gridColor || '#1a1f2b') },
    uFogColor: { value: new THREE.Color(opts.fogColor || '#05070a') },
    uFogDensity: { value: opts.fogDensity ?? 0.05 },
    uCameraPos: { value: new THREE.Vector3() },
    uScale: { value: opts.scale ?? 0.12 },
    uLiquid: { value: opts.liquid ?? 0.6 },
    uVeins: { value: opts.veins ?? 0.0 },
    uCrack: { value: opts.crack ?? 0.0 },
    uGrid: { value: opts.grid ?? 0.35 },
    uGridScale: { value: opts.gridScale ?? 0.5 },
    ...defaultPaletteUniforms(opts.palette),
  };

  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      ${GLSL_NOISE}
      ${GLSL_PALETTE}
      varying vec3 vWorldPos;
      varying vec3 vNormalW;
      uniform float uTime;
      uniform vec3 uColorDeep, uColorA, uColorB, uGlow, uGridColor, uFogColor;
      uniform float uFogDensity, uScale, uLiquid, uVeins, uCrack, uGrid, uGridScale;
      uniform vec3 uCameraPos;
      uniform vec3 uPalA, uPalB, uPalC, uPalD;

      void main(){
        vec3 p = vWorldPos * uScale;

        /* apenas 2 chamadas de fbm leve (2 oitavas cada = 4 snoise no total,
           contra as 20 da versão anterior). A primeira define manchas de
           óleo amplas, a segunda (frequência mais alta) alimenta veios e
           trincas ao mesmo tempo, evitando ruído extra. */
        float warped = fbm2(p + vec3(0.0, 0.0, uTime*0.018));
        float w01 = warped*0.5 + 0.5;

        /* segundo campo, frequência baixa: vira "linhas de contorno"
           (veios/trincas) via fract(). Mais barato e menos serrilhado que
           ruído de alta frequência direto, e fácil de calibrar pela
           densidade (multiplicador) e espessura (largura do smoothstep).
           "zone" confina os padrões a algumas regiões do piso, evitando
           um tapete uniforme de linhas. */
        float fieldB = fbm2(p*0.9 + vec3(11.0, 0.0, -uTime*0.015));
        float zone = smoothstep(0.0, 0.4, w01) * smoothstep(1.0, 0.6, w01);

        /* base quase preta, com variação tonal mínima */
        vec3 base = uColorDeep * 1.6;
        base += uColorA * w01 * 0.1;
        base += uColorB * (fieldB*0.5+0.5) * 0.08;

        /* manchas de óleo: iridescência só aparece sobre poças localizadas,
           e só em ângulo raso (fresnel alto), como um filme fino sobre líquido */
        vec3 V = normalize(uCameraPos - vWorldPos);
        float fres = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 6.0);
        float oilPatch = smoothstep(0.52, 0.96, w01);
        float t = warped*0.8 + uTime*0.02;
        vec3 irid = oilPalette(t, uPalA, uPalB, uPalC, uPalD);
        base += irid * fres * oilPatch * uLiquid * 0.4;

        /* veios emissivos (raizes/circuitos): rede de linhas de contorno
           esparsas, confinadas às "zonas" */
        float veinLines = abs(fract(fieldB*1.6 + 0.5) - 0.5) * 2.0;
        float veins = (1.0 - smoothstep(0.0, 0.06, veinLines)) * zone * uVeins;
        base += uGlow * veins * (0.6 + 0.4*sin(uTime*1.6 + warped*6.0)) * 1.1;

        /* trincas: mesmo campo, frequência maior e linhas mais finas */
        float crackLines = abs(fract(fieldB*2.6 + 7.3) - 0.5) * 2.0;
        float cracks = (1.0 - smoothstep(0.0, 0.03, crackLines)) * uCrack;
        base = mix(base, uColorDeep*0.35, cracks*0.6);
        base += uGlow * cracks * 0.5;

        /* grade discreta de museu */
        vec2 gUv = vWorldPos.xz * uGridScale;
        vec2 gridF = abs(fract(gUv - 0.5) - 0.5) / fwidth(gUv);
        float gridLine = 1.0 - clamp(min(gridF.x, gridF.y), 0.0, 1.0);
        base = mix(base, uGridColor, gridLine * uGrid * 0.5);

        /* névoa exponencial manual */
        float dist = length(uCameraPos - vWorldPos);
        float fog = exp2(-uFogDensity*uFogDensity*dist*dist*1.442695);
        base = mix(uFogColor, base, clamp(fog, 0.0, 1.0));

        gl_FragColor = vec4(base, 1.0);
      }
    `,
  });
  mat.userData.isOroroFloor = true;
  return mat;
}

/* --- 4.2 Iridescente: relíquias, fragmentos, vitrines, espelhos --------
   Shader único reaproveitado por praticamente todo objeto "vivo" da
   galeria (relíquias, cacos, vitrines, espelhos líquidos). Isso mantém o
   projeto em apenas DOIS shaders pesados por cena (este + o piso), já que
   o programa GLSL é cacheado pelo Three.js a partir do código-fonte.

   opts.mirror = true ativa o "modo espelho": a superfície passa a
   amostrar uma textura (ex: OROЯO) com leve distorção líquida (via seno,
   sem ruído extra) por cima da base iridescente. */
export function createIridescentMaterial(opts = {}) {
  const u = {
    uTime: { value: 0 },
    uBase: { value: new THREE.Color(opts.base || '#11141B') },
    uGlow: { value: new THREE.Color(opts.glow || '#0E8C86') },
    uFresnelPower: { value: opts.fresnelPower ?? 2.2 },
    uPulse: { value: opts.pulse ?? 0.6 },
    uDisplace: { value: opts.displace ?? 0.0 },
    uCameraPos: { value: new THREE.Vector3() },
    uMirror: { value: opts.mirror ? 1 : 0 },
    uTex: { value: opts.texture || null },
    uHasTex: { value: opts.texture ? 1 : 0 },
    uDistort: { value: opts.distort ?? 0.05 },
    ...defaultPaletteUniforms(opts.palette),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: !!opts.transparent || !!opts.mirror,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? (opts.mirror ? THREE.DoubleSide : THREE.FrontSide),
    vertexShader: /* glsl */`
      ${GLSL_NOISE}
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      uniform float uTime, uDisplace;
      void main(){
        vUv = uv;
        vec3 pos = position;
        if(uDisplace > 0.0){
          float n = snoise(pos*1.6 + uTime*0.18);
          pos += normal * n * uDisplace;
        }
        vec4 wp = modelMatrix * vec4(pos, 1.0);
        vWorldPos = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      ${GLSL_PALETTE}
      varying vec3 vNormalW;
      varying vec3 vWorldPos;
      varying vec2 vUv;
      uniform float uTime, uFresnelPower, uPulse, uMirror, uHasTex, uDistort;
      uniform vec3 uBase, uGlow, uCameraPos;
      uniform vec3 uPalA, uPalB, uPalC, uPalD;
      uniform sampler2D uTex;
      void main(){
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 N = normalize(vNormalW);
        float fres = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
        float t = fres*0.7 + uTime*0.06;
        vec3 irid = oilPalette(t, uPalA, uPalB, uPalC, uPalD);
        float pulse = 0.5 + 0.5*sin(uTime*1.4);

        if(uMirror > 0.5){
          /* distorção líquida barata via senos (sem ruído extra) */
          vec2 uv = vUv;
          float w = sin(uv.y*9.0 + uTime*0.7)*0.5 + sin(uv.x*7.0 - uTime*0.5)*0.5;
          vec2 duv = clamp(uv + w * uDistort, 0.0, 1.0);
          vec3 col = mix(vec3(0.01,0.013,0.02), uBase, 0.4 + 0.2*w);
          if(uHasTex > 0.5){
            vec4 tex = texture2D(uTex, duv);
            col += tex.rgb * tex.a * 1.1;
          }
          /* fresnel fixo e bem contido: apenas um brilho de borda sutil,
             evita que a paleta de óleo (que inclui magenta/roxo) domine
             a superfície inteira em ângulos rasos */
          float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);
          col += irid * rim * 0.18;
          float edge = smoothstep(0.0,0.16,uv.x)*smoothstep(1.0,0.84,uv.x)*smoothstep(0.0,0.1,uv.y)*smoothstep(1.0,0.94,uv.y);
          col *= mix(0.4, 1.0, edge);
          gl_FragColor = vec4(col, 0.94);
          return;
        }

        /* sombreamento simples para dar volume ao objeto, complementar à
           iluminação real da cena (spots de galeria) */
        vec3 L = normalize(vec3(0.35, 0.65, 0.45));
        float diff = max(dot(N, L), 0.0);
        vec3 shaded = uBase * (0.35 + 0.65*diff);

        vec3 col = shaded + irid*fres*0.8 + uGlow*pulse*uPulse*0.4;
        gl_FragColor = vec4(col, ${opts.opacity !== undefined ? 'float(' + opts.opacity + ')' : '1.0'});
      }
    `,
  });
  mat.userData.isOroroIridescent = true;
  return mat;
}

/* --- 4.4 Pontos: vaga-lumes, fumaça, constelações ------------------------ */
export function createPointsMaterial(opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(opts.color || '#B7F03B') },
      uSize: { value: opts.size ?? 40 },
      uDrift: { value: opts.drift ?? 0.18 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aRand;
      uniform float uTime, uSize, uDrift;
      varying float vAlpha;
      void main(){
        vec3 p = position;
        p.x += sin(uTime*0.3 + aRand*6.2831) * uDrift;
        p.y += cos(uTime*0.22 + aRand*7.0) * uDrift * 0.6;
        p.z += sin(uTime*0.18 + aRand*4.0) * uDrift;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = max(-mv.z, 1.4);
        gl_PointSize = min(uSize / dist, 64.0) * (0.5 + 0.5*sin(uTime*2.0 + aRand*10.0));
        vAlpha = 0.35 + 0.65*(0.5+0.5*sin(uTime*1.6 + aRand*6.2831));
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uColor;
      varying float vAlpha;
      void main(){
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c);
        float a = smoothstep(0.5, 0.0, d) * vAlpha;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
}

/* =========================================================================
   5. KIT DE OBJETOS DE CENA (museu)
   -------------------------------------------------------------------------
   buildProp(spec) recebe { type, position, rotation, scale, ...params }
   e devolve um THREE.Group. Tudo é geometria procedural + materiais acima.
   Para substituir por modelos reais (.glb), troque o corpo de cada `case`
   mantendo a assinatura (retornar um Object3D já posicionado em (0,0,0),
   o posicionamento final é aplicado por buildProp()).
   ========================================================================= */

function v3(a, d = [0, 0, 0]) { return new THREE.Vector3(...(a || d)); }

/* =========================================================================
   ILUMINAÇÃO DE GALERIA
   -------------------------------------------------------------------------
   Cada "spot de museu" é composto por:
     1. um THREE.SpotLight real, que ilumina objetos de material padrão
        (vitrines, totens, painéis...) — efeito de "obra iluminada";
     2. uma poça de luz no piso (textura radial gerada em canvas, aditiva,
        sem shader próprio) que marca visualmente onde o facho incide.
   Ambos custam pouco: 1 luz + 1 plano com textura pequena reaproveitada.
   ========================================================================= */
let _glowTexCache = null;
function getGlowTexture() {
  if (_glowTexCache) return _glowTexCache;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  _glowTexCache = new THREE.CanvasTexture(canvas);
  return _glowTexCache;
}

function buildLightPool(color, radius, opacity = 0.4) {
  const mat = new THREE.MeshBasicMaterial({
    map: getGlowTexture(), color, transparent: true, opacity,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 24), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.018;
  mesh.renderOrder = 1;
  return mesh;
}

/* spot de galeria: luz focada + poça de luz no piso, pronta para apontar
   para uma relíquia ou vitrine. retorna um Group posicionável. */
function buildGallerySpot(color, opts = {}) {
  const spot = new THREE.SpotLight(
    color,
    opts.intensity ?? 8,
    opts.distance ?? 8,
    opts.angle ?? Math.PI / 9,
    opts.penumbra ?? 0.5,
    opts.decay ?? 1.6
  );
  spot.position.set(0, opts.height ?? 3.2, 0);
  const target = new THREE.Object3D();
  spot.target = target;
  const group = new THREE.Group();
  group.add(spot, target);
  if (opts.pool !== false) {
    const radius = (opts.height ?? 3.2) * Math.tan(opts.angle ?? Math.PI / 9) * (opts.poolScale ?? 1.0);
    const pool = buildLightPool(color, radius, opts.poolOpacity ?? 0.3);
    group.add(pool);
  }
  return group;
}

function applyTransform(obj, spec) {
  const p = spec.position || [0, 0, 0];
  const r = spec.rotation || [0, 0, 0];
  const s = spec.scale ?? 1;
  obj.position.set(p[0], p[1], p[2]);
  obj.rotation.set(r[0], r[1], r[2]);
  if (Array.isArray(s)) obj.scale.set(s[0], s[1], s[2]);
  else obj.scale.setScalar(s);
  return obj;
}

/* pequena coleção de geometrias "fragmento" para vitrines/destroços */
const SHARD_GEOMETRIES = [
  () => new THREE.IcosahedronGeometry(0.32, 0),
  () => new THREE.OctahedronGeometry(0.32, 0),
  () => new THREE.TetrahedronGeometry(0.36, 0),
  () => new THREE.TorusGeometry(0.26, 0.08, 8, 16),
  () => new THREE.DodecahedronGeometry(0.28, 0),
];

function makeShardMesh(tint, glow, scale = 1, displace = 0.05) {
  const geo = SHARD_GEOMETRIES[Math.floor(Math.random() * SHARD_GEOMETRIES.length)]();
  const mat = createIridescentMaterial({ base: tint, glow, displace, fresnelPower: 1.6, pulse: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.scale.setScalar(scale);
  mesh.userData.spin = (Math.random() - 0.5) * 0.4;
  mesh.userData.bobSpeed = 0.6 + Math.random() * 0.8;
  mesh.userData.bobPhase = Math.random() * Math.PI * 2;
  mesh.userData.baseY = 0;
  return mesh;
}

/* vitrine: caixa de vidro + pedestal + objeto suspenso */
function propVitrine(spec) {
  const g = new THREE.Group();
  const w = spec.size?.[0] ?? 0.9;
  const h = spec.size?.[1] ?? 1.4;
  const d = spec.size?.[2] ?? 0.9;
  const accent = spec.accent || '#0E8C86';

  const baseMat = new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.75, metalness: 0.2 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(w * 1.08, 0.12, d * 1.08), baseMat);
  base.position.y = 0.06;
  g.add(base);

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0c1118', roughness: 0.06, metalness: 0,
    transmission: 0.92, thickness: 0.4, transparent: true, opacity: 0.32,
    envMapIntensity: 0.6, side: THREE.DoubleSide,
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMat);
  glass.position.y = 0.12 + h / 2;
  g.add(glass);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(glass.geometry),
    new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.35 })
  );
  edges.position.copy(glass.position);
  g.add(edges);

  const item = makeShardMesh(spec.itemTint || '#11141B', accent, spec.itemScale || 0.5, spec.displace ?? 0.06);
  item.position.y = 0.12 + h * 0.42;
  item.userData.baseY = item.position.y;
  g.add(item);
  g.userData.animated = [item];

  /* glow interno (colorido, baixo) + spot de galeria por cima (neutro,
     quente) iluminando a peça como em uma vitrine real */
  const light = new THREE.PointLight(accent, 0.7, 3.2, 2);
  light.position.set(0, 0.12 + h * 0.7, 0);
  g.add(light);

  const galleryColor = new THREE.Color('#E7E3D8').lerp(new THREE.Color(accent), 0.18);
  const spotGroup = buildGallerySpot(galleryColor, {
    height: h + 1.6, intensity: 11, distance: h + 3.4, angle: Math.PI / 9, penumbra: 0.6, poolOpacity: 0.4,
  });
  spotGroup.children[1].position.set(0, item.position.y, 0); // target
  g.add(spotGroup);

  return g;
}

/* totem: coluna empilhada com faixas emissivas */
function propTotem(spec) {
  const g = new THREE.Group();
  const accent = spec.accent || '#0F6F5C';
  const height = spec.height ?? 2.4;
  const segs = spec.segments ?? 4;
  const radius = spec.radius ?? 0.22;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const segH = height / segs;
    const mat = new THREE.MeshStandardMaterial({
      color: i % 2 === 0 ? '#11141B' : '#0a0c11',
      roughness: 0.7, metalness: 0.35,
    });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * (1 - i * 0.06), radius * (1 - (i - 1) * 0.06 * (i > 0 ? 1 : 0)), segH * 0.92, 8), mat);
    mesh.position.y = y + segH / 2;
    g.add(mesh);
    if (i % 2 === 1 || spec.allBands) {
      const band = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 1.04, radius * 1.04, 0.05, 8),
        new THREE.MeshBasicMaterial({ color: accent })
      );
      band.position.y = y + segH;
      g.add(band);
    }
    y += segH;
  }
  const light = new THREE.PointLight(accent, 0.9, 2.6, 2);
  light.position.y = height * 0.6;
  g.add(light);
  return g;
}

/* cabo suspenso (curva pendurada) */
function propCable(spec) {
  const from = v3(spec.from, [-1, 3, 0]);
  const to = v3(spec.to, [1, 3, 0]);
  const sag = spec.sag ?? 0.8;
  const mid = from.clone().add(to).multiplyScalar(0.5);
  mid.y -= sag;
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  const geo = new THREE.TubeGeometry(curve, 24, spec.radius ?? 0.025, 6, false);
  const mat = new THREE.MeshStandardMaterial({ color: spec.color || '#0a0a0c', roughness: 0.85, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  const g = new THREE.Group();
  g.add(mesh);
  if (spec.glow) {
    const glowMat = new THREE.MeshBasicMaterial({ color: spec.glow });
    const stripeGeo = new THREE.TubeGeometry(curve, 24, (spec.radius ?? 0.025) * 0.35, 6, false);
    g.add(new THREE.Mesh(stripeGeo, glowMat));
  }
  return g;
}

/* fragmento flutuante isolado (escamas, ossos, metal, vidro) */
function propShard(spec) {
  const g = new THREE.Group();
  const mesh = makeShardMesh(spec.tint || '#11141B', spec.glow || '#0E8C86', spec.itemScale || 0.4, spec.displace ?? 0.05);
  g.add(mesh);
  g.userData.animated = [mesh];
  return g;
}

/* espelho rachado / fragmento de vidro com shader líquido */
function propMirrorShard(spec) {
  const w = spec.size?.[0] ?? 0.9;
  const h = spec.size?.[1] ?? 1.6;
  const geo = new THREE.PlaneGeometry(w, h, 1, 1);
  const mat = createIridescentMaterial({ mirror: true, base: spec.tint || '#243B8F', glow: spec.tint || '#243B8F', texture: spec.texture, distort: spec.distort ?? 0.05, fresnelPower: 1.6 });
  const mesh = new THREE.Mesh(geo, mat);
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.shaderMats = [mat];
  if (spec.frame !== false) {
    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: spec.tint || '#243B8F', transparent: true, opacity: 0.4 })
    );
    g.add(frame);
  }
  return g;
}

/* painel/tela com textura tipo "dados" */
function propPanel(spec) {
  const w = spec.size?.[0] ?? 1.1;
  const h = spec.size?.[1] ?? 1.6;
  const tex = makeGlitchTexture({ accent: spec.accent || 'rgba(183,240,59,0.6)', line: spec.line });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: spec.opacity ?? 0.85 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const g = new THREE.Group();
  g.add(mesh);
  const frameMat = new THREE.MeshStandardMaterial({ color: '#05060a', roughness: 0.6, metalness: 0.4 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.04), frameMat);
  frame.position.z = -0.03;
  g.add(frame);
  g.userData.glitchTex = tex;
  return g;
}

/* pedestal com luz spot */
function propPedestal(spec) {
  const g = new THREE.Group();
  const accent = spec.accent || '#C9A24A';
  const mat = new THREE.MeshStandardMaterial({ color: '#0c0e14', roughness: 0.7, metalness: 0.3 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(spec.radius ?? 0.32, (spec.radius ?? 0.32) * 1.15, spec.height ?? 0.9, 16), mat);
  base.position.y = (spec.height ?? 0.9) / 2;
  g.add(base);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry((spec.radius ?? 0.32) * 1.02, 0.015, 8, 24),
    new THREE.MeshBasicMaterial({ color: accent })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = spec.height ?? 0.9;
  g.add(ring);
  if (spec.item) {
    const item = makeShardMesh(spec.item.tint || '#11141B', accent, spec.item.scale || 0.34, spec.item.displace ?? 0.05);
    item.position.y = (spec.height ?? 0.9) + 0.32;
    item.userData.baseY = item.position.y;
    g.add(item);
    g.userData.animated = [item];
  }
  /* spot de galeria: tom neutro/quente com leve tinta da cor de destaque,
     cone visível focando o item sobre o pedestal */
  const galleryColor = new THREE.Color('#E7E3D8').lerp(new THREE.Color(accent), 0.22);
  const spotGroup = buildGallerySpot(galleryColor, {
    height: (spec.height ?? 0.9) + 2.4, intensity: spec.lightIntensity ?? 11,
    distance: (spec.height ?? 0.9) + 4.4, angle: Math.PI / 8, penumbra: 0.55, poolOpacity: 0.4,
  });
  spotGroup.children[1].position.set(0, spec.height ?? 0.9, 0);
  g.add(spotGroup);
  return g;
}

/* aglomerado de ossos / hastes finas (peixes, circuitos, restos) */
function propBoneCluster(spec) {
  const g = new THREE.Group();
  const n = spec.count ?? 7;
  const accent = spec.accent || '#0E8C86';
  const boneMat = new THREE.MeshStandardMaterial({ color: spec.color || '#cfc6b4', roughness: 0.55, metalness: 0.05 });
  for (let i = 0; i < n; i++) {
    const len = 0.3 + Math.random() * 0.6;
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, len, 2, 6), boneMat);
    mesh.position.set((Math.random() - 0.5) * 0.6, 0.04 + Math.random() * 0.1, (Math.random() - 0.5) * 0.6);
    mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    g.add(mesh);
    if (Math.random() > 0.5) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), new THREE.MeshBasicMaterial({ color: accent }));
      dot.position.copy(mesh.position);
      g.add(dot);
    }
  }
  return g;
}

/* raiz / cabo orgânico ramificado, brilho verde tóxico */
function propRoot(spec) {
  const g = new THREE.Group();
  const accent = spec.accent || '#B7F03B';
  const branches = spec.branches ?? 3;
  const baseMat = new THREE.MeshStandardMaterial({ color: spec.color || '#1a1208', roughness: 0.85 });
  for (let i = 0; i < branches; i++) {
    const start = new THREE.Vector3(0, 0, 0);
    const end = new THREE.Vector3((Math.random() - 0.5) * 1.8, Math.random() * 1.6 + 0.3, (Math.random() - 0.5) * 1.8);
    const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.6, (Math.random() - 0.5)));
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    const geo = new THREE.TubeGeometry(curve, 16, 0.05 - i * 0.008, 6, false);
    g.add(new THREE.Mesh(geo, baseMat));
    const glowGeo = new THREE.TubeGeometry(curve, 16, 0.014, 6, false);
    g.add(new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: accent })));
  }
  return g;
}

/* faixa / bandeira rasgada */
function propBanner(spec) {
  const w = spec.size?.[0] ?? 0.8;
  const h = spec.size?.[1] ?? 1.6;
  const seg = 8;
  const geo = new THREE.PlaneGeometry(w, h, 1, seg);
  const pos = geo.attributes.position;
  for (let i = 0; i <= seg; i++) {
    const y = i / seg;
    if (y > 0.6) {
      const tear = (Math.random() - 0.5) * w * 0.5 * (y - 0.6) / 0.4;
      for (let s = 0; s <= 1; s++) {
        const idx = i * 2 + s;
        pos.setX(idx, pos.getX(idx) + tear * (s === 0 ? 1 : -1) * 0.6);
        pos.setZ(idx, (Math.random() - 0.5) * 0.08);
      }
    }
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: spec.color || '#3a0d12', roughness: 0.95, metalness: 0,
    side: THREE.DoubleSide, emissive: spec.emissive ? new THREE.Color(spec.emissive) : new THREE.Color(0, 0, 0),
    emissiveIntensity: spec.emissiveIntensity ?? 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = h / 2;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/* mesa comprida (vila ocupada / fusão) */
function propTable(spec) {
  const g = new THREE.Group();
  const w = spec.size?.[0] ?? 2.4;
  const d = spec.size?.[1] ?? 0.9;
  const ht = spec.height ?? 0.78;
  const mat = new THREE.MeshStandardMaterial({ color: spec.color || '#1c140d', roughness: 0.85 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), mat);
  top.position.y = ht;
  g.add(top);
  const legGeo = new THREE.BoxGeometry(0.07, ht, 0.07);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(sx * (w / 2 - 0.12), ht / 2, sz * (d / 2 - 0.12));
    g.add(leg);
  });
  return g;
}

/* cadeira-fantasma (silhueta translúcida = ausência) */
function propChairGhost(spec) {
  const accent = spec.accent || '#243B8F';
  const mat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.18, wireframe: true });
  const g = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), mat);
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.05), mat);
  back.position.set(0, 0.7, -0.18);
  g.add(seat, back);
  const legGeo = new THREE.BoxGeometry(0.04, 0.45, 0.04);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(sx * 0.18, 0.225, sz * 0.18);
    g.add(leg);
  });
  return g;
}

/* tanque cilíndrico com líquido (água contaminada) */
function propTank(spec) {
  const g = new THREE.Group();
  const r = spec.radius ?? 0.4;
  const h = spec.height ?? 1.4;
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: '#0c1118', roughness: 0.05, transmission: 0.9, thickness: 0.3, transparent: true, opacity: 0.28, side: THREE.DoubleSide,
  });
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, true), glassMat);
  glass.position.y = h / 2;
  g.add(glass);
  const liquidMat = createFloorMaterial({
    colorDeep: spec.colorDeep || '#03110d', colorA: spec.colorA || '#0E8C86', colorB: spec.colorB || '#4B1F68',
    glow: spec.glow || '#B7F03B', liquid: 0.8, veins: 0.15, grid: 0, scale: 0.6, fogDensity: 0,
  });
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.96, r * 0.96, h * 0.62, 20), liquidMat);
  liquid.position.y = h * 0.34;
  g.add(liquid);
  g.userData.shaderMats = [liquidMat];
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.03, 0.02, 8, 24), new THREE.MeshBasicMaterial({ color: spec.glow || '#B7F03B' }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h * 0.62;
  g.add(ring);
  return g;
}

/* pilar estrutural (delimita o perímetro navegável) */
function propPillar(spec) {
  const g = new THREE.Group();
  const accent = spec.accent || '#11141B';
  const h = spec.height ?? 6;
  const mat = new THREE.MeshStandardMaterial({ color: '#080a0e', roughness: 0.8, metalness: 0.35 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, h, 0.34), mat);
  body.position.y = h / 2;
  g.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, h * 0.92, 0.36), new THREE.MeshBasicMaterial({ color: spec.glow || '#0E8C86' }));
  stripe.position.set(0, h / 2, 0.005);
  g.add(stripe);
  return g;
}

/* alto-falante empilhado (vozes) */
function propSpeaker(spec) {
  const g = new THREE.Group();
  const accent = spec.accent || '#872D67';
  const mat = new THREE.MeshStandardMaterial({ color: '#0c0c10', roughness: 0.7, metalness: 0.3 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.55), mat);
  box.position.y = 0.45;
  g.add(box);
  for (let i = 0; i < 2; i++) {
    const cone = new THREE.Mesh(new THREE.CircleGeometry(0.18 - i * 0.06, 20), new THREE.MeshStandardMaterial({ color: '#1a1a1f', roughness: 0.5, metalness: 0.6 }));
    cone.position.set(0, 0.62 - i * 0.32, 0.276);
    g.add(cone);
  }
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), new THREE.MeshBasicMaterial({ color: accent }));
  led.position.set(0.22, 0.85, 0.276);
  g.add(led);
  const light = new THREE.PointLight(accent, 0.6, 2);
  light.position.copy(led.position);
  g.add(light);
  return g;
}

/* pedra / rocha (elementos, ancestrais) */
function propRock(spec) {
  const geo = new THREE.DodecahedronGeometry(spec.radius ?? 0.4, 0);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
    v.multiplyScalar(1 + (Math.random() - 0.5) * 0.18);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: spec.color || '#23262e', roughness: 0.9, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  if (spec.glow) {
    const glowMesh = new THREE.Mesh(new THREE.IcosahedronGeometry((spec.radius ?? 0.4) * 0.18, 0), new THREE.MeshBasicMaterial({ color: spec.glow }));
    mesh.add(glowMesh);
  }
  return mesh;
}

/* =========================================================================
   5b. OBJETOS OUSADOS — low-poly + material de "petróleo em movimento"
   -------------------------------------------------------------------------
   createOilFlowMaterial: superfície plástica/oleosa com iridescência que
   escorre pela geometria (fluxo animado + especular). Reaproveita os mesmos
   helpers GLSL (ruído + paleta oil-slick), então não adiciona shader novo
   pesado à conta da cena. Animais, plantas e poças usam este material.
   ========================================================================= */
export function createOilFlowMaterial(opts = {}) {
  const u = {
    uTime: { value: 0 },
    uBase: { value: new THREE.Color(opts.base || '#08090d') },
    uGlow: { value: new THREE.Color(opts.glow || '#0E8C86') },
    uFlow: { value: opts.flow ?? 0.6 },
    uGloss: { value: opts.gloss ?? 0.75 },
    uIrid: { value: opts.irid ?? 0.9 },
    uCameraPos: { value: new THREE.Vector3() },
    ...defaultPaletteUniforms(opts.palette),
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: /* glsl */`
      ${GLSL_NOISE}
      varying vec3 vNormalW; varying vec3 vWorldPos; varying vec3 vPos;
      uniform float uTime, uFlow;
      void main(){
        vec3 pos = position;
        float w = snoise(position*1.5 + vec3(0.0, uTime*0.28, 0.0));
        pos += normal * w * 0.035 * uFlow;
        vec4 wp = modelMatrix * vec4(pos,1.0);
        vWorldPos = wp.xyz; vPos = position;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */`
      ${GLSL_PALETTE}
      varying vec3 vNormalW; varying vec3 vWorldPos; varying vec3 vPos;
      uniform float uTime, uGloss, uIrid; uniform vec3 uBase, uGlow, uCameraPos;
      uniform vec3 uPalA, uPalB, uPalC, uPalD;
      void main(){
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 N = normalize(vNormalW);
        float fres = pow(1.0 - max(dot(N,V),0.0), 2.4);
        float flow = vPos.y*1.6 + uTime*0.32 + sin(vPos.x*3.0 + uTime*0.4)*0.6 + sin(vPos.z*2.4 - uTime*0.3)*0.6;
        vec3 irid = oilPalette(flow*0.14 + fres*0.5, uPalA, uPalB, uPalC, uPalD);
        vec3 L = normalize(vec3(0.3, 0.85, 0.4));
        float diff = max(dot(N,L), 0.0);
        vec3 H = normalize(L + V);
        float spec = pow(max(dot(N,H),0.0), 42.0) * uGloss;
        vec3 base = uBase * (0.28 + 0.72*diff);
        vec3 col = base + irid*(fres*0.85 + 0.22)*uIrid + uGlow*0.05 + vec3(spec);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  mat.userData.isOilFlow = true;
  return mat;
}

/* util: registra uma malha para receber uTime/uCameraPos no loop, sem giro */
function tagOil(mesh, spin = 0, bob = 0) {
  mesh.userData.spin = spin;
  mesh.userData.bobSpeed = bob;
  mesh.userData.bobPhase = Math.random() * Math.PI * 2;
  mesh.userData.baseY = mesh.position.y;
  return mesh;
}

/* PLANTA low-poly (arbusto de folhas plásticas, opcional brilho) */
function propPlant(spec) {
  const g = new THREE.Group();
  const accent = spec.accent || '#1f7a3a';
  const glow = spec.glow || '#B7F03B';
  const count = spec.count ?? 7;
  const height = spec.height ?? 1.1;
  const leafMat = new THREE.MeshStandardMaterial({
    color: accent, roughness: 0.35, metalness: 0.1, flatShading: true,
    emissive: new THREE.Color(glow), emissiveIntensity: 0.12, side: THREE.DoubleSide,
  });
  const stemMat = new THREE.MeshStandardMaterial({ color: '#0c1a10', roughness: 0.7, flatShading: true });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, height * 0.5, 5), stemMat);
  stem.position.y = height * 0.25; g.add(stem);
  const anim = [];
  for (let i = 0; i < count; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.12, height * (0.5 + Math.random() * 0.5), 4), leafMat);
    leaf.geometry.translate(0, leaf.geometry.parameters.height / 2, 0);
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.4;
    leaf.rotation.z = 0.5 + Math.random() * 0.5;
    leaf.rotation.y = a;
    leaf.position.set(Math.cos(a) * 0.08, height * 0.3, Math.sin(a) * 0.08);
    leaf.userData.baseY = leaf.position.y;
    leaf.userData.bobSpeed = 0.8 + Math.random() * 0.6;
    leaf.userData.bobPhase = Math.random() * 6.28;
    leaf.userData.spin = 0;
    g.add(leaf); anim.push(leaf);
  }
  g.userData.animated = anim;
  return g;
}

/* PALMEIRA / vegetação alta low-poly, tronco em petróleo */
function propPalm(spec) {
  const g = new THREE.Group();
  const height = spec.height ?? 3.2;
  const fronds = spec.fronds ?? 7;
  const trunkMat = createOilFlowMaterial({ base: '#0b0d11', glow: spec.glow || '#0E8C86', gloss: 0.6, flow: 0.5 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, height, 6), trunkMat);
  trunk.position.y = height / 2; g.add(trunk);
  tagOil(trunk, 0, 0);
  const leafMat = new THREE.MeshStandardMaterial({
    color: spec.accent || '#14603a', roughness: 0.4, metalness: 0.1, flatShading: true,
    emissive: new THREE.Color(spec.glow || '#B7F03B'), emissiveIntensity: 0.1, side: THREE.DoubleSide,
  });
  const anim = [trunk];
  for (let i = 0; i < fronds; i++) {
    const frond = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.6, 4), leafMat);
    frond.geometry.translate(0, 0.8, 0);
    const a = (i / fronds) * Math.PI * 2;
    frond.position.y = height;
    frond.rotation.z = 1.05;
    frond.rotation.y = a;
    frond.userData = { baseY: height, bobSpeed: 0.6, bobPhase: i, spin: 0 };
    g.add(frond); anim.push(frond);
  }
  g.userData.animated = anim;
  return g;
}

/* ONÇA low-poly em petróleo, olhos brilhando */
function propJaguar(spec) {
  const g = new THREE.Group();
  const s = spec.bodyScale ?? 1;
  const mat = createOilFlowMaterial({ base: spec.base || '#070809', glow: spec.glow || '#B7F03B', gloss: 0.85, flow: 0.7 });
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42 * s, 1), mat);
  body.scale.set(1.7, 0.9, 0.85); body.position.y = 0.7 * s; g.add(body);
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.26 * s, 1), mat);
  head.position.set(0.78 * s, 0.82 * s, 0); g.add(head);
  const legGeo = new THREE.CylinderGeometry(0.07 * s, 0.05 * s, 0.7 * s, 5);
  [[0.55, 0.34], [0.55, -0.34], [-0.55, 0.34], [-0.55, -0.34]].forEach((p) => {
    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(p[0] * s, 0.35 * s, p[1] * s); g.add(leg);
  });
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.02 * s, 0.9 * s, 5), mat);
  tail.position.set(-0.8 * s, 0.8 * s, 0); tail.rotation.z = 1.1; g.add(tail);
  /* olhos */
  const eyeMat = new THREE.MeshBasicMaterial({ color: spec.glow || '#B7F03B' });
  [-0.12, 0.12].forEach((z) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04 * s, 8, 8), eyeMat);
    eye.position.set(0.96 * s, 0.86 * s, z * s); g.add(eye);
  });
  const eyeLight = new THREE.PointLight(spec.glow || '#B7F03B', 0.7, 2.4, 2);
  eyeLight.position.set(1.0 * s, 0.86 * s, 0); g.add(eyeLight);
  body.userData = { baseY: body.position.y, bobSpeed: 0.5, bobPhase: 0, spin: 0 };
  head.userData = { baseY: head.position.y, bobSpeed: 0.5, bobPhase: 0.4, spin: 0 };
  g.userData.animated = [body, head];
  return g;
}

/* CARDUME low-poly (peixes em petróleo, flutuando/girando) */
function propFishSchool(spec) {
  const g = new THREE.Group();
  const count = spec.count ?? 6;
  const mat = createOilFlowMaterial({ base: spec.base || '#0a0c12', glow: spec.glow || '#0E8C86', gloss: 0.8, flow: 0.8 });
  const anim = [];
  for (let i = 0; i < count; i++) {
    const fish = new THREE.Group();
    const bodyF = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 4), mat);
    bodyF.rotation.z = Math.PI / 2; fish.add(bodyF);
    const tailF = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.16, 3), mat);
    tailF.rotation.z = -Math.PI / 2; tailF.position.x = -0.26; fish.add(tailF);
    const a = (i / count) * Math.PI * 2;
    const r = 0.7 + Math.random() * 0.5;
    fish.position.set(Math.cos(a) * r, 1.1 + Math.sin(a * 2) * 0.3, Math.sin(a) * r);
    fish.rotation.y = a + Math.PI / 2;
    bodyF.userData = { baseY: 0, bobSpeed: 1 + Math.random(), bobPhase: i, spin: 0 };
    tailF.userData = { baseY: 0, bobSpeed: 0, bobPhase: i, spin: 0 };
    g.add(fish); anim.push(bodyF, tailF);
  }
  g.userData.animated = anim;
  return g;
}

/* POÇA DE PETRÓLEO em movimento (disco líquido, iridescente) */
function propOilBlob(spec) {
  const g = new THREE.Group();
  const r = spec.radius ?? 0.9;
  const mat = createOilFlowMaterial({ base: '#050506', glow: spec.glow || '#4B1F68', gloss: 0.9, flow: 1.0, irid: 1.1 });
  const geo = new THREE.CircleGeometry(r, 40);
  const disc = new THREE.Mesh(geo, mat);
  disc.rotation.x = -Math.PI / 2; disc.position.y = 0.02;
  g.add(tagOil(disc, 0, 0));
  /* pequena bolha central que sobe e desce */
  const blob = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 16, 12), mat);
  blob.position.y = r * 0.28; blob.scale.y = 0.6;
  blob.userData = { baseY: r * 0.28, bobSpeed: 0.7, bobPhase: 0, spin: 0.15 };
  g.add(blob);
  g.userData.animated = [disc, blob];
  return g;
}

const PROP_BUILDERS = {
  vitrine: propVitrine,
  totem: propTotem,
  cable: propCable,
  shard: propShard,
  'mirror-shard': propMirrorShard,
  panel: propPanel,
  pedestal: propPedestal,
  bones: propBoneCluster,
  root: propRoot,
  banner: propBanner,
  table: propTable,
  'chair-ghost': propChairGhost,
  tank: propTank,
  pillar: propPillar,
  speaker: propSpeaker,
  rock: propRock,
  /* novos objetos ousados */
  plant: propPlant,
  palm: propPalm,
  'lowpoly-jaguar': propJaguar,
  'fish-school': propFishSchool,
  'oil-blob': propOilBlob,
};

export function buildProp(spec) {
  const builder = PROP_BUILDERS[spec.type];
  if (!builder) {
    console.warn('[ORORO] tipo de objeto desconhecido:', spec.type);
    return new THREE.Group();
  }
  const obj = builder(spec);
  applyTransform(obj, spec);
  obj.userData.spec = spec;
  /* todo objeto com spec.info vira um item clicável e inspecionável:
     toda a malha do grupo é marcada para o raycaster e devolve o id
     correspondente em content.json (rooms[id].objects[infoId]). */
  obj.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = false; child.receiveShadow = false;
      if (spec.info) { child.userData.infoId = spec.info; }
    }
  });
  return obj;
}

/* (antigo bloco 6 "ripple material" removido: a bacia ritual da sala 12
   agora reaproveita o shader iridescente em modo espelho, mantendo o
   projeto em apenas 2 shaders pesados por cena — ver buildBowl) */

/* =========================================================================
   7. RELÍQUIAS — objeto central de decisão de cada sala
   -------------------------------------------------------------------------
   buildRelic(spec) -> { group, update(t,camera), interactRadius, label }
   spec.type define a geometria/comportamento. spec.accent / spec.glow /
   spec.palette controlam a cor. Para trocar por um modelo 3D real, crie um
   novo case que carregue um GLTF e ainda assim devolva o mesmo contrato
   { group, update, interactRadius, label }.
   ========================================================================= */

function ringPulse(parent, color, baseRadius, count = 3) {
  const rings = [];
  for (let i = 0; i < count; i++) {
    const geo = new THREE.RingGeometry(baseRadius, baseRadius + 0.02, 48);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.phase = i / count;
    parent.add(mesh);
    rings.push(mesh);
  }
  return (t, speed = 0.25, maxR = 2.4) => {
    rings.forEach((r) => {
      const phase = ((t * speed) + r.userData.phase) % 1;
      const scale = 1 + phase * (maxR / baseRadius - 1);
      r.scale.setScalar(scale);
      r.material.opacity = (1 - phase) * 0.4;
    });
  };
}

function buildEgg(spec) {
  const group = new THREE.Group();
  const mat = createIridescentMaterial({
    base: spec.base || '#0d1218', glow: spec.glow || '#0E8C86',
    displace: 0.1, fresnelPower: 2.6, pulse: 0.4, palette: spec.palette,
  });
  const geo = new THREE.SphereGeometry(0.85, 64, 64);
  geo.scale(1, 1.32, 1);
  const egg = new THREE.Mesh(geo, mat);
  egg.position.y = 1.35;
  group.add(egg);

  /* disco refletor sob o ovo, com OROЯO distorcido */
  const tex = makeWordmarkTexture('OROЯO', { colorB: cssColor(spec.glow, '#0E8C86'), glow: cssColor(spec.glow, '#0E8C86') });
  const mirrorMat = createIridescentMaterial({ mirror: true, texture: tex, base: cssColor(spec.accent, '#243B8F'), glow: cssColor(spec.accent, '#243B8F'), distort: 0.05, fresnelPower: 1.4 });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48), mirrorMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.02;
  group.add(disc);

  const pulse = ringPulse(group, spec.glow || '#0E8C86', 1.55, 3);

  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
      mirrorMat.uniforms.uTime.value = t;
      egg.rotation.y = t * 0.18;
      egg.position.y = 1.35 + Math.sin(t * 0.6) * 0.05;
      pulse(t, 0.18, 1.9);
    },
    interactRadius: 2.1,
    label: 'ovo oleoso',
  };
}

function buildCore(spec) {
  const group = new THREE.Group();
  const barkMat = createIridescentMaterial({ base: spec.base || '#0c0a08', glow: spec.glow || '#8A0303', displace: 0.06, fresnelPower: 2.6, pulse: 0.3, palette: spec.palette });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.78, 2.4, 10, 1, true), barkMat);
  trunk.position.y = 1.2;
  group.add(trunk);

  const innerMat = new THREE.MeshBasicMaterial({ color: spec.glow || '#C1121F' });
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 2.1, 12, 1, true), innerMat);
  inner.position.y = 1.2;
  group.add(inner);

  const coreLight = new THREE.PointLight(spec.glow || '#C1121F', 3.2, 5, 2);
  coreLight.position.y = 1.2;
  group.add(coreLight);

  /* "antenas" - cabos saindo do topo */
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2;
    const c = buildProp({
      type: 'cable',
      from: [0, 2.35, 0],
      to: [Math.cos(ang) * 1.4, 2.9 + Math.random() * 0.6, Math.sin(ang) * 1.4],
      sag: -0.3,
      radius: 0.02,
      glow: spec.accent,
    });
    group.add(c);
  }

  return {
    group,
    update(t) {
      barkMat.uniforms.uTime.value = t;
      const pulse = 0.6 + 0.4 * Math.sin(t * 1.3);
      coreLight.intensity = 2.4 + pulse * 1.6;
      inner.material.color.setHSL(0.0, 0.75, 0.28 + pulse * 0.18);
    },
    interactRadius: 2.2,
    label: 'núcleo do tronco',
  };
}

function buildJaguar(spec) {
  const group = new THREE.Group();
  const accent = spec.glow || '#5BD0E0';
  const n = spec.count ?? 1400;
  const positions = new Float32Array(n * 3);
  const rand = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let x, y, z;
    const r = Math.random();
    if (r < 0.55) {
      // corpo: elipsoide alongado
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      x = Math.sin(v) * Math.cos(u) * 1.05;
      y = Math.sin(v) * Math.sin(u) * 0.42 + 0.65;
      z = Math.cos(v) * 0.5;
    } else if (r < 0.78) {
      // cabeca
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      x = Math.sin(v) * Math.cos(u) * 0.4 - 1.15;
      y = Math.sin(v) * Math.sin(u) * 0.36 + 0.95;
      z = Math.cos(v) * 0.4;
    } else if (r < 0.92) {
      // cauda curva
      const tt = Math.random();
      x = 1.0 + tt * 1.3;
      y = 0.6 + Math.sin(tt * Math.PI) * 0.7;
      z = Math.sin(tt * 4.0) * 0.25;
    } else {
      // pernas/base
      const leg = Math.floor(Math.random() * 4);
      const lx = (leg % 2 === 0 ? -0.7 : 0.55);
      const lz = (leg < 2 ? -0.35 : 0.35);
      x = lx + (Math.random() - 0.5) * 0.15;
      y = Math.random() * 0.6;
      z = lz + (Math.random() - 0.5) * 0.15;
    }
    positions[i * 3] = x + (Math.random() - 0.5) * 0.06;
    positions[i * 3 + 1] = y + (Math.random() - 0.5) * 0.06;
    positions[i * 3 + 2] = z + (Math.random() - 0.5) * 0.06;
    rand[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const mat = createPointsMaterial({ color: accent, size: 46, drift: 0.05 });
  const points = new THREE.Points(geo, mat);
  points.position.y = 0.1;
  group.add(points);

  /* olhos */
  const eyeMat = new THREE.MeshBasicMaterial({ color: spec.eyeColor || '#B7F03B' });
  [-0.18, 0.18].forEach((dz) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat);
    eye.position.set(-1.45, 1.05, dz);
    group.add(eye);
    const l = new THREE.PointLight(spec.eyeColor || '#B7F03B', 0.8, 1.4);
    l.position.copy(eye.position);
    group.add(l);
  });

  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
      group.rotation.y = Math.sin(t * 0.08) * 0.25;
    },
    interactRadius: 2.6,
    label: 'onça de fumaça',
  };
}

function buildAstrolabe(spec) {
  const group = new THREE.Group();
  const palette = spec.palette;
  const shellMat = createIridescentMaterial({ base: spec.base || '#0d1018', glow: spec.glow || '#C9A24A', displace: 0.04, fresnelPower: 2.0, pulse: 0.6, palette });
  const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 2), shellMat);
  group.add(shell);

  const rings = [];
  const colors = [spec.accent || '#0E8C86', spec.glow || '#C9A24A', '#872D67'];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.95 + i * 0.26, 0.018, 8, 64),
      new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.65 })
    );
    ring.rotation.x = Math.PI / 2 + i * 0.6;
    ring.rotation.y = i * 0.9;
    group.add(ring);
    rings.push(ring);
  }
  group.position.y = 1.4;

  return {
    group,
    update(t) {
      shellMat.uniforms.uTime.value = t;
      shell.rotation.y = t * 0.2;
      shell.rotation.x = Math.sin(t * 0.3) * 0.2;
      rings.forEach((r, i) => {
        r.rotation.z = t * (0.12 + i * 0.05) * (i % 2 === 0 ? 1 : -1);
        r.rotation.y += 0.0009 * (i + 1);
      });
    },
    interactRadius: 2.2,
    label: 'astrolábio orgânico',
  };
}

function buildDrill(spec) {
  const group = new THREE.Group();
  const goldMat = createIridescentMaterial({ base: spec.base || '#1a1306', glow: spec.glow || '#C9A24A', displace: 0.0, fresnelPower: 1.4, pulse: 0.5, palette: spec.palette });
  const bit = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1.2, 10), goldMat);
  bit.position.y = -0.3;
  bit.rotation.x = Math.PI;
  group.add(bit);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 1.4, 10), goldMat);
  shaft.position.y = 0.9;
  group.add(shaft);
  /* manchas de sangue/oleo */
  const stainMat = new THREE.MeshBasicMaterial({ color: spec.stain || '#8A0303', transparent: true, opacity: 0.55 });
  for (let i = 0; i < 4; i++) {
    const stain = new THREE.Mesh(new THREE.SphereGeometry(0.07 + Math.random() * 0.05, 8, 8), stainMat);
    stain.position.set((Math.random() - 0.5) * 0.4, -0.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4);
    stain.scale.y = 1.6;
    group.add(stain);
  }
  /* corrente suspensa */
  const chain = buildProp({ type: 'cable', from: [0, 2.6, 0], to: [0, 1.65, 0], sag: 0, radius: 0.02, color: '#1a1a1a' });
  group.add(chain);
  group.position.y = 0.9;

  return {
    group,
    update(t) {
      goldMat.uniforms.uTime.value = t;
      group.rotation.y = t * 0.35;
      group.position.y = 0.9 + Math.sin(t * 0.4) * 0.05;
    },
    interactRadius: 2.0,
    label: 'broca dourada',
  };
}

function buildVillaTable(spec) {
  const group = new THREE.Group();
  const table = buildProp({ type: 'table', size: [2.2, 1.0, 0], height: 0.78, color: '#16100a' });
  group.add(table);

  /* tres lugares vazios */
  [-0.75, 0, 0.75].forEach((x) => {
    const chair = buildProp({ type: 'chair-ghost', position: [x, 0, 0.85], rotation: [0, Math.PI, 0], accent: spec.accent || '#243B8F' });
    group.add(chair);
  });

  /* concha */
  const shellMat = createIridescentMaterial({ base: '#1a1410', glow: spec.glow || '#0E8C86', displace: 0.02, fresnelPower: 1.8, pulse: 0.5, palette: spec.palette });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.6), shellMat);
  shell.position.set(-0.55, 0.83, 0);
  shell.rotation.x = Math.PI;
  group.add(shell);

  /* garra */
  const clawMat = new THREE.MeshStandardMaterial({ color: '#cfc6b4', roughness: 0.5 });
  const clawGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.22, 6), clawMat);
    claw.position.set(i * 0.05 - 0.05, 0, 0);
    claw.rotation.z = Math.PI * 0.92;
    clawGroup.add(claw);
  }
  clawGroup.position.set(0, 0.83, 0);
  group.add(clawGroup);

  /* documento queimado */
  const docMat = new THREE.MeshStandardMaterial({ color: '#2a2018', roughness: 0.95, emissive: new THREE.Color(spec.accent || '#8A0303'), emissiveIntensity: 0.15 });
  const doc = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.22), docMat);
  doc.rotation.x = -Math.PI / 2;
  doc.position.set(0.55, 0.815, 0);
  group.add(doc);

  const light = new THREE.PointLight(spec.accent || '#243B8F', 1.0, 3.2);
  light.position.set(0, 1.4, 0);
  group.add(light);

  return {
    group,
    update(t) {
      shellMat.uniforms.uTime.value = t;
      light.intensity = 0.8 + 0.3 * Math.sin(t * 0.7);
    },
    interactRadius: 2.4,
    label: 'mesa dos ausentes',
  };
}

function buildRadio(spec) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: spec.base || '#16110d', roughness: 0.6, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.5), bodyMat);
  body.position.y = 0.9;
  group.add(body);

  const dialMat = createIridescentMaterial({ base: '#0a0a0a', glow: spec.glow || '#872D67', displace: 0.0, fresnelPower: 1.2, pulse: 1, palette: spec.palette });
  const dial = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.04, 12, 24), dialMat);
  dial.position.set(0.18, 0.9, 0.26);
  group.add(dial);

  const speakerMat = new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.8 });
  for (let i = 0; i < 9; i++) {
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), speakerMat);
    dot.position.set(-0.32 + (i % 3) * 0.08, 0.78 + Math.floor(i / 3) * 0.08, 0.251);
    group.add(dot);
  }

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 1.1, 6), bodyMat);
  antenna.position.set(0.3, 1.75, 0);
  antenna.rotation.z = -0.18;
  group.add(antenna);

  const pulse = ringPulse(group, spec.glow || '#872D67', 0.4, 4);

  const light = new THREE.PointLight(spec.glow || '#872D67', 1.4, 3.5);
  light.position.set(0, 1.1, 0.3);
  group.add(light);

  return {
    group,
    update(t) {
      dialMat.uniforms.uTime.value = t;
      dial.rotation.z = t * 0.4;
      pulse(t, 0.3, 6);
      light.intensity = 1.0 + 0.6 * Math.sin(t * 3.1);
    },
    interactRadius: 2.0,
    label: 'rádio-oráculo',
  };
}

function buildMirrorMonolith(spec) {
  const group = new THREE.Group();
  const tex = makeWordmarkTexture('OROЯO', { colorB: cssColor(spec.glow, '#243B8F'), glow: cssColor(spec.glow, '#243B8F') });
  const mat = createIridescentMaterial({ mirror: true, texture: tex, base: cssColor(spec.accent, '#243B8F'), glow: cssColor(spec.accent, '#243B8F'), distort: 0.09, fresnelPower: 1.4 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6, 1, 1), mat);
  plane.position.y = 1.4;
  group.add(plane);

  const frameMat = new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.6, metalness: 0.5 });
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.62, 2.72, 0.06), frameMat);
  frame.position.set(0, 1.4, -0.04);
  group.add(frame);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.6), mat);
  back.position.set(0, 1.4, -0.01);
  back.rotation.y = Math.PI;
  group.add(back);

  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
    },
    interactRadius: 2.0,
    label: 'espelho líquido',
  };
}

function buildHeart(spec) {
  const group = new THREE.Group();
  const heartMat = createIridescentMaterial({ base: spec.base || '#150709', glow: spec.glow || '#C1121F', displace: 0.07, fresnelPower: 1.6, pulse: 0.9, palette: spec.palette });
  const heart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 3), heartMat);
  heart.position.y = 1.3;
  group.add(heart);

  const capsuleMat = new THREE.MeshPhysicalMaterial({ color: '#0c1118', roughness: 0.04, transmission: 0.94, thickness: 0.4, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
  const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.1, 8, 16), capsuleMat);
  capsule.rotation.z = Math.PI / 2;
  capsule.position.y = 1.3;
  group.add(capsule);

  const light = new THREE.PointLight(spec.glow || '#C1121F', 2.2, 4);
  light.position.y = 1.3;
  group.add(light);

  return {
    group,
    update(t) {
      heartMat.uniforms.uTime.value = t;
      const pulse = 1 + Math.sin(t * 1.8) * 0.08;
      heart.scale.setScalar(pulse);
      light.intensity = 1.6 + Math.sin(t * 1.8) * 1.0;
    },
    interactRadius: 2.0,
    label: 'coração híbrido',
  };
}

function buildShell(spec) {
  const group = new THREE.Group();
  const mat = createIridescentMaterial({ base: spec.base || '#100c08', glow: spec.glow || '#C9A24A', displace: 0.03, fresnelPower: 1.7, pulse: 0.6, palette: spec.palette });
  const shell = new THREE.Mesh(new THREE.TorusKnotGeometry(0.55, 0.18, 160, 20, 2, 3), mat);
  shell.position.y = 1.6;
  group.add(shell);
  const pulse = ringPulse(group, spec.accent || '#0E8C86', 0.9, 4);
  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
      shell.rotation.x = t * 0.18;
      shell.rotation.y = t * 0.12;
      pulse(t, 0.22, 6);
    },
    interactRadius: 2.2,
    label: 'concha-amplificador',
  };
}

function buildConstellation(spec) {
  const group = new THREE.Group();
  /* pontos chave: contorno onca-sereia simplificado */
  const key = [
    [-1.4, 1.0, 0], [-1.0, 1.3, 0.2], [-0.5, 1.35, -0.2], [0.0, 1.2, 0.15],
    [0.5, 0.95, -0.1], [1.0, 0.55, 0.1], [1.45, 0.1, -0.05], [1.7, -0.35, 0.1],
    [1.3, -0.7, -0.1], [0.8, -0.95, 0.05], [0.2, -0.6, -0.1], [-0.4, -0.3, 0.1],
    [-1.0, 0.2, -0.05], [-1.4, 0.6, 0.1],
  ];
  const positions = [];
  const n = 700;
  for (let i = 0; i < n; i++) {
    const a = key[Math.floor(Math.random() * key.length)];
    positions.push(a[0] + (Math.random() - 0.5) * 0.22, a[1] + (Math.random() - 0.5) * 0.22, a[2] + (Math.random() - 0.5) * 0.22);
  }
  /* algumas estrelas extras, soltas, ao redor da silhueta */
  for (let i = 0; i < 220; i++) {
    positions.push((Math.random() - 0.5) * 4.4, (Math.random() - 0.5) * 3.0, (Math.random() - 0.5) * 2.0);
  }
  const total = n + 220;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  const rand = new Float32Array(total);
  for (let i = 0; i < total; i++) rand[i] = Math.random();
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const mat = createPointsMaterial({ color: spec.glow || '#C9A24A', size: 13, drift: 0.04 });
  const points = new THREE.Points(geo, mat);
  group.add(points);

  /* linhas conectando os pontos-chave, como um mapa de constelação */
  const linePositions = [];
  for (let i = 0; i < key.length; i++) {
    const a = key[i];
    const b = key[(i + 1) % key.length];
    linePositions.push(...a, ...b);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(linePositions), 3));
  const lineMat = new THREE.LineBasicMaterial({ color: spec.accent || '#243B8F', transparent: true, opacity: 0.55 });
  group.add(new THREE.LineSegments(lineGeo, lineMat));

  /* pequenos núcleos brilhantes nos vértices-chave */
  const coreMat = new THREE.MeshBasicMaterial({ color: spec.glow || '#C9A24A' });
  key.forEach((k) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), coreMat);
    m.position.set(k[0], k[1], k[2]);
    group.add(m);
  });

  group.position.y = 1.4;

  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
      group.rotation.y = t * 0.06;
    },
    interactRadius: 2.4,
    label: 'constelação onça-sereia',
  };
}

function buildBowl(spec) {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: '#0a0a0c', roughness: 0.5, metalness: 0.4 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.5, 0.28, 32, 1, true), baseMat);
  bowl.position.y = 0.14;
  group.add(bowl);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), baseMat);
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.0;
  group.add(bottom);

  /* superfície líquida: shader iridescente, fresnel baixo (visto de cima,
     a iridescência cobre quase toda a área, como um filme de óleo denso) */
  const liquidMat = createIridescentMaterial({
    base: spec.base || '#03040a', glow: spec.glow || '#C1121F',
    fresnelPower: 0.6, pulse: 0.9, palette: spec.palette,
  });
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.66, 32), liquidMat);
  liquid.rotation.x = -Math.PI / 2;
  liquid.position.y = 0.27;
  group.add(liquid);

  /* a "gota" central: esfera vermelha que cresce e se dissolve em loop */
  const dropMat = new THREE.MeshBasicMaterial({ color: spec.glow || '#C1121F', transparent: true });
  const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), dropMat);
  drop.position.y = 0.29;
  group.add(drop);

  const light = new THREE.PointLight(spec.glow || '#C1121F', 1.4, 3);
  light.position.y = 0.6;
  group.add(light);

  return {
    group,
    update(t) {
      liquidMat.uniforms.uTime.value = t;
      light.intensity = 1.0 + 0.5 * Math.sin(t * 2.0);
      const phase = (t * 0.35) % 1;
      drop.scale.setScalar(0.02 + phase * 0.16);
      dropMat.opacity = 1.0 - phase;
    },
    interactRadius: 1.8,
    label: 'bacia negra',
  };
}

function buildMask(spec) {
  const group = new THREE.Group();
  const palette = spec.palette;
  const n = 7;
  for (let i = 0; i < n; i++) {
    const mat = createIridescentMaterial({ base: '#0d0a0e', glow: i % 2 === 0 ? (spec.glow || '#C1121F') : (spec.accent || '#0F6F5C'), displace: 0.05, fresnelPower: 1.6, pulse: 0.7, palette });
    const geo = new THREE.ConeGeometry(0.32, 0.12, 6, 1, true);
    const face = new THREE.Mesh(geo, mat);
    const ang = (i / n) * Math.PI * 2;
    face.position.set(Math.cos(ang) * 0.32, 1.4 + Math.sin(ang * 1.7) * 0.32, Math.sin(ang) * 0.32);
    face.lookAt(0, 1.4, 0);
    face.rotation.x += Math.PI / 2;
    group.add(face);
    face.userData.mat = mat;
  }
  return {
    group,
    update(t) {
      group.children.forEach((c, i) => {
        if (c.userData.mat) c.userData.mat.uniforms.uTime.value = t;
      });
      group.rotation.y = t * 0.15;
    },
    interactRadius: 2.2,
    label: 'máscara coletiva',
  };
}

function buildFusion(spec) {
  const group = new THREE.Group();
  const colors = Object.values(RASTRO_COLORS).map((c) => new THREE.Color(c));
  const n = 1800;
  const positions = new Float32Array(n * 3);
  const rand = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    let x, y, z;
    if (r < 0.6) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      const rad = 0.18 + Math.random() * 0.04;
      x = Math.sin(v) * Math.cos(u) * rad;
      y = Math.sin(v) * Math.sin(u) * rad * 1.8 + 1.55;
      z = Math.cos(v) * rad;
    } else if (r < 0.78) {
      const u = Math.random() * Math.PI * 2;
      const rad = 0.16 + Math.random() * 0.03;
      x = Math.cos(u) * rad;
      y = Math.random() * 0.55 + 1.95;
      z = Math.sin(u) * rad;
    } else {
      const u = Math.random() * Math.PI * 2;
      const rad = 0.3 + Math.random() * 0.06;
      x = Math.cos(u) * rad;
      y = Math.random() * 0.7 + 0.8;
      z = Math.sin(u) * rad;
    }
    positions[i * 3] = x; positions[i * 3 + 1] = y; positions[i * 3 + 2] = z;
    rand[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const mat = createPointsMaterial({ color: spec.glow || '#E8E1D2', size: 44, drift: 0.08 });
  const silhouette = new THREE.Points(geo, mat);
  group.add(silhouette);

  /* fragmentos orbitando: um por rastro */
  const orbiters = [];
  RASTRO_KEYS.forEach((key, i) => {
    const c = RASTRO_COLORS[key];
    const shard = makeShardMesh('#11141B', c, 0.32, 0.06);
    group.add(shard);
    orbiters.push({ mesh: shard, radius: 1.5 + (i % 3) * 0.35, speed: 0.12 + i * 0.015, offset: i * 1.1, height: 0.7 + i * 0.18 });
  });

  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
      silhouette.rotation.y = t * 0.05;
      orbiters.forEach((o) => {
        o.mesh.position.set(Math.cos(t * o.speed + o.offset) * o.radius, o.height, Math.sin(t * o.speed + o.offset) * o.radius);
        o.mesh.material.uniforms.uTime.value = t;
        o.mesh.rotation.y = t * 0.6;
      });
    },
    interactRadius: 2.6,
    label: 'OROЯO incompleta',
  };
}

/* ----- relíquias dos finais ------------------------------------------- */
function buildRootsCore(spec) {
  const group = new THREE.Group();
  const mat = createIridescentMaterial({ base: '#0a0f0c', glow: spec.glow || '#0F6F5C', displace: 0.08, fresnelPower: 1.8, pulse: 0.7, palette: spec.palette });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), mat);
  core.position.y = 1.3;
  group.add(core);
  for (let i = 0; i < 8; i++) {
    const root = buildProp({ type: 'root', position: [0, 0, 0], accent: spec.glow || '#B7F03B', branches: 1 });
    root.rotation.y = (i / 8) * Math.PI * 2;
    group.add(root);
  }
  /* olhos de onca ao redor */
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: spec.accent || '#B7F03B' }));
    eye.position.set(Math.cos(ang) * 2.6, 1.1 + Math.sin(i) * 0.3, Math.sin(ang) * 2.6);
    group.add(eye);
    const l = new THREE.PointLight(spec.accent || '#B7F03B', 0.5, 1.6);
    l.position.copy(eye.position);
    group.add(l);
  }
  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
      core.rotation.y = t * 0.15;
      core.scale.setScalar(1 + Math.sin(t * 0.9) * 0.04);
    },
    interactRadius: 2.4,
    label: 'núcleo territorial',
  };
}

function buildGhostPack(spec) {
  const group = new THREE.Group();
  const main = buildJaguar({ glow: spec.glow || '#5BD0E0', eyeColor: spec.accent || '#B7F03B', count: 1200 });
  group.add(main.group);
  const radio = buildRadio({ glow: spec.accent || '#872D67', base: '#0c0a10', palette: spec.palette });
  radio.group.scale.setScalar(0.6);
  radio.group.position.set(1.6, 0, 0.4);
  group.add(radio.group);
  return {
    group,
    update(t) {
      main.update(t);
      radio.update(t);
    },
    interactRadius: 2.6,
    label: 'transmissão',
  };
}

function buildCosmicDissolve(spec) {
  const group = new THREE.Group();
  const n = 2200;
  const positions = new Float32Array(n * 3);
  const rand = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = 0.3 + Math.random() * 2.2;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * 0.8 + 1.4;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    rand[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const mat = createPointsMaterial({ color: spec.glow || '#C9A24A', size: 36, drift: 0.25 });
  const points = new THREE.Points(geo, mat);
  group.add(points);
  return {
    group,
    update(t) {
      mat.uniforms.uTime.value = t;
      group.rotation.y = t * 0.05;
      group.rotation.x = Math.sin(t * 0.04) * 0.1;
    },
    interactRadius: 2.6,
    label: 'oceano cósmico',
  };
}

const RELIC_BUILDERS = {
  egg: buildEgg,
  core: buildCore,
  jaguar: buildJaguar,
  astrolabe: buildAstrolabe,
  drill: buildDrill,
  'villa-table': buildVillaTable,
  radio: buildRadio,
  mirror: buildMirrorMonolith,
  heart: buildHeart,
  shell: buildShell,
  constellation: buildConstellation,
  bowl: buildBowl,
  mask: buildMask,
  fusion: buildFusion,
  'roots-core': buildRootsCore,
  'ghost-pack': buildGhostPack,
  'cosmic-dissolve': buildCosmicDissolve,
};

export function buildRelic(spec) {
  const builder = RELIC_BUILDERS[spec.type] || buildEgg;
  const relic = builder(spec);
  if (spec.position) relic.group.position.add(new THREE.Vector3(...spec.position));
  if (spec.scale) relic.group.scale.setScalar(spec.scale);
  relic.group.userData.isRelic = true;

  /* esfera invisível, maior que a geometria visível, usada como alvo de
     clique/raycast generoso (facilita acertar o objeto central) */
  const hit = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(relic.interactRadius * 0.55, 0.6), 12, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hit.position.y = relic.interactRadius * 0.55;
  hit.userData.isRelicHit = true;
  hit.userData.isRelic = true;
  hit.userData.infoId = 'central';
  relic.group.add(hit);
  relic.hitMesh = hit;

  /* qualquer parte visível da relíquia também é clicável e abre a
     decisão (não só a esfera invisível) */
  relic.group.traverse((child) => {
    if (child.isMesh) { child.userData.isRelic = true; child.userData.infoId = 'central'; }
  });

  return relic;
}

/* =========================================================================
   8. VAGA-LUMES E PERÍMETRO
   ========================================================================= */
export function buildFireflies(opts = {}) {
  const n = opts.count ?? 120;
  const radius = opts.radius ?? 13;
  const positions = new Float32Array(n * 3);
  const rand = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    positions[i * 3] = Math.cos(a) * r;
    positions[i * 3 + 1] = 0.3 + Math.random() * (opts.height ?? 3.2);
    positions[i * 3 + 2] = Math.sin(a) * r;
    rand[i] = Math.random();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
  const mat = createPointsMaterial({ color: opts.color || '#B7F03B', size: opts.size ?? 50, drift: opts.drift ?? 0.6 });
  const points = new THREE.Points(geo, mat);
  return { points, mat };
}

export function buildBoundary(radius, opts = {}) {
  const group = new THREE.Group();
  const count = opts.count ?? 14;
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * Math.PI * 2;
    const pillar = buildProp({
      type: 'pillar',
      position: [Math.cos(ang) * radius, 0, Math.sin(ang) * radius],
      rotation: [0, -ang, 0],
      height: opts.height ?? (5 + Math.random() * 2),
      glow: opts.glow || '#0E8C86',
    });
    group.add(pillar);
  }
  /* anel sutil marcando o limite no piso */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.06, radius + 0.06, 96),
    new THREE.MeshBasicMaterial({ color: opts.glow || '#0E8C86', transparent: true, opacity: 0.18, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  group.add(ring);
  return group;
}

/* =========================================================================
   9. PASSE DE COR — aberração cromática sutil + vinheta + tinta de rastro
   ========================================================================= */
const GradePass = {
  uniforms: {
    tDiffuse: { value: null },
    uAberration: { value: 0.0016 },
    uTint: { value: new THREE.Color('#0E8C86') },
    uTintStrength: { value: 0.0 },
    uVignette: { value: 0.92 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main(){
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uAberration, uTintStrength, uVignette;
    uniform vec3 uTint;
    varying vec2 vUv;
    void main(){
      vec2 dir = vUv - 0.5;
      vec2 off = dir * uAberration;
      float r = texture2D(tDiffuse, vUv - off).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv + off).b;
      vec3 color = vec3(r, g, b);
      color = mix(color, color * (uTint + 0.25), uTintStrength);
      float vig = smoothstep(1.1, uVignette * 0.4, length(dir) * 1.15);
      color *= mix(0.5, 1.0, vig);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

/* =========================================================================
   10. UTILITÁRIOS DE COR / RASTRO
   ========================================================================= */
function tintWithRastro(hex, amount = 0.16) {
  const dom = dominantRastro();
  const c = new THREE.Color(hex);
  if (dom && totalRastros() > 0) c.lerp(new THREE.Color(RASTRO_COLORS[dom]), amount);
  return c;
}

function applyAccent(config) {
  const root = document.documentElement.style;
  const accent = new THREE.Color(config.accent || '#0E8C86');
  const accent2 = new THREE.Color(config.accent2 || config.accent || '#4B1F68');
  const dom = dominantRastro();
  if (dom && totalRastros() > 0) accent.lerp(new THREE.Color(RASTRO_COLORS[dom]), 0.16);
  root.setProperty('--accent', `#${accent.getHexString()}`);
  root.setProperty('--accent-2', `#${accent2.getHexString()}`);
  root.setProperty('--accent-glow', `rgba(${Math.round(accent.r * 255)},${Math.round(accent.g * 255)},${Math.round(accent.b * 255)},0.28)`);
}

/* =========================================================================
   11. CONTEÚDO / IDIOMA
   -------------------------------------------------------------------------
   Todo o texto da experiência (nomes de sala, objetos clicáveis, relíquia
   central, verbos de escolha, strings de UI) vive em um único arquivo:
   content/ororo-content.json — PT/EN/ES/DE/ZH. Ver content/build_content.py
   para editar/regerar.
   ========================================================================= */

const LANG_KEY = 'ororo_lang';
let _content = null;
const _jsonCache = {};

export async function loadContent(path) {
  if (_content) return _content;
  try {
    const res = await fetch(path);
    _content = await res.json();
  } catch (e) {
    console.warn('[ORORO] não foi possível carregar content.json', e);
    _content = { ui: { pt: {}, en: {}, es: {}, de: {}, zh: {} }, rooms: {} };
  }
  return _content;
}

/* mensagem de erro visível em tela cheia (nunca falhar em silêncio) */
export function showFatalError(title, detail) {
  try {
    const box = document.createElement('div');
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:0;z-index:200;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:14px;padding:32px;text-align:center;' +
      'background:#05070c;color:#E8E1D2;font-family:monospace;';
    const h = document.createElement('div');
    h.textContent = title;
    h.style.cssText = 'color:#C1121F;font-size:1rem;letter-spacing:0.12em;';
    const p = document.createElement('pre');
    p.textContent = detail || '';
    p.style.cssText = 'color:#9aa2ad;font-size:0.72rem;line-height:1.6;white-space:pre-wrap;max-width:560px;';
    box.append(h, p);
    document.body.append(box);
  } catch (e) { /* noop */ }
  console.error('[ORORO]', title, detail);
}

/* carrega e cacheia um JSON qualquer (dados de sala, ui.json) */
export async function loadJSON(path) {
  if (_jsonCache[path]) return _jsonCache[path];
  const res = await fetch(path);
  if (!res.ok) throw new Error('HTTP ' + res.status + ' em ' + path);
  const data = await res.json();
  _jsonCache[path] = data;
  return data;
}

/* -------------------------------------------------------------------------
   novo modelo de dados: 1 JSON por sala (rooms/data/sala-XX.json) contendo
   { id, stage, name, scene{...}, props[{...,content}], central{...,choices} }
   + ui.json compartilhado. Esta função normaliza esse arquivo para o formato
   interno que o resto da engine já espera (config 3D + content{ui,rooms}).
   ------------------------------------------------------------------------- */
async function loadRoomData(config) {
  const roomFile = await loadJSON(config.dataPath);
  const ui = await loadJSON(config.uiPath || '../content/ui.json').catch(() => ({ pt: {}, en: {}, es: {}, de: {}, zh: {} }));
  const merged = Object.assign({}, roomFile.scene || {}, {
    id: roomFile.id,
    props: roomFile.props || [],
    central: roomFile.central || { type: 'egg' },
    portalHref: config.portalHref,
    contentPath: config.contentPath,
    dataPath: config.dataPath,
    autoEnter: config.autoEnter===true,
    internalTransition: config.internalTransition===true,
  });
  const objects = {};
  (roomFile.props || []).forEach((p) => { if (p.info && p.content) objects[p.info] = p.content; });
  const content = {
    ui,
    rooms: { [roomFile.id]: { stage: roomFile.stage, name: roomFile.name, objects, central: roomFile.central } },
  };
  return { config: merged, content };
}

export function getLang() {
  const l = localStorage.getItem(LANG_KEY);
  return ['pt','en','es','de','zh'].includes(l) ? l : 'pt';
}
export function setLang(lang) {
  localStorage.setItem(LANG_KEY, ['pt','en','es','de','zh'].includes(lang) ? lang : 'pt');
  document.documentElement.lang = {pt:'pt-BR',en:'en',es:'es',de:'de',zh:'zh-CN'}[getLang()] || 'en';
}

/* devolve o texto de um campo localizado {pt,en,es,de,zh} no idioma ativo */
export function L(field, lang) {
  if (!field) return '';
  const lg = lang || getLang();
  return field[lg] ?? field.pt ?? field.en ?? '';
}

/* =========================================================================
   12. INTERFACE (DOM)
   -------------------------------------------------------------------------
   Layout fixo em seis zonas:
     topo-esquerda  -> marca OROЯO (link para o início)
     topo-centro    -> nome do local
     topo-direita   -> número da sala (N / 07) + mute
     inferior-esq.  -> minimapa (bússola em tempo real)
     inferior-centro-> painel de interação (inspeção / decisão)
     inferior-dir.  -> rastros
   Mira central indica o estado de mira: repouso, sobre objeto vivo
   (vaga-lume) ou sobre o objeto central (dourado).
   ========================================================================= */

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

/* marca OROЯO com o Я isolado para alinhamento fino via CSS se necessário */
function brandHTML() {
  return 'ORO<span class="glyph-ya">Я</span>O';
}

/* ícones de alto-falante (ligado / mudo), minimalistas, traço único */
function muteIconHTML() {
  return `
    <svg class="icon-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9v6h3l4 4V5L7 9H4z"/>
      <path d="M16 9a4 4 0 0 1 0 6"/>
      <path d="M18.5 6.5a8 8 0 0 1 0 11"/>
    </svg>
    <svg class="icon-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 9v6h3l4 4V5L7 9H4z"/>
      <path d="M15 9l5 6M20 9l-5 6"/>
    </svg>
  `;
}

/* -------------------------------------------------------------------------
   véu / transição ritual
   -------------------------------------------------------------------------
   Um único elemento cobre a tela inteira. No carregamento, mostra o nome
   do local + "toque para entrar" (fade-out longo ao clicar). Ao escolher
   um verbo, o mesmo véu reaparece com o verbo em destaque (fade-in longo)
   antes da navegação — substitui o corte seco por uma metamorfose lenta.
   ------------------------------------------------------------------------- */
function buildVeil() {
  const veil = el('div', 'veil');
  veil.innerHTML = `
    <div class="veil-title"></div>
    <div class="veil-sub"></div>
    <div class="veil-controls"></div>
  `;
  return {
    el: veil,
    title: veil.querySelector('.veil-title'),
    sub: veil.querySelector('.veil-sub'),
    controls: veil.querySelector('.veil-controls'),
    show(title, sub, controls) {
      const self = this;
      
      // Se o véu está visível, fazer fade-out antes de mudar conteúdo
      if (!veil.classList.contains('is-hidden')) {
        self.title.classList.add('fade-out');
        self.sub.classList.add('fade-out');
        self.controls.classList.add('fade-out');
        
        setTimeout(() => {
          // Mudar conteúdo
          if (title === 'OROЯO') {
            self.title.innerHTML = '<span class="brand">OROЯO</span>';
          } else {
            self.title.textContent = title || '';
          }
          self.sub.textContent = sub || '';
          self.controls.textContent = controls || '';
          
          // Remover fade-out e adicionar fade-in
          self.title.classList.remove('fade-out');
          self.sub.classList.remove('fade-out');
          self.controls.classList.remove('fade-out');
          
          self.title.classList.add('fade-in');
          self.sub.classList.add('fade-in');
          self.controls.classList.add('fade-in');
          
          setTimeout(() => {
            self.title.classList.remove('fade-in');
            self.sub.classList.remove('fade-in');
            self.controls.classList.remove('fade-in');
          }, 800);
        }, 300);
      } else {
        // Primeira vez, sem fade
        if (title === 'OROЯO') {
          self.title.innerHTML = '<span class="brand">OROЯO</span>';
        } else {
          self.title.textContent = title || '';
        }
        self.sub.textContent = sub || '';
        self.controls.textContent = controls || '';
        veil.classList.remove('is-hidden');
      }
    },
    hide() {
      veil.classList.add('is-hidden');
    },
  };
}

function buildUI(config, content) {
  const lang = getLang();
  const ui_t = content.ui?.[lang] || {};
  const room = content.rooms?.[config.id] || {};

  const root = el('div');
  root.className = 'ororo-ui';

  const grain = el('div', 'screen-grain');
  const vignette = el('div', 'screen-vignette');
  const hud = el('div', 'hud');

  /* topo-esquerda: marca */
  const brand = el('a', 'hud-brand');
  brand.href = config.portalHref || '../index.html';
  brand.innerHTML = brandHTML();

  /* topo-centro: nome do local */
  const location = el('div', 'hud-location', L(room.name, lang) || '');

  /* topo-direita: número da sala + mute */
  const right = el('div', 'hud-right');
  const stage = el('div', 'hud-stage');
  const stageNum = String(room.stage ?? config.index ?? 1).padStart(2, '0');
  stage.innerHTML = `<b>${stageNum}</b> / 07`;
  const muteBtn = el('button', 'hud-mute', muteIconHTML());
  muteBtn.type = 'button';
  muteBtn.setAttribute('aria-label', ui_t.mute || 'mute');
  const a11yBtn = el('button', 'hud-a11y', 'A11Y');
  a11yBtn.type = 'button';
  a11yBtn.setAttribute('aria-label', ui_t.a11y_title || 'ACESSIBILIDADE');
  a11yBtn.setAttribute('aria-haspopup', 'true');
  a11yBtn.setAttribute('aria-expanded', 'false');
  right.append(stage, muteBtn, a11yBtn);

  /* menu de acessibilidade */
  const a11yMenu = buildA11yMenu(ui_t);
  a11yBtn.setAttribute('aria-controls', 'a11y-menu');

  /* mira central */
  const crosshair = el('div', 'crosshair', '<span class="dot"></span>');
  const navAssist = el('div', 'nav-assist');
  navAssist.setAttribute('aria-live','polite');
  navAssist.setAttribute('aria-atomic','true');

  /* minimapa */
  const minimapWrap = el('div', 'minimap');
  const minimapCanvas = document.createElement('canvas');
  minimapWrap.appendChild(minimapCanvas);

  /* monitor de FFT (ao lado do minimapa, minimalista, amarelo) */
  const fftWrap = el('div', 'fft-monitor');
  fftWrap.setAttribute('aria-hidden', 'true');
  fftWrap.title = 'FFT';
  const fftCanvas = document.createElement('canvas');
  fftWrap.appendChild(fftCanvas);

  /* painel de interação (inferior-centro) */
  const panelZone = el('div', 'panel-zone');

  /* rastros (inferior-direita) */
  const rastros = el('div', 'rastros');
  const rastrosToggle = el('button', 'rastros-toggle', ui_t.rastros_title || 'TRACES');
  rastrosToggle.type = 'button';
  const rastrosList = el('div', 'rastros-list');
  const rVals = getRastros();
  const maxVal = Math.max(4, ...RASTRO_KEYS.map((k) => rVals[k]));
  RASTRO_KEYS.forEach((k) => {
    const row = el('div', 'rastro-row');
    row.style.setProperty('--bar-color', RASTRO_COLORS[k]);
    row.style.setProperty('--val', String((rVals[k] / maxVal) * 10));
    const label = (ui_t.rastros && ui_t.rastros[k]) || k;
    row.innerHTML = `<span class="label">${label}</span><span class="bar"><i></i></span>`;
    rastrosList.append(row);
  });
  rastrosToggle.addEventListener('click', () => rastros.classList.toggle('is-open'));
  rastros.append(rastrosToggle, rastrosList);

  /* região viva para leitor de tela: anuncia o conteúdo dos modais */
  const live = el('div', 'sr-only');
  live.setAttribute('aria-live', 'polite');
  live.setAttribute('aria-atomic', 'true');

  /* véu */
  const veil = buildVeil();

  hud.append(brand, location, right);
  root.append(grain, vignette, hud, crosshair, navAssist, minimapWrap, fftWrap, panelZone, rastros, a11yMenu.el, live, veil.el);
  document.body.append(root);

  return {
    root, hud, brand, location, stage, muteBtn, a11yBtn, a11yMenu, live, crosshair, navAssist,
    minimapWrap, minimapCanvas, fftWrap, fftCanvas, panelZone, rastros, veil,
    lang, ui_t, room,
  };
}

/* -------------------------------------------------------------------------
   menu de acessibilidade: movimento reduzido, alto contraste, texto maior.
   Cada preferência é um data-attribute em <html>, persistido em localStorage.
   ------------------------------------------------------------------------- */
const A11Y_PREFS = [
  { key: 'motion',   attr: 'data-motion',   on: 'reduced', store: 'ororo_a11y_motion', label: 'a11y_motion', hint: 'a11y_motion_hint' },
  { key: 'contrast', attr: 'data-contrast', on: 'high', store: 'ororo_a11y_contrast', label: 'a11y_contrast', hint: 'a11y_contrast_hint' },
  { key: 'textsize', attr: 'data-textsize', on: 'large', store: 'ororo_a11y_textsize', label: 'a11y_textsize', hint: 'a11y_textsize_hint' },
  { key: 'crosshair',attr: 'data-crosshair',on: 'large', store: 'ororo_a11y_crosshair', label: 'a11y_crosshair', hint: 'a11y_crosshair_hint' },
  { key: 'effects',  attr: 'data-effects',  on: 'reduced', store: 'ororo_a11y_effects', label: 'a11y_effects', hint: 'a11y_effects_hint' },
  { key: 'navassist',attr: 'data-navassist',on: 'on', store: 'ororo_a11y_navassist', label: 'a11y_navassist', hint: 'a11y_navassist_hint' },
];

export function applyA11yPrefs() {
  A11Y_PREFS.forEach((p) => {
    const active = localStorage.getItem(p.store) === '1';
    if (active) document.documentElement.setAttribute(p.attr, p.on);
    else document.documentElement.removeAttribute(p.attr);
  });
}

function buildA11yMenu(ui_t) {
  const lang = getLang();
  const menu = el('div', 'a11y-menu');
  menu.id = 'a11y-menu';
  menu.setAttribute('role', 'menu');
  menu.setAttribute('aria-label', ui_t.a11y_title || 'ACESSIBILIDADE');
  const title = el('h2', null, ui_t.a11y_title || 'ACESSIBILIDADE');
  menu.append(title);
  const switches = {};
  A11Y_PREFS.forEach((p) => {
    const row = el('div', 'a11y-row');
    const labelWrap = el('div');
    const active = localStorage.getItem(p.store) === '1';
    labelWrap.innerHTML =
      `<span class="a11y-label">${ui_t[p.label] || p.label}` +
      `<span class="a11y-hint">${ui_t[p.hint] || ''}</span></span>`;
    const sw = el('button', 'a11y-switch');
    sw.type = 'button';
    sw.setAttribute('role', 'switch');
    sw.setAttribute('aria-checked', active ? 'true' : 'false');
    sw.setAttribute('aria-label', ui_t[p.label] || p.label);
    sw.addEventListener('click', () => {
      const now = sw.getAttribute('aria-checked') === 'true';
      const next = !now;
      sw.setAttribute('aria-checked', next ? 'true' : 'false');
      localStorage.setItem(p.store, next ? '1' : '0');
      applyA11yPrefs();
    });
    switches[p.key] = sw;
    row.append(labelWrap, sw);
    menu.append(row);
  });
  return { el: menu, switches };
}

/* -------------------------------------------------------------------------
   minimapa: desenha em canvas 2D, vista de cima (norte fixo)
   ------------------------------------------------------------------------- */
function buildMinimapDrawer(canvas, boundaryRadius) {
  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = canvas.parentElement.clientWidth || 108;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    return dpr;
  }
  let dpr = resize();
  const onResize=()=>{dpr=resize();};
  window.addEventListener('resize',onResize);

  function draw(playerPos, heading, relicPos, points, players=[]) {
    const W = canvas.width; const H = canvas.height;
    const cx = W / 2; const cy = H / 2;
    const pad = 9 * dpr;
    const scale = (Math.min(W, H) / 2 - pad) / boundaryRadius;
    ctx.clearRect(0, 0, W, H);

    /* perímetro da sala */
    ctx.beginPath();
    ctx.arc(cx, cy, boundaryRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(232,225,210,0.14)';
    ctx.lineWidth = 1 * dpr;
    ctx.stroke();

    /* pontos clicáveis (discretos) */
    ctx.fillStyle = 'rgba(133,139,148,0.55)';
    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(cx + p.x * scale, cy + p.z * scale, 1.3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    });

    /* objeto central (sempre marcado, dourado) */
    const rx = cx + relicPos.x * scale; const ry = cy + relicPos.z * scale;
    ctx.beginPath();
    ctx.arc(rx, ry, 3.4 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#C9A24A';
    ctx.shadowColor = '#C9A24A';
    ctx.shadowBlur = 6 * dpr;
    ctx.fill();
    ctx.shadowBlur = 0;

    /* outros jogadores */
    players.forEach((p)=>{
      const x=cx+p.x*scale,y=cy+p.z*scale;
      ctx.beginPath();ctx.arc(x,y,3*dpr,0,Math.PI*2);ctx.fillStyle=p.color||'#E8E1D2';ctx.shadowColor=p.color||'#E8E1D2';ctx.shadowBlur=4*dpr;ctx.fill();ctx.shadowBlur=0;
      ctx.beginPath();ctx.arc(x,y,4.5*dpr,0,Math.PI*2);ctx.strokeStyle='rgba(232,225,210,.7)';ctx.lineWidth=.8*dpr;ctx.stroke();
    });

    /* jogador, triângulo apontando para a direção REAL do olhar.
       heading já vem calculado a partir de camera.getWorldDirection()
       (atan2(fwd.x, -fwd.z)), corrigindo o sentido antes invertido. */
    const px = cx + playerPos.x * scale; const py = cy + playerPos.z * scale;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.beginPath();
    ctx.moveTo(0, -4.5 * dpr);
    ctx.lineTo(3.2 * dpr, 4 * dpr);
    ctx.lineTo(-3.2 * dpr, 4 * dpr);
    ctx.closePath();
    ctx.fillStyle = '#B7F03B';
    ctx.shadowColor = '#B7F03B';
    ctx.shadowBlur = 5 * dpr;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
  draw.dispose=()=>window.removeEventListener('resize',onResize);
  return draw;
}

function projectToScreen(vec3, camera, w, h) {
  const p = vec3.clone().project(camera);
  return {
    x: (p.x * 0.5 + 0.5) * w,
    y: (1 - (p.y * 0.5 + 0.5)) * h,
    z: p.z,
    visible: p.z < 1,
  };
}

/* =========================================================================
   13. SALA — função principal
   ========================================================================= */
export async function initRoom(config) {
  applyA11yPrefs();
  const savedProfile = avatarProfile();
  const userProfile = savedProfile && avatarAccessKey() ? savedProfile : await chooseAvatar(config.id);
  if (!userProfile) { window.location.href = '../index.html'; return null; }
  let multiplayer = null;
  const lifecycle=new AbortController();
  const life={signal:lifecycle.signal};
  let destroyed=false,rafId=0;
  let content;
  if (config.dataPath) {
    /* novo modelo: 1 JSON por sala */
    try {
      const loaded = await loadRoomData(config);
      config = loaded.config;
      content = loaded.content;
    } catch (err) {
      const loadErr = {
        pt:['Não foi possível carregar os dados da sala.','Se você acabou de atualizar o projeto, faça um refresh forçado (Ctrl/Cmd+Shift+R) para limpar o cache do navegador.'],
        en:['Could not load the room data.','If you just updated the project, do a hard refresh (Ctrl/Cmd+Shift+R) to clear the browser cache.'],
        es:['No se pudieron cargar los datos de la sala.','Si acabas de actualizar el proyecto, haz una recarga forzada (Ctrl/Cmd+Shift+R) para limpiar la caché del navegador.'],
        de:['Die Raumdaten konnten nicht geladen werden.','Wenn du das Projekt gerade aktualisiert hast, führe einen Hard-Refresh (Ctrl/Cmd+Shift+R) aus, um den Browser-Cache zu leeren.'],
        zh:['无法加载房间数据。','如果你刚刚更新了项目，请强制刷新（Ctrl/Cmd+Shift+R）以清除浏览器缓存。'],
      }[getLang()] || ['Could not load the room data.','Do a hard refresh (Ctrl/Cmd+Shift+R) to clear the browser cache.'];
      showFatalError(
        loadErr[0],
        `${config.dataPath}\n${err && err.message ? err.message : err}\n\n${loadErr[1]}`
      );
      throw err;
    }
  } else {
    /* modelo antigo: config 3D inline no HTML + content.json único */
    content = await loadContent(config.contentPath || '../content/ororo-content.json');
  }
  applyAccent(config);
  const lang = getLang();
  document.documentElement.lang = {pt:'pt-BR',en:'en',es:'es',de:'de',zh:'zh-CN'}[lang] || 'en';
  const roomData = content.rooms?.[config.id] || {};
  const uiText = content.ui?.[lang] || {};

  const canvas = document.getElementById('scene-canvas');
  const ui = buildUI(config, content);

  /* ---------------- cena base ---------------- */
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(config.fog || '#04060a');
  /* névoa um pouco mais rala: aumenta a profundidade visível sem clarear a
     paleta (as salas estavam escuras demais na distância) */
  scene.fog = new THREE.FogExp2(fogColor, (config.fogDensity ?? 0.05) * 0.8);
  scene.background = fogColor;

  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 100);
  const spawn = config.spawn || { position: [0, 1.65, 7], yaw: Math.PI };
  camera.position.set(...spawn.position);
  let yaw = spawn.yaw ?? Math.PI;
  let pitch = spawn.pitch ?? -0.05;
  camera.rotation.order = 'YXZ';
  camera.rotation.set(pitch, yaw, 0);

  /* em telas de toque, limita o pixel ratio para manter o shader do piso
     (o mais pesado da cena) fluido em aparelhos móveis */
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isCoarsePointer, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  /* exposição global elevada (~+25%): clareia as salas mantendo a paleta.
     Pode ser sobrescrito por config.exposure em cada sala. */
  renderer.toneMappingExposure = (config.exposure ?? 1.25) * 1.25;

  /* ---------------- luz ----------------------------------------------------
     iluminação geral elevada (a sala precisa ser visível) mas a paleta
     continua escura: o "dark" é de estilo (cores, contraste, névoa), não
     de exposição. Spots dedicados (buildGallerySpot) iluminam vitrines,
     pedestais e a relíquia central como obras em exposição.
     Esta rodada eleva o piso de luz (ambiente/hemisfério + um preenchimento
     suave de cima) porque as salas estavam escuras demais. */
  const ambient = new THREE.AmbientLight(new THREE.Color(config.ambient?.color || '#1a2230'), (config.ambient?.intensity ?? 0.85) * 1.45);
  scene.add(ambient);
  const hemi = new THREE.HemisphereLight(new THREE.Color(config.accent2 || '#243B8F'), new THREE.Color('#090c14'), 0.95);
  scene.add(hemi);
  /* preenchimento neutro de cima: dá forma aos objetos e levanta as sombras
     sem lavar a cor (intensidade baixa, tom quase branco frio) */
  const fill = new THREE.DirectionalLight(new THREE.Color('#c8d0e2'), 0.4);
  fill.position.set(0.6, 9, 2.5);
  scene.add(fill);
  if (config.keyLight) {
    const key = new THREE.PointLight(new THREE.Color(config.keyLight.color || config.accent), (config.keyLight.intensity ?? 4) * 1.6, config.keyLight.distance ?? 15, config.keyLight.decay ?? 2);
    key.position.set(...(config.keyLight.position || [0, 5, 2]));
    scene.add(key);
  }

  /* ---------------- piso ---------------- */
  const boundaryRadius = config.boundary?.radius ?? 13;
  const floorOpts = Object.assign({
    fogColor: config.fog, fogDensity: config.fogDensity ?? 0.05,
  }, config.floor || {});
  floorOpts.glow = tintWithRastro(floorOpts.glow || config.accent2 || '#0E8C86', 0.22);
  const floorMat = createFloorMaterial(floorOpts);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(boundaryRadius + 3, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  /* ---------------- perímetro ---------------- */
  const boundary = buildBoundary(boundaryRadius, {
    glow: tintWithRastro(config.boundary?.glow || config.accent || '#0E8C86', 0.18),
    height: config.boundary?.height,
    count: config.boundary?.count,
  });
  scene.add(boundary);

  /* ---------------- vaga-lumes ---------------- */
  const fireOpts = Object.assign({}, config.fireflies || {});
  fireOpts.color = tintWithRastro(fireOpts.color || '#B7F03B', 0.25);
  fireOpts.radius = fireOpts.radius ?? boundaryRadius - 1;
  const fireflies = buildFireflies(fireOpts);
  scene.add(fireflies.points);

  function createClickableSpot(position, opts = {}) {
    const spotGroup = buildGallerySpot(new THREE.Color(0xB7F03B), Object.assign({
      height: 1.2,
      intensity: 0.9,
      distance: 4,
      angle: Math.PI / 6,
      penumbra: 0.8,
      pool: false,
    }, opts));
    spotGroup.position.copy(position);
    spotGroup.userData.isClickableSpot = true;
    return spotGroup;
  }

  /* ---------------- objetos de cena ---------------- */
  const animatedProps = [];
  const shaderProps = [];
  const clickable = [];       // meshes com userData.infoId, alvo do raycaster
  const clickableLights = []; // spots de luz pulsante para objetos clicáveis
  const minimapPoints = [];   // posições (x,z) dos objetos clicáveis comuns
  (config.props || []).forEach((spec) => {
    const prop = buildProp(spec);
    scene.add(prop);
    if (prop.userData.animated) animatedProps.push(...prop.userData.animated);
    if (prop.userData.shaderMats) shaderProps.push(...prop.userData.shaderMats);
    if (spec.info) {
      prop.traverse((child) => { if (child.isMesh) clickable.push(child); });
      minimapPoints.push({ x: spec.position?.[0] ?? 0, z: spec.position?.[2] ?? 0, info:spec.info });
      const worldPos = new THREE.Vector3();
      prop.getWorldPosition(worldPos);
      const spot = createClickableSpot(worldPos, { height: 1.6, intensity: 1.0, distance: 5, angle: Math.PI / 7 });
      scene.add(spot);
      clickableLights.push(spot);
    }
  });

  /* ---------------- relíquia central ---------------- */
  const centralSpec = Object.assign({}, config.central || { type: 'egg' });
  centralSpec.glow = tintWithRastro(centralSpec.glow || config.accent || '#0E8C86', 0.2);
  centralSpec.accent = config.accent;
  const relic = buildRelic(centralSpec);
  scene.add(relic.group);
  const relicWorldPos = new THREE.Vector3();
  clickable.push(relic.hitMesh);

  /* highlight pulsante da relíquia central */
  const relicClickSpot = createClickableSpot(new THREE.Vector3(0, 0, 0), {
    height: relic.interactRadius * 1.1,
    intensity: 1.3,
    distance: 5.8,
    angle: Math.PI / 6,
  });
  relic.group.add(relicClickSpot);
  clickableLights.push(relicClickSpot);

  /* spot de galeria principal: ilumina a obra central de cima, em tom
     quase neutro com leve tinta da cor de destaque da sala — reforça a
     leitura de "peça em exposição" sobre o piso escuro */
  const relicGalleryColor = new THREE.Color('#E7E3D8').lerp(new THREE.Color(config.accent || '#0E8C86'), 0.16);
  const relicSpot = buildGallerySpot(relicGalleryColor, {
    height: 5.4, intensity: 15, distance: 12, angle: Math.PI / 7, penumbra: 0.55, poolOpacity: 0.36,
  });
  relicSpot.position.copy(relic.group.position);
  relicSpot.children[1].position.set(0, 1.3, 0); // target: meio da relíquia
  scene.add(relicSpot);

  /* ---------------- pós-processamento ---------------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const baseBloomStrength=config.bloom?.strength ?? 0.4,baseBloomRadius=config.bloom?.radius ?? 0.45;
  const reducedEffects=document.documentElement.getAttribute('data-effects')==='reduced';
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), reducedEffects?Math.min(.14,baseBloomStrength):baseBloomStrength, reducedEffects?0.2:baseBloomRadius, config.bloom?.threshold ?? 0.84);
  composer.addPass(bloom);
  const grade = new ShaderPass(GradePass);
  const dom = dominantRastro();
  if (dom) {
    grade.uniforms.uTint.value = new THREE.Color(RASTRO_COLORS[dom]);
    grade.uniforms.uTintStrength.value = Math.min(0.16, totalRastros() * 0.012);
  }
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  /* ---------------- raycaster / interação ---------------- */
  const raycaster = new THREE.Raycaster();
  const laserRaycaster=new THREE.Raycaster();laserRaycaster.far=42;
  const laserFallbackDir=new THREE.Vector3();
  function getLaserTarget(){
    laserRaycaster.setFromCamera({x:0,y:0},camera);
    const hits=laserRaycaster.intersectObjects(scene.children,true);
    const hit=hits.find(h=>h.distance>.18&&h.object?.visible!==false&&!h.object?.userData?.noLaser&&!(h.object?.isPoints));
    if(hit)return hit.point.clone();
    camera.getWorldDirection(laserFallbackDir);return camera.position.clone().addScaledVector(laserFallbackDir,30);
  }
  raycaster.params.Points.threshold = 0.35;
  const ndc = new THREE.Vector2(0, 0);

  function maxDistFor(obj) {
    return obj.userData.isRelic ? relic.interactRadius + 2.4 : 9;
  }

  let panelOpen = false;
  let panelKind = null; // 'info' | 'decision'
  let lastFocused = null;
  const roomAudioIntensityBase = Object.assign({}, getAudioConfig(config.id), config.audio || {}).intensity ?? 0.55;
  const roomAudioIntensity = roomAudioIntensityBase * (isCoarsePointer ? 0.78 : 1);

  /* divide o corpo em parágrafos (quebra dupla vira <p>) para textos longos */
  function bodyHTML(text) {
    const parts = String(text || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    if (parts.length <= 1) return `<p class="panel-body">${text || ''}</p>`;
    return parts.map((p) => `<p class="panel-body">${p}</p>`).join('');
  }

  /* mantém o Tab preso dentro do modal aberto (acessibilidade de teclado) */
  function trapFocus(e) {
    if (!panelOpen || e.key !== 'Tab') return;
    const modal = ui.panelZone.querySelector('.panel');
    if (!modal) return;
    const focusables = modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function mountModal(panel, describedById) {
    lastFocused = document.activeElement;
    const backdrop = el('div', 'modal-backdrop');
    backdrop.addEventListener('click', () => closePanel());
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('tabindex', '-1');
    ui.panelZone.append(backdrop, panel);
    controlsEnabled = false;
    panelOpen = true;
    /* som de abertura + abafa o ambiente */
    ORORO_AUDIO.modalOpen();
    ORORO_AUDIO.duck(roomAudioIntensity * 0.45, 0.4);
    window.addEventListener('keydown', trapFocus, true);
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
      panel.classList.add('is-open');
      const focusTarget = panel.querySelector('.choice, .panel-close') || panel;
      try { focusTarget.focus(); } catch (e) {}
    });
    /* anuncia ao leitor de tela */
    if (describedById) {
      const t = panel.querySelector('.panel-title')?.textContent || '';
      const b = panel.querySelector('.panel-body')?.textContent || '';
      ui.live.textContent = `${t}. ${b}`;
    }
  }

  function closePanel(silent) {
    if (!panelOpen) return;
    ui.panelZone.innerHTML = '';
    panelOpen = false;
    panelKind = null;
    controlsEnabled = true;
    window.removeEventListener('keydown', trapFocus, true);
    ui.live.textContent = '';
    if (!silent) {
      ORORO_AUDIO.modalClose();
      ORORO_AUDIO.unduck(roomAudioIntensity, 0.7);
    }
    /* devolve o foco ao canvas para continuar navegando pelo teclado */
    const back = (lastFocused && document.body.contains(lastFocused)) ? lastFocused : canvas;
    try { back.focus(); } catch (e) {}
    lastFocused = null;
  }

  function openInfoPanel(infoId) {
    const data = roomData.objects?.[infoId];
    if (!data) return;
    ui.panelZone.innerHTML = '';
    const panel = el('div', 'panel panel-info');
    panel.setAttribute('aria-labelledby', 'modal-title');
    panel.setAttribute('aria-describedby', 'modal-body');
    panel.innerHTML = `
      <div class="panel-head">
        <span class="panel-title" id="modal-title">${L(data.title, lang)}</span>
        <button type="button" class="panel-close" aria-label="${uiText.close || 'close'}">×</button>
      </div>
      <div id="modal-body">${bodyHTML(L(data.body, lang))}</div>
    `;
    panel.querySelector('.panel-close').addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
    panelKind = 'info';
    mountModal(panel, 'modal-body');
  }

  function openDecisionPanel() {
    const data = roomData.central;
    if (!data) return;
    ui.panelZone.innerHTML = '';
    const panel = el('div', 'panel panel-decision');
    panel.setAttribute('aria-labelledby', 'modal-title');
    panel.setAttribute('aria-describedby', 'modal-body');
    const choicesHTML = (data.choices || []).map((c) => `
      <button type="button" class="choice">
        <span class="choice-verb">${L(c.verb, lang)}</span>
        <span class="choice-detail">${L(c.detail, lang)}</span>
      </button>
    `).join('');
    panel.innerHTML = `
      <div class="panel-head">
        <span class="panel-title" id="modal-title">${L(data.title, lang)}</span>
        <button type="button" class="panel-close" aria-label="${uiText.close || 'close'}">×</button>
      </div>
      <div id="modal-body">${bodyHTML(L(data.body, lang))}</div>
      <div class="panel-choices" role="group" aria-label="${uiText.choices_label || uiText.close || ''}"></div>
    `;
    panel.querySelector('.panel-choices').innerHTML = choicesHTML;
    panel.querySelector('.panel-close').addEventListener('click', (e) => { e.stopPropagation(); closePanel(); });
    panel.querySelectorAll('.choice').forEach((btn, i) => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); chooseOption(data.choices[i]); });
    });
    panelKind = 'decision';
    mountModal(panel, 'modal-body');
  }

  function chooseOption(choiceData) {
    if (choiceData.reset) resetExperience();
    else addRastros(choiceData.rastro || {});
    logChoice(config.id, L(choiceData.verb, 'pt'));
    markVisited(config.id);
    ORORO_AUDIO.modalClose();       // som de resposta à mensagem
    closePanel(true);               // fecha sem re-emitir SFX nem reabrir o som
    ORORO_AUDIO.duck(0.04, 1.2);    // abafa para a transição ritual
    controlsEnabled = false;
    ui.veil.show(L(choiceData.verb, lang), '', '');
    setTimeout(() => { navigateRoomDocument(choiceData.next).catch(()=>{ window.location.href=choiceData.next; }); }, 2200);
  }

  function handleClick(clientX, clientY) {
    ndc.x = (clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    const peerHit = multiplayer?.pick(raycaster);
    if (peerHit && (!hits.length || peerHit.distance < hits[0].distance)) {
      multiplayer.openPeer(peerHit.object.userData.peerId);
      return;
    }
    if (!hits.length) {
      if (panelOpen && panelKind === 'info') closePanel();
      return;
    }
    const hit = hits[0];
    if (hit.distance > maxDistFor(hit.object)) {
      if (panelOpen && panelKind === 'info') closePanel();
      return;
    }
    if (hit.object.userData.isRelic) openDecisionPanel();
    else if (hit.object.userData.infoId) openInfoPanel(hit.object.userData.infoId);
  }

  /* ---------------- controles ---------------- */
  const keys = {};
  let dragging = false, dragMoved = false, lastX = 0, lastY = 0, dragStart = 0;
  let controlsEnabled = false; // liberado ao sair do véu de entrada
  const PITCH_LIMIT = 1.15;

  canvas.style.touchAction = 'none';
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY; dragStart = performance.now();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }, life);
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || !controlsEnabled) return;
    const dx = e.clientX - lastX; const dy = e.clientY - lastY;
    if (Math.abs(dx) + Math.abs(dy) > 6) dragMoved = true;
    yaw -= dx * 0.0026;
    pitch -= dy * 0.0026;
    pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, pitch));
    lastX = e.clientX; lastY = e.clientY;
  }, life);
  window.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    const elapsed = performance.now() - dragStart;
    if (!dragMoved && elapsed < 450 && controlsEnabled) handleClick(e.clientX, e.clientY);
  }, life);
  window.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input, select, textarea, button, dialog, .mp-hud')) return;
    keys[e.code] = true;
    if ((e.code === 'KeyE' || e.code === 'Enter') && controlsEnabled) {
      handleClick(window.innerWidth / 2, window.innerHeight / 2);
    }
    if (e.code === 'Escape') {
      if (panelOpen) closePanel();
      else if (a11yOpen) closeA11yMenu();
    }
  }, life);
  window.addEventListener('keyup', (e) => { keys[e.code] = false; }, life);
  window.addEventListener('blur', () => { Object.keys(keys).forEach(k => keys[k] = false); }, life);

  /* ---------------- menu de acessibilidade ---------------- */
  let a11yOpen = false;
  function openA11yMenu() {
    a11yOpen = true;
    ui.a11yMenu.el.classList.add('is-open');
    ui.a11yBtn.classList.add('is-active');
    ui.a11yBtn.setAttribute('aria-expanded', 'true');
    const first = ui.a11yMenu.el.querySelector('.a11y-switch');
    if (first) try { first.focus(); } catch (e) {}
  }
  function closeA11yMenu() {
    a11yOpen = false;
    ui.a11yMenu.el.classList.remove('is-open');
    ui.a11yBtn.classList.remove('is-active');
    ui.a11yBtn.setAttribute('aria-expanded', 'false');
  }
  ui.a11yBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (a11yOpen) { closeA11yMenu(); try { ui.a11yBtn.focus(); } catch (err) {} }
    else openA11yMenu();
  });
  /* clicar fora fecha o menu */
  window.addEventListener('pointerdown', (e) => {
    if (a11yOpen && !ui.a11yMenu.el.contains(e.target) && e.target !== ui.a11yBtn) closeA11yMenu();
  }, life);

  /* joystick mobile estilo gamepad: uma zona grande recebe o polegar e o
     controle nasce sob o toque. Isso permite andar com um dedo e olhar com
     outro no lado direito da tela, sem exigir acertar um círculo pequeno. */
  const stickVec = { x: 0, y: 0 };
  const stickTarget = { x: 0, y: 0 };
  if (isCoarsePointer) {
    const zone = el('div', 'touch-stick-zone');
    const stick = el('div', 'touch-stick');
    const nub = el('div', 'nub');
    const centerDot = el('div', 'center-dot');
    stick.append(centerDot, nub);
    document.body.append(zone, stick);

    let active = false; let sid = null; let originX = 0; let originY = 0;
    const maxR = 58;
    const deadzone = 0.1;

    const setStickCenter = (x, y) => {
      const radius = 78;
      const safeX = Math.max(radius + 8, Math.min(window.innerWidth - radius - 8, x));
      const safeY = Math.max(radius + 8, Math.min(window.innerHeight - radius - 8, y));
      originX = safeX; originY = safeY;
      stick.style.left = `${safeX}px`;
      stick.style.top = `${safeY}px`;
      stick.style.bottom = 'auto';
    };

    const updateStick = (x, y) => {
      let dx = x - originX; let dy = y - originY;
      const len = Math.hypot(dx, dy);
      const clamped = Math.min(len, maxR);
      if (len > maxR && len > 0) { dx = dx / len * maxR; dy = dy / len * maxR; }
      nub.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;

      const raw = clamped / maxR;
      if (raw <= deadzone || len < 0.001) {
        stickTarget.x = 0; stickTarget.y = 0;
      } else {
        const magnitude = Math.pow((raw - deadzone) / (1 - deadzone), 1.08);
        stickTarget.x = (dx / Math.max(clamped, 0.001)) * magnitude;
        stickTarget.y = (dy / Math.max(clamped, 0.001)) * magnitude;
      }
    };

    zone.addEventListener('pointerdown', (e) => {
      if (!controlsEnabled || active || (e.pointerType === 'mouse')) return;
      active = true; sid = e.pointerId;
      setStickCenter(e.clientX, e.clientY);
      stick.classList.add('is-active');
      zone.classList.add('is-active');
      updateStick(e.clientX, e.clientY);
      try { zone.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    zone.addEventListener('pointermove', (e) => {
      if (!active || e.pointerId !== sid) return;
      updateStick(e.clientX, e.clientY);
      e.preventDefault();
    });
    const reset = (e) => {
      if (!active || (e && e.pointerId !== sid)) return;
      active = false; sid = null;
      stickTarget.x = 0; stickTarget.y = 0;
      nub.style.transform = 'translate(-50%,-50%)';
      stick.classList.remove('is-active');
      zone.classList.remove('is-active');
      stick.style.left = ''; stick.style.top = ''; stick.style.bottom = '';
    };
    zone.addEventListener('pointerup', reset);
    zone.addEventListener('pointercancel', reset);
    window.addEventListener('blur', () => reset(), life);
  }

  /* ---------------- véu de entrada ---------------- */
  let introClosed = false;
  ui.veil.show(
    L(roomData.name, lang),
    uiText.enter_prompt || 'TAP TO ENTER',
    config.showControls ? (uiText.controls || '') : ''
  );
  function enterRoom() {
    if (introClosed) return;
    introClosed = true;
    /* Em mobile, o toque que fecha o véu ainda conta como gesto do usuário.
       Aproveitamos esse gesto para pedir fullscreen. Browsers que não oferecem
       Fullscreen API simplesmente seguem com 100dvh, sem bloquear a entrada. */
    if (isCoarsePointer && !document.fullscreenElement && !document.webkitFullscreenElement) {
      const root = document.documentElement;
      try {
        const req = root.requestFullscreen || root.webkitRequestFullscreen;
        if (req) {
          const result = req.call(root, { navigationUI: 'hide' });
          if (result && typeof result.catch === 'function') result.catch(() => {});
        }
      } catch (e) {}
    }
    document.body.classList.toggle('room-mobile-fullscreen', isCoarsePointer);
    ui.veil.hide();
    controlsEnabled = true;
    if (ORORO_AUDIO.isEnabled()) {
      const audioCfg = Object.assign({}, getAudioConfig(config.id), config.audio || {});
      if (isCoarsePointer) audioCfg.intensity = (audioCfg.intensity ?? 0.55) * 0.78;
      ORORO_AUDIO.start(audioCfg);
    }
    updateMuteIcon();
    canvas.focus();
  }
  ui.veil.el.addEventListener('click', enterRoom);
  if(config.autoEnter) requestAnimationFrame(enterRoom);

  /* ---------------- som ---------------- */
  function updateMuteIcon() {
    ui.muteBtn.classList.toggle('is-muted', !ORORO_AUDIO.isEnabled());
  }
  updateMuteIcon();
  ui.muteBtn.addEventListener('click', () => {
    const on = !ORORO_AUDIO.isEnabled();
    ORORO_AUDIO.setEnabled(on);
    if (on) {
      const audioCfg = Object.assign({}, getAudioConfig(config.id), config.audio || {});
      if (isCoarsePointer) audioCfg.intensity = (audioCfg.intensity ?? 0.55) * 0.78;
      ORORO_AUDIO.start(audioCfg);
    } else ORORO_AUDIO.stop();
    updateMuteIcon();
  });

  /* ---------------- minimapa ---------------- */
  const drawMinimap = buildMinimapDrawer(ui.minimapCanvas, boundaryRadius);

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const minimapFwd = new THREE.Vector3();

  /* ---------------- monitor de FFT ----------------
     lê o AnalyserNode do áudio da sala e desenha barras minimalistas em
     amarelo (mesmo tom do triângulo do jogador no minimapa). Se não houver
     áudio rodando, mantém uma linha de base tênue. */
  const fftCtx = ui.fftCanvas.getContext('2d');
  let fftData = null;
  let lastFFTDraw = -Infinity;
  function sizeFFT() {
    const dprF = Math.min(window.devicePixelRatio || 1, 2);
    const w = ui.fftWrap.clientWidth || 108;
    const h = ui.fftWrap.clientHeight || 34;
    ui.fftCanvas.width = Math.round(w * dprF);
    ui.fftCanvas.height = Math.round(h * dprF);
    return dprF;
  }
  let fftDpr = sizeFFT();
  window.addEventListener('resize', () => { fftDpr = sizeFFT(); }, life);
  const FFT_BINS = 22;
  function drawFFT(t) {
    const an = ORORO_AUDIO.getAnalyser();
    const W = ui.fftCanvas.width, H = ui.fftCanvas.height;
    const bw = W / FFT_BINS;
    fftCtx.clearRect(0, 0, W, H);
    if (!an) {
      /* som desligado: espectro idle animado (baixo), para o monitor ficar
         claramente visível mesmo sem áudio rodando */
      for (let i = 0; i < FFT_BINS; i++) {
        const v = 0.06 + 0.05 * (0.5 + 0.5 * Math.sin((t || 0) * 1.6 + i * 0.55));
        const bh = Math.max(1 * fftDpr, v * (H - 2 * fftDpr));
        fftCtx.fillStyle = 'rgba(183,240,59,0.28)';
        fftCtx.fillRect(i * bw + bw * 0.16, H - bh, bw * 0.68, bh);
      }
      return;
    }
    if (!fftData || fftData.length !== an.frequencyBinCount) fftData = new Uint8Array(an.frequencyBinCount);
    an.getByteFrequencyData(fftData);
    const step = Math.floor(fftData.length / FFT_BINS);
    for (let i = 0; i < FFT_BINS; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += fftData[i * step + j];
      const v = (sum / step) / 255;
      const bh = Math.max(1 * fftDpr, v * (H - 2 * fftDpr));
      const alpha = 0.4 + v * 0.55;
      fftCtx.fillStyle = 'rgba(183,240,59,' + alpha.toFixed(3) + ')';
      fftCtx.fillRect(i * bw + bw * 0.16, H - bh, bw * 0.68, bh);
    }
  }

  function resize() {
    const w = window.innerWidth; const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    bloom.setSize(w, h);
  }
  window.addEventListener('resize', resize, life);

  function animate() {
    if(destroyed)return;
    rafId=requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    const fxReduced=document.documentElement.getAttribute('data-effects')==='reduced';bloom.strength=fxReduced?Math.min(.14,baseBloomStrength):baseBloomStrength;bloom.radius=fxReduced ? 0.2 : baseBloomRadius;

    /* movimento */
    if (controlsEnabled && !multiplayer?.isModalOpen()) {
      camera.rotation.set(pitch, yaw, 0);
      let mx = 0; let mz = 0;
      if (keys.KeyW || keys.ArrowUp) mz -= 1;
      if (keys.KeyS || keys.ArrowDown) mz += 1;
      if (keys.KeyA || keys.ArrowLeft) mx -= 1;
      if (keys.KeyD || keys.ArrowRight) mx += 1;
      const stickResponse = 1 - Math.exp(-20 * dt);
      stickVec.x += (stickTarget.x - stickVec.x) * stickResponse;
      stickVec.y += (stickTarget.y - stickVec.y) * stickResponse;
      mx += stickVec.x; mz += stickVec.y;
      const len = Math.hypot(mx, mz);
      if (len > 0.001) {
        mx /= Math.max(len, 1); mz /= Math.max(len, 1);
        camera.getWorldDirection(forward);
        forward.y = 0; forward.normalize();
        right.crossVectors(forward, up).normalize();
        const speed = (config.moveSpeed ?? 3.2) * dt;
        camera.position.addScaledVector(forward, -mz * speed);
        camera.position.addScaledVector(right, mx * speed);
        const r2 = camera.position.x * camera.position.x + camera.position.z * camera.position.z;
        const maxR = boundaryRadius - 0.7;
        if (r2 > maxR * maxR) {
          const s = maxR / Math.sqrt(r2);
          camera.position.x *= s; camera.position.z *= s;
        }
        camera.position.y = (spawn.position[1] || 1.65) + Math.sin(t * 4.2) * 0.012 * Math.min(1, len);
      }
    }

    /* uniforms de tempo */
    floorMat.uniforms.uTime.value = t;
    floorMat.uniforms.uCameraPos.value.copy(camera.position);
    fireflies.mat.uniforms.uTime.value = t;
    shaderProps.forEach((m) => { if (m.uniforms?.uTime) m.uniforms.uTime.value = t; });
    relic.update(t, camera);
    relic.group.traverse((o) => {
      if (o.material?.uniforms?.uCameraPos) o.material.uniforms.uCameraPos.value.copy(camera.position);
    });

    /* fragmentos animados (vitrines, pedestais, shards) */
    animatedProps.forEach((m) => {
      if (m.material?.uniforms?.uTime) m.material.uniforms.uTime.value = t;
      if (m.material?.uniforms?.uCameraPos) m.material.uniforms.uCameraPos.value.copy(camera.position);
      m.rotation.y += (m.userData.spin || 0.1) * dt;
      m.position.y = (m.userData.baseY || 0) + Math.sin(t * (m.userData.bobSpeed || 1) + (m.userData.bobPhase || 0)) * 0.06;
    });

    /* mira: raycast a partir do centro da tela contra objetos clicáveis */
    if (controlsEnabled && !panelOpen && !multiplayer?.isModalOpen()) {
      ndc.set(0, 0);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(clickable, false);
      const peerHit = multiplayer?.pick(raycaster);
      const overPeer = !!peerHit && (!hits.length || peerHit.distance < hits[0].distance);
      ui.crosshair.classList.toggle('is-user', overPeer);
      let state = '';
      if (overPeer) state = 'is-hover';
      else if (hits.length && hits[0].distance <= maxDistFor(hits[0].object)) {
        state = hits[0].object.userData.isRelic ? 'is-relic' : 'is-hover';
      }
      ui.crosshair.classList.toggle('is-relic', state === 'is-relic');
      ui.crosshair.classList.toggle('is-hover', state === 'is-hover');
    } else {
      ui.crosshair.classList.remove('is-relic', 'is-hover', 'is-user');
    }

    /* animar spots pulsantes para objetos clicáveis */
    clickableLights.forEach((g, index) => {
      const spot = g.children.find((child) => child.isSpotLight);
      if (!spot) return;
      const pulse = Math.sin(t * 2.2 + index * 0.9) * 0.16 + 0.95;
      spot.intensity = pulse;
    });

    /* minimapa — heading a partir da direção real da câmera */
    relic.group.getWorldPosition(relicWorldPos);
    camera.getWorldDirection(minimapFwd);
    const heading = Math.atan2(minimapFwd.x, -minimapFwd.z);
    drawMinimap(camera.position, heading, relicWorldPos, minimapPoints, multiplayer?.minimapPlayers?.()||[]);

    if(document.documentElement.getAttribute('data-navassist')==='on'){
      let best=null,bestD=Infinity;
      for(const mp of minimapPoints){const d=Math.hypot(camera.position.x-mp.x,camera.position.z-mp.z);if(d<bestD){bestD=d;best=mp;}}
      const relicD=Math.hypot(camera.position.x-relicWorldPos.x,camera.position.z-relicWorldPos.z);
      if(relicD<bestD){bestD=relicD;best={central:true};}
      if(best){const title=best.central?L(roomData.central?.title,lang):L(roomData.objects?.[best.info]?.title,lang);ui.navAssist.textContent=`${title||''} · ${bestD.toFixed(1)} m`;}
    }else ui.navAssist.textContent='';

    /* monitor de FFT do áudio da sala. Em touch, 15 fps é suficiente e
       deixa mais tempo de CPU para áudio e renderização principal. */
    if (!isCoarsePointer || t - lastFFTDraw >= 1 / 15) {
      drawFFT(t);
      lastFFTDraw = t;
    }

    multiplayer?.update(dt);
    composer.render();
  }
  resize();
  animate();

  /* retoma áudio em qualquer primeira interação, caso suspenso */
  const resumeAudio = () => {
    const ctx = ORORO_AUDIO.getContext();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  window.addEventListener('pointerdown', resumeAudio, { once: true, signal:lifecycle.signal });
  window.addEventListener('keydown', resumeAudio, { once: true, signal:lifecycle.signal });

  const handle = {
    scene, camera, renderer, composer, relic, ui, content, roomId:config.id,
    /* gancho de depuração: posiciona a câmera e força yaw/pitch */
    setView(pos, newYaw, newPitch) {
      if (pos) camera.position.set(...pos);
      if (newYaw !== undefined) yaw = newYaw;
      if (newPitch !== undefined) pitch = newPitch;
    },
    async navigate(nextHref,opts){return navigateRoomDocument(nextHref,opts);},
    destroy({preserveMultiplayer=false}={}){
      if(destroyed)return;destroyed=true;
      cancelAnimationFrame(rafId);lifecycle.abort();drawMinimap.dispose?.();
      try{if(panelOpen)closePanel(true);}catch{}
      ORORO_AUDIO.stop(0);
      if(!preserveMultiplayer)multiplayer?.stop?.();
      document.querySelectorAll('.touch-stick-zone,.touch-stick').forEach(n=>n.remove());
      ui.root.remove();
      try{scene.traverse(o=>{if(o.geometry?.dispose)o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.filter(Boolean).forEach(m=>m.dispose?.());});}catch{}
      try{composer.dispose?.();renderer.dispose();}catch{}
      if(canvas.isConnected){const fresh=canvas.cloneNode(false);canvas.replaceWith(fresh);}
      if(window.__ORORO__===handle)window.__ORORO__=null;
    },
  };
  ACTIVE_ROOM_HANDLE=handle;
  window.__ORORO__=handle;
  try{
    multiplayer=await connectRoom({scene, camera, room:config.id, profile:userProfile, getLaserTarget, onCapture(active) {
      ORORO_AUDIO.setCaptureMute('multiplayer-capture', active);
    }, onModal(open) {
      if (open && panelOpen) closePanel();
      Object.keys(keys).forEach(k => keys[k] = false);
      stickVec.x = stickVec.y = 0; stickTarget.x = stickTarget.y = 0;
      dragging = false;
      controlsEnabled = !open;
      if (open) { ORORO_AUDIO.modalOpen(); ORORO_AUDIO.duck(roomAudioIntensity * .45, .4); }
      else { ORORO_AUDIO.modalClose(); ORORO_AUDIO.unduck(roomAudioIntensity, .7); }
    }});
    handle.multiplayer=multiplayer;
  }catch(err){console.error(err);if(config.internalTransition)throw err;}
  if(!ROOM_POPSTATE_BOUND){
    ROOM_POPSTATE_BOUND=true;
    window.addEventListener('popstate',()=>{
      const match=location.pathname.match(/\/(sala-[a-z0-9-]+)\.html$/i);
      if(match&&ACTIVE_ROOM_HANDLE?.roomId!==match[1])navigateRoomDocument(location.href,{push:false});
    });
  }
  return handle;
}

/* =========================================================================
   14. PORTAL — cena ambiente para a tela inicial (index.html)
   ========================================================================= */
export function initPortalScene(config = {}) {
  applyA11yPrefs();
  const canvas = document.getElementById('scene-canvas');
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(config.fog || '#03040a');
  scene.fog = new THREE.FogExp2(fogColor, config.fogDensity ?? 0.07);
  scene.background = fogColor;

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 2.2, 11);
  camera.lookAt(0, 0.6, -6);

  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isCoarsePointer, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, isCoarsePointer ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  scene.add(new THREE.AmbientLight('#1a2230', 0.8));
  const hemi = new THREE.HemisphereLight('#4B1F68', '#04050a', 0.6);
  scene.add(hemi);

  const floorMat = createFloorMaterial({
    colorDeep: '#04060a', colorA: '#0E8C86', colorB: '#4B1F68', glow: '#B7F03B',
    liquid: 0.7, veins: 0.05, grid: 0.25, gridScale: 0.4, fogColor: config.fog || '#03040a', fogDensity: 0.07,
  });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(16, 48), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const boundary = buildBoundary(13, { glow: '#0E8C86', height: 6 });
  scene.add(boundary);

  const fireflies = buildFireflies({ color: '#B7F03B', count: 140, radius: 12 });
  scene.add(fireflies.points);

  const relic = buildRelic({ type: 'egg', glow: '#0E8C86', accent: '#243B8F', position: [3.4, -0.4, -9], scale: 0.7 });
  scene.add(relic.group);

  const relicSpot = buildGallerySpot(new THREE.Color('#E7E3D8').lerp(new THREE.Color('#0E8C86'), 0.16), {
    height: 5.4, intensity: 14, distance: 12, angle: Math.PI / 7, penumbra: 0.55, poolOpacity: 0.34,
  });
  relicSpot.position.copy(relic.group.position);
  relicSpot.children[1].position.set(0, 1.3, 0);
  scene.add(relicSpot);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.5, 0.9));
  const grade = new ShaderPass(GradePass);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  function resize() {
    const w = window.innerWidth; const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  /* movimento de câmera lento e suave, só o fundo se move */
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.elapsedTime;
    floorMat.uniforms.uTime.value = t;
    floorMat.uniforms.uCameraPos.value.copy(camera.position);
    fireflies.mat.uniforms.uTime.value = t;
    relic.update(t, camera);
    relic.group.traverse((o) => {
      if (o.material?.uniforms?.uCameraPos) o.material.uniforms.uCameraPos.value.copy(camera.position);
    });
    camera.position.x = Math.sin(t * 0.035) * 2.0;
    camera.position.z = 11 + Math.sin(t * 0.021) * 1.2;
    camera.position.y = 2.2 + Math.sin(t * 0.05) * 0.2;
    camera.lookAt(0, 0.9, -8);
    composer.render();
  }
  resize();
  animate();
  return { scene, camera, renderer };
}
/* =========================================================================
   re-exporta utilitários usados diretamente pelas páginas de sala
   ========================================================================= */
export { THREE, ORORO_AUDIO };
