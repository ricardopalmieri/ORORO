/* =========================================================================
   OROЯO — motor de áudio generativo (v2: climas por sala + ruído de modal)
   -------------------------------------------------------------------------
   Sound design 100% sintetizado via Web Audio API, sem arquivos externos.

   Agora cada sala recebe um PERFIL sonoro rico (não só root/intensity), de
   modo que os ambientes fiquem bem diferentes entre si: forma de onda do
   pad, acorde/detune, movimento de filtro, cor do ruído de fundo, tamanho
   do reverb, densidade e tipo de eventos, brilho metálico, etc.

   Novidades:
     - start(profile): consome o perfil da sala (ver audio-config.js).
     - openNoise()/closeNoise(): LEITO de ruído CONTÍNUO, modulado e
       extremo, que toca enquanto um modal estiver aberto (fade in/out).
     - getAnalyser(): nó AnalyserNode para o monitor de FFT do HUD.

   API pública: start, stop, setEnabled, isEnabled, isRunning, duck, unduck,
   getContext, getAnalyser, openNoise, closeNoise, modalOpen, modalClose.
   ========================================================================= */

const STORAGE_KEY = 'ororo_audio_on';

let ctx = null;
let master = null;
let bus = null;
let analyser = null;
let running = false;
let timers = [];
let nodes = [];

const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10, 12];

let lowpass = null;
let highpass = null;
let filterTimer = null;
let curProfile = null;
let bladeNoiseBuffer = null;
let masterTarget = 0.55;
const captureMuteReasons = new Set();
let modalNoiseRequested = false;

const MOBILE_AUDIO = (() => {
  try {
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  } catch (e) { return false; }
})();

function createAudioContext() {
  const AC = window.AudioContext || window.webkitAudioContext;
  try { return new AC({ latencyHint: MOBILE_AUDIO ? 'playback' : 'interactive' }); }
  catch (e) { return new AC(); }
}

/* ruído tipo Perlin 1D (value-noise suave), 0..1 sem saltos */
function makeNoise1D() {
  const size = 256;
  const points = new Float32Array(size);
  for (let i = 0; i < size; i++) points[i] = Math.random();
  return function (x) {
    const xi = Math.floor(x);
    const xf = x - xi;
    const a = points[xi & (size - 1)];
    const b = points[(xi + 1) & (size - 1)];
    const t = xf * xf * xf * (xf * (xf * 6 - 15) + 10);
    return a + (b - a) * t;
  };
}

export function isEnabled() { return localStorage.getItem(STORAGE_KEY) === '1'; }
export function setEnabled(value) { localStorage.setItem(STORAGE_KEY, value ? '1' : '0'); }
export function isRunning() { return running; }
export function getContext() { return ctx; }
export function getAnalyser() { return analyser; }

function isCaptureMuted() { return captureMuteReasons.size > 0; }
function applyMasterTarget(seconds = 0.18) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  const target = isCaptureMuted() ? 0.0001 : Math.max(masterTarget, 0.0001);
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), now);
  master.gain.setTargetAtTime(target, now, Math.max(0.015, seconds * 0.45));
}

/* Silencia todo o desenho sonoro enquanto alguma captura de microfone está
   ativa. Usa motivos independentes para que mic ao vivo e gravador possam
   compartilhar a mesma captura sem se desmutarem um ao outro. */
export function setCaptureMute(reason = 'capture', active = true) {
  const wasMuted = isCaptureMuted();
  if (active) captureMuteReasons.add(reason);
  else captureMuteReasons.delete(reason);
  const muted = isCaptureMuted();
  if (muted) closeNoise(0.06);
  applyMasterTarget(muted ? 0.06 : 0.22);
  if (wasMuted && !muted && modalNoiseRequested) openNoise();
}

function rand(min, max) { return min + Math.random() * (max - min); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* impulso de reverb sintético (cauda exponencial + ruído) */
function buildImpulse(context, seconds = 5.5, decay = 3.2, channels = 2) {
  const rate = context.sampleRate;
  const length = Math.max(1, Math.floor(rate * seconds));
  const impulse = context.createBuffer(channels, length, rate);
  for (let ch = 0; ch < channels; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      const tt = i / length;
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - tt, decay);
    }
  }
  return impulse;
}

/* buffer de ruído colorido (white / pink / brown), em loop */
function makeColoredNoise(context, seconds, color) {
  const len = Math.max(1, Math.floor(context.sampleRate * seconds));
  const buf = context.createBuffer(1, len, context.sampleRate);
  const d = buf.getChannelData(0);
  if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
  } else if (color === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.25;
    }
  } else {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

/* curva de distorção suave para o leito de ruído "extremo" */
function makeDistortionCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  const k = amount * 100;
  for (let i = 0; i < n; i++) {
    const x = (i / n) * 2 - 1;
    curve[i] = ((3 + k) * x * 20 * Math.PI / 180) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

/* perfil padrão, caso a sala não informe (retrocompatível com {root,intensity}) */
function normalizeProfile(p) {
  p = p || {};
  return {
    root: p.root ?? 41.2,
    intensity: p.intensity ?? 0.55,
    waveA: p.waveA || 'sawtooth',
    waveB: p.waveB || 'triangle',
    detunes: p.detunes || [0, 7, 12, 19, -5],
    detuneSpread: p.detuneSpread ?? 6,
    padCutoff: p.padCutoff ?? 380,
    padQ: p.padQ ?? 1.4,
    padLfoRate: p.padLfoRate ?? 0.028,
    padLfoDepth: p.padLfoDepth ?? 220,
    subRatio: p.subRatio ?? 2,
    subLfoRate: p.subLfoRate ?? 0.045,
    lpRange: p.lpRange || [600, 7600],
    hpRange: p.hpRange || [20, 240],
    filterStep: p.filterStep ?? 0.06,
    reverbSeconds: p.reverbSeconds ?? 6.5,
    reverbDecay: p.reverbDecay ?? 3.4,
    wet: p.wet ?? 0.42,
    noiseBed: p.noiseBed ?? 0.0,
    noiseColor: p.noiseColor || 'pink',
    noiseCutoff: p.noiseCutoff ?? 900,
    glass: p.glass ?? 0.0,
    stereoWobble: p.stereoWobble ?? 0.07,
    events: p.events || { pulse: [7, 14], blade: [5, 11], arp: [14, 26] },
  };
}

/* -------------------------------------------------------------------------
   start(): monta o grafo generativo a partir do perfil da sala
   ------------------------------------------------------------------------- */
export async function start(opts = {}) {
  const P = normalizeProfile(opts);

  /* Mobile roda WebGL + pós + WebRTC ao mesmo tempo. Mantemos o desenho
     sonoro, mas evitamos os pontos mais caros do grafo para impedir
     underruns/crackle do AudioContext em aparelhos móveis. */
  if (MOBILE_AUDIO) {
    P.detunes = P.detunes.slice(0, 3);
    P.wet *= 0.62;
    P.noiseBed *= 0.9;
    P.glass *= 0.85;
  }

  curProfile = P;
  const root = P.root;
  const intensity = P.intensity;
  masterTarget = intensity;

  if (running && ctx) {
    if (ctx.state === 'suspended') await ctx.resume();
    applyMasterTarget(1.5);
    return;
  }

  ctx = createAudioContext();
  running = true;

  master = ctx.createGain();
  master.gain.value = 0.0001;

  /* filtro de saída lp+hp modulado por ruído tipo Perlin (movimento lento) */
  lowpass = ctx.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = (P.lpRange[0] + P.lpRange[1]) / 2;
  lowpass.Q.value = 0.35;

  highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = P.hpRange[0];
  highpass.Q.value = 0.5;

  /* analisador para o monitor de FFT (após os filtros = o que se ouve) */
  analyser = ctx.createAnalyser();
  analyser.fftSize = MOBILE_AUDIO ? 128 : 256;
  analyser.smoothingTimeConstant = 0.72;

  /* compressor final funciona como proteção de headroom. Não é usado para
     aumentar loudness, apenas segura somas ocasionais de sub + pad + evento. */
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = MOBILE_AUDIO ? -16 : -12;
  limiter.knee.value = 12;
  limiter.ratio.value = MOBILE_AUDIO ? 6 : 4;
  limiter.attack.value = 0.008;
  limiter.release.value = 0.18;

  master.connect(lowpass);
  lowpass.connect(highpass);
  highpass.connect(limiter);
  limiter.connect(analyser);
  analyser.connect(ctx.destination);

  const lpNoise = makeNoise1D();
  const hpNoise = makeNoise1D();
  let noisePhase = 0;
  const stepFilters = () => {
    if (!ctx || !running || !lowpass || !highpass) return;
    noisePhase += P.filterStep;
    const lpVal = lpNoise(noisePhase);
    const hpVal = hpNoise(noisePhase + 41.7);
    const lpFreq = P.lpRange[0] + lpVal * (P.lpRange[1] - P.lpRange[0]);
    const hpFreq = P.hpRange[0] + hpVal * (P.hpRange[1] - P.hpRange[0]);
    lowpass.frequency.setTargetAtTime(lpFreq, ctx.currentTime, 2.4);
    highpass.frequency.setTargetAtTime(hpFreq, ctx.currentTime, 2.4);
    filterTimer = setTimeout(stepFilters, 700);
  };
  stepFilters();

  bus = ctx.createGain();
  bus.gain.value = 1;

  const dry = ctx.createGain();
  dry.gain.value = 0.78;
  const wet = ctx.createGain();
  wet.gain.value = P.wet;

  bus.connect(dry);
  dry.connect(master);

  if (MOBILE_AUDIO) {
    /* Reverb leve para mobile: delay com feedback filtrado. Um Convolver de
       5-8 s concorrendo com WebGL/WebRTC é uma fonte comum de underrun. */
    const delay = ctx.createDelay(0.7);
    const feedback = ctx.createGain();
    const verbFilter = ctx.createBiquadFilter();
    delay.delayTime.value = 0.19;
    feedback.gain.value = 0.27;
    verbFilter.type = 'lowpass';
    verbFilter.frequency.value = 2400;
    bus.connect(delay);
    delay.connect(verbFilter);
    verbFilter.connect(wet);
    verbFilter.connect(feedback);
    feedback.connect(delay);
    wet.connect(master);
  } else {
    const conv = ctx.createConvolver();
    conv.buffer = buildImpulse(ctx, P.reverbSeconds, P.reverbDecay, 2);
    bus.connect(conv);
    conv.connect(wet);
    wet.connect(master);
  }

  /* Buffer da lâmina é preparado uma única vez. Antes ele era gerado com
     milhares de Math.random() durante a performance, causando picos de CPU. */
  bladeNoiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.4), ctx.sampleRate);
  {
    const data = bladeNoiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  /* ---- 1. sub-bass respirando ------------------------------------- */
  const sub = ctx.createOscillator();
  sub.type = 'sine';
  sub.frequency.value = root;
  const subGain = ctx.createGain();
  subGain.gain.value = 0.5;
  const subShelf = ctx.createBiquadFilter();
  subShelf.type = 'lowpass';
  subShelf.frequency.value = 140;
  sub.connect(subGain);
  subGain.connect(subShelf);
  subShelf.connect(master);
  sub.start();

  const subLFO = ctx.createOscillator();
  subLFO.frequency.value = P.subLfoRate;
  const subLFOGain = ctx.createGain();
  subLFOGain.gain.value = 0.22;
  subLFO.connect(subLFOGain);
  subLFOGain.connect(subGain.gain);
  subLFO.start();

  const sub2 = ctx.createOscillator();
  sub2.type = 'sine';
  sub2.frequency.value = root * (P.subRatio + 0.005);
  const sub2Gain = ctx.createGain();
  sub2Gain.gain.value = 0.12;
  sub2.connect(sub2Gain);
  sub2Gain.connect(subShelf);
  sub2.start();

  /* ---- 2. drone / pad --------------------------------------------- */
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = P.padCutoff;
  padFilter.Q.value = P.padQ;

  const padGain = ctx.createGain();
  padGain.gain.value = 0.17;

  P.detunes.forEach((semi, i) => {
    const osc = ctx.createOscillator();
    osc.type = i % 2 === 0 ? P.waveA : P.waveB;
    osc.frequency.value = root * 2 * Math.pow(2, semi / 12);
    osc.detune.value = rand(-P.detuneSpread, P.detuneSpread);
    const g = ctx.createGain();
    g.gain.value = 0.42 / (i + 1);
    osc.connect(g);
    g.connect(padFilter);
    osc.start();
    nodes.push(osc);
  });

  padFilter.connect(padGain);
  padGain.connect(bus);

  const filterLFO = ctx.createOscillator();
  filterLFO.type = 'sine';
  filterLFO.frequency.value = P.padLfoRate;
  const filterLFOGain = ctx.createGain();
  filterLFOGain.gain.value = P.padLfoDepth;
  filterLFO.connect(filterLFOGain);
  filterLFOGain.connect(padFilter.frequency);
  filterLFO.start();

  /* tremor estéreo no pad */
  const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (panner) {
    padGain.disconnect();
    padGain.connect(panner);
    panner.connect(bus);
    const panLFO = ctx.createOscillator();
    panLFO.frequency.value = P.stereoWobble;
    const panLFOGain = ctx.createGain();
    panLFOGain.gain.value = 0.6;
    panLFO.connect(panLFOGain);
    panLFOGain.connect(panner.pan);
    panLFO.start();
    nodes.push(panLFO);
  }

  nodes.push(sub, sub2, subLFO, filterLFO);

  /* ---- 2b. leito de ruído colorido contínuo (cor/clima da sala) ---- */
  if (P.noiseBed > 0.001) {
    const nb = ctx.createBufferSource();
    nb.buffer = makeColoredNoise(ctx, 3, P.noiseColor);
    nb.loop = true;
    const nbFilt = ctx.createBiquadFilter();
    nbFilt.type = 'lowpass';
    nbFilt.frequency.value = P.noiseCutoff;
    nbFilt.Q.value = 0.6;
    const nbGain = ctx.createGain();
    nbGain.gain.value = P.noiseBed * 0.5;
    nb.connect(nbFilt); nbFilt.connect(nbGain); nbGain.connect(bus);
    /* leve movimento no corte do ruído de fundo */
    const nbLFO = ctx.createOscillator();
    nbLFO.frequency.value = 0.04 + Math.random() * 0.05;
    const nbLFOg = ctx.createGain();
    nbLFOg.gain.value = P.noiseCutoff * 0.4;
    nbLFO.connect(nbLFOg); nbLFOg.connect(nbFilt.frequency); nbLFO.start();
    nb.start();
    nodes.push(nb, nbLFO);
  }

  /* ---- 2c. brilho metálico / vidro (salas cristalinas/cósmicas) ---- */
  if (P.glass > 0.001) {
    const gOsc = ctx.createOscillator();
    gOsc.type = 'sine';
    gOsc.frequency.value = root * 8;
    const gLFO = ctx.createOscillator();
    gLFO.frequency.value = 0.15;
    const gLFOg = ctx.createGain();
    gLFOg.gain.value = root * 2;
    gLFO.connect(gLFOg); gLFOg.connect(gOsc.frequency);
    const gGain = ctx.createGain();
    gGain.gain.value = P.glass * 0.03;
    gOsc.connect(gGain); gGain.connect(bus);
    gOsc.start(); gLFO.start();
    nodes.push(gOsc, gLFO);
  }

  /* ---- fade-in geral ---------------------------------------------- */
  master.gain.setValueAtTime(0.0001, ctx.currentTime);
  if (!isCaptureMuted()) master.gain.exponentialRampToValueAtTime(Math.max(intensity, 0.02), ctx.currentTime + 3.5);

  scheduleEvents(root, P);
}

/* -------------------------------------------------------------------------
   eventos esparsos, agora configuráveis por sala (P.events)
   ------------------------------------------------------------------------- */
function scheduleEvents(root, P) {
  const ev = P.events || {};
  const queueNext = (fn, range) => {
    if (!range) return;
    const id = setTimeout(() => {
      if (!running) return;
      fn();
      queueNext(fn, range);
    }, rand(range[0], range[1]) * 1000);
    timers.push(id);
  };

  /* pulso grave tipo batida de coração */
  queueNext(() => {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = root * 0.5;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(g); g.connect(master);
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.4, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4);
    o.start(t); o.stop(t + 2.6);
  }, ev.pulse);

  /* "lâmina" metálica: ruído bandpass, brilho frio, pan aleatório */
  queueNext(() => {
    if (!ctx) return;
    const noise = ctx.createBufferSource();
    noise.buffer = bladeNoiseBuffer || makeColoredNoise(ctx, 1.4, 'white');
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = rand(1800, 5200);
    bp.Q.value = rand(2, 6);
    const g = ctx.createGain();
    g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    noise.connect(bp); bp.connect(g);
    if (pan) { g.connect(pan); pan.connect(bus); pan.pan.value = rand(-0.8, 0.8); }
    else { g.connect(bus); }
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(rand(0.05, 0.12), t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.6, 1.3));
    noise.start(t); noise.stop(t + 1.5);
  }, ev.blade);

  /* arpejo ritual curto, escala frígia */
  queueNext(() => {
    if (!ctx) return;
    const baseMidiOffset = pick([-12, -5, 0]);
    const steps = pick([3, 4, 5]);
    let time = ctx.currentTime + 0.05;
    for (let i = 0; i < steps; i++) {
      const semi = pick(PHRYGIAN) + baseMidiOffset;
      const freq = root * 2 * Math.pow(2, semi / 12);
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      const sub = ctx.createOscillator();
      sub.type = 'square';
      sub.frequency.value = freq / 2;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = rand(900, 1600);
      filt.Q.value = 4;
      const g = ctx.createGain();
      g.gain.value = 0;
      osc.connect(filt); sub.connect(filt); filt.connect(g); g.connect(bus);
      const dur = rand(0.5, 1.1);
      g.gain.setValueAtTime(0, time);
      g.gain.linearRampToValueAtTime(0.09, time + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      osc.start(time); sub.start(time);
      osc.stop(time + dur + 0.05); sub.stop(time + dur + 0.05);
      time += dur * rand(0.7, 1.05);
    }
  }, ev.arp);

  /* gota/pingo (salas de água/óleo): clique curto filtrado */
  queueNext(() => {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(rand(700, 1400), t);
    o.frequency.exponentialRampToValueAtTime(rand(120, 300), t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + 0.4);
  }, ev.drip);
}

/* -------------------------------------------------------------------------
   controles públicos
   ------------------------------------------------------------------------- */
export function stop(fadeSeconds = 1.4) {
  closeNoise(fadeSeconds <= 0 ? 0.01 : 0.5);
  if (!running || !ctx) return;
  const teardown = () => {
    timers.forEach(clearTimeout);
    timers = [];
    if (filterTimer) clearTimeout(filterTimer);
    filterTimer = null;
    nodes.forEach((n) => { try { n.stop(); } catch (e) {} });
    nodes = [];
    const oldCtx=ctx;
    ctx = null; master = null; bus = null; analyser = null;
    lowpass = null; highpass = null; bladeNoiseBuffer = null; running = false;
    if (oldCtx) { try { oldCtx.close(); } catch (e) {} }
  };
  if (fadeSeconds <= 0) { teardown(); return; }
  const t = ctx.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.exponentialRampToValueAtTime(0.0001, t + fadeSeconds);
  setTimeout(teardown, fadeSeconds * 1000 + 100);
}

export function duck(targetGain = 0.08, seconds = 0.6) {
  masterTarget = targetGain;
  applyMasterTarget(seconds);
}

export function unduck(targetGain = 0.55, seconds = 0.8) {
  masterTarget = targetGain;
  applyMasterTarget(seconds);
}

/* =========================================================================
   LEITO DE RUÍDO DO MODAL — contínuo, modulado e "extremo"
   -------------------------------------------------------------------------
   Enquanto um modal está aberto, toca uma camada de ruído sustentada, com
   varreduras largas de filtro em alta ressonância (LFOs + Perlin) e leve
   distorção. Fade de entrada ao abrir, fade de saída ao fechar/responder.
   Reaproveita o contexto do ambiente; se não houver, cria um dedicado.
   ========================================================================= */
let sfxCtx = null;
let noiseBed = null; // { ctx, gain, src, sweepTimer }

function ensureSfxCtx() {
  if (ctx) return ctx;
  if (!sfxCtx) {
    try { sfxCtx = createAudioContext(); }
    catch (e) { return null; }
  }
  if (sfxCtx.state === 'suspended') { try { sfxCtx.resume(); } catch (e) {} }
  return sfxCtx;
}

export function openNoise(peak) {
  if (!isEnabled() || isCaptureMuted()) return;
  const c = ensureSfxCtx();
  if (!c) return;
  closeNoise(0.15); // garante um único leito
  const target = peak ?? 0.11;
  const out = c.destination;

  const src = c.createBufferSource();
  src.buffer = makeColoredNoise(c, 2.5, 'white');
  src.loop = true;

  /* dois filtros ressonantes em série = timbre "gritado", metálico */
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 700;
  bp.Q.value = 9;
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  lp.Q.value = 8;

  const shaper = c.createWaveShaper();
  shaper.curve = makeDistortionCurve(0.35);

  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.linearRampToValueAtTime(target, c.currentTime + 0.45); // fade-in

  src.connect(bp); bp.connect(lp); lp.connect(shaper); shaper.connect(gain);
  if (analyser && c === ctx) { gain.connect(analyser); } else { gain.connect(out); }
  src.start();

  /* modulação extrema e contínua do corte + ressonância (Perlin + LFO) */
  const nz = makeNoise1D();
  let ph = 0;
  const sweep = () => {
    if (!noiseBed) return;
    ph += 0.22;
    const a = nz(ph), b = nz(ph + 19.3);
    const bpF = 220 + a * 3600;            // varredura larga
    const lpF = 800 + b * 5200;
    const q = 6 + nz(ph + 51.1) * 16;      // ressonância alta e móvel
    const now = c.currentTime;
    bp.frequency.setTargetAtTime(bpF, now, 0.25);
    lp.frequency.setTargetAtTime(lpF, now, 0.3);
    bp.Q.setTargetAtTime(q, now, 0.4);
    noiseBed.sweepTimer = setTimeout(sweep, 180);
  };
  noiseBed = { ctx: c, gain, src, sweepTimer: null, filt: [bp, lp] };
  sweep();
}

export function closeNoise(fade = 0.4) {
  const nb = noiseBed;
  noiseBed = null;
  if (!nb) return;
  if (nb.sweepTimer) clearTimeout(nb.sweepTimer);
  const c = nb.ctx;
  try {
    const now = c.currentTime;
    nb.gain.gain.cancelScheduledValues(now);
    nb.gain.gain.setValueAtTime(nb.gain.gain.value, now);
    nb.gain.gain.exponentialRampToValueAtTime(0.0001, now + fade); // fade-out
    setTimeout(() => { try { nb.src.stop(); } catch (e) {} }, fade * 1000 + 60);
  } catch (e) {
    try { nb.src.stop(); } catch (e2) {}
  }
}

/* aliases retrocompatíveis: o core chama modalOpen/modalClose */
export function modalOpen() { modalNoiseRequested = true; openNoise(); }
export function modalClose() { modalNoiseRequested = false; closeNoise(0.4); }
