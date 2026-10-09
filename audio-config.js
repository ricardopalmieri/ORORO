/* =========================================================================
   OROЯO — perfis sonoros por sala (v2)
   -------------------------------------------------------------------------
   Cada sala tem um CLIMA próprio. Além de root/intensity, o perfil controla
   forma de onda do pad, acorde/detune, movimento de filtro, cor e volume do
   ruído de fundo, tamanho do reverb, brilho metálico e a densidade/tipo dos
   eventos esparsos. Objetivo: ambientes bem diferentes entre si.

   Campos (todos opcionais, ver normalizeProfile em ororo-audio.js):
     root, intensity, waveA, waveB, detunes[], detuneSpread,
     padCutoff, padQ, padLfoRate, padLfoDepth, subRatio, subLfoRate,
     lpRange[min,max], hpRange[min,max], filterStep,
     reverbSeconds, reverbDecay, wet,
     noiseBed(0..1), noiseColor('brown'|'pink'|'white'), noiseCutoff,
     glass(0..1), stereoWobble,
     events: { pulse:[s,s]|null, blade:[s,s]|null, arp:[s,s]|null, drip:[s,s]|null }
   ========================================================================= */

export const AUDIO_CONFIG = {
  // 01 · GÊNESE — nascimento, água morna, grave respirando
  'sala-01-genese': {
    root: 41.2, intensity: 0.58, tone: 'genesis',
    waveA: 'sine', waveB: 'triangle', detunes: [0, 7, 12, 19],
    padCutoff: 320, padQ: 1.2, padLfoRate: 0.02, padLfoDepth: 160,
    subLfoRate: 0.04, lpRange: [500, 5200], hpRange: [20, 120],
    reverbSeconds: 7.5, reverbDecay: 3.2, wet: 0.5,
    noiseBed: 0.18, noiseColor: 'brown', noiseCutoff: 500,
    stereoWobble: 0.05,
    events: { pulse: [8, 15], blade: null, arp: [18, 34], drip: [6, 12] },
  },
  // 02a · FLORESTA FERIDA — orgânico, contaminado, meio-grave
  'sala-02a-floresta-ferida': {
    root: 34.6, intensity: 0.62, tone: 'contamination',
    waveA: 'triangle', waveB: 'sawtooth', detunes: [0, 3, 10, 7],
    padCutoff: 420, padQ: 2.0, padLfoRate: 0.05, padLfoDepth: 260,
    lpRange: [400, 4200], hpRange: [30, 180],
    reverbSeconds: 6, reverbDecay: 3.4, wet: 0.44,
    noiseBed: 0.32, noiseColor: 'pink', noiseCutoff: 1200,
    stereoWobble: 0.09,
    events: { pulse: [9, 16], blade: [9, 18], arp: [16, 30], drip: [10, 20] },
  },
  // 02b · INVASORES — industrial, agressivo, serrote
  'sala-02b-invasores': {
    root: 43.65, intensity: 0.66, tone: 'aggressive',
    waveA: 'sawtooth', waveB: 'square', detunes: [0, 1, 6, 8], detuneSpread: 12,
    padCutoff: 620, padQ: 3.2, padLfoRate: 0.12, padLfoDepth: 420,
    lpRange: [700, 8200], hpRange: [40, 260], filterStep: 0.11,
    reverbSeconds: 4, reverbDecay: 4.2, wet: 0.3,
    noiseBed: 0.22, noiseColor: 'white', noiseCutoff: 2600,
    stereoWobble: 0.14,
    events: { pulse: [6, 11], blade: [3, 7], arp: null, drip: null },
  },
  // 02c · ESPELHOS D'ÁGUA — cristalino, alto, vítreo
  'sala-02c-espelhos-dagua': {
    root: 48.99, intensity: 0.52, tone: 'crystalline',
    waveA: 'sine', waveB: 'sine', detunes: [0, 12, 19, 24],
    padCutoff: 900, padQ: 0.8, padLfoRate: 0.06, padLfoDepth: 300,
    lpRange: [1400, 9200], hpRange: [80, 320],
    reverbSeconds: 8.5, reverbDecay: 2.6, wet: 0.55,
    noiseBed: 0.08, noiseColor: 'white', noiseCutoff: 3200,
    glass: 0.8, stereoWobble: 0.11,
    events: { pulse: null, blade: [8, 16], arp: [12, 22], drip: [5, 11] },
  },
  // 03a · ANIMAIS FANTASMA — etéreo, muito grave, fantasma
  'sala-03a-animais-fantasma': {
    root: 30.87, intensity: 0.48, tone: 'phantom',
    waveA: 'triangle', waveB: 'sine', detunes: [0, 5, 8, 15],
    padCutoff: 500, padQ: 1.6, padLfoRate: 0.03, padLfoDepth: 340,
    lpRange: [300, 6000], hpRange: [20, 140],
    reverbSeconds: 9, reverbDecay: 3.0, wet: 0.6,
    noiseBed: 0.16, noiseColor: 'pink', noiseCutoff: 1500,
    glass: 0.2, stereoWobble: 0.13,
    events: { pulse: [10, 20], blade: [7, 15], arp: [20, 40], drip: null },
  },
  // 03b · VILA OCUPADA — denso, opressivo, urbano
  'sala-03b-vila-ocupada': {
    root: 58.27, intensity: 0.66, tone: 'dense',
    waveA: 'sawtooth', waveB: 'triangle', detunes: [0, 3, 7, 10], detuneSpread: 9,
    padCutoff: 460, padQ: 2.4, padLfoRate: 0.045, padLfoDepth: 220,
    lpRange: [400, 4600], hpRange: [30, 160],
    reverbSeconds: 5, reverbDecay: 3.8, wet: 0.38,
    noiseBed: 0.3, noiseColor: 'brown', noiseCutoff: 800,
    stereoWobble: 0.06,
    events: { pulse: [7, 13], blade: [6, 12], arp: null, drip: [12, 24] },
  },
  // 03c · CORPO FRAGMENTADO — irregular, quebrado, pulsante
  'sala-03c-corpo-fragmentado': {
    root: 55.0, intensity: 0.6, tone: 'fragmented',
    waveA: 'square', waveB: 'sawtooth', detunes: [0, 1, 6, 11], detuneSpread: 14,
    padCutoff: 540, padQ: 3.0, padLfoRate: 0.09, padLfoDepth: 380,
    lpRange: [500, 6800], hpRange: [40, 240], filterStep: 0.1,
    reverbSeconds: 5.5, reverbDecay: 3.4, wet: 0.42,
    noiseBed: 0.2, noiseColor: 'white', noiseCutoff: 1900,
    stereoWobble: 0.16,
    events: { pulse: [4, 9], blade: [5, 11], arp: [16, 28], drip: null },
  },
  // 04a · ELEMENTOS — fluido, ar/água, movediço
  'sala-04a-elementos': {
    root: 36.71, intensity: 0.54, tone: 'elemental',
    waveA: 'sine', waveB: 'triangle', detunes: [0, 7, 10, 17],
    padCutoff: 560, padQ: 1.4, padLfoRate: 0.07, padLfoDepth: 320,
    lpRange: [500, 6400], hpRange: [30, 200],
    reverbSeconds: 7, reverbDecay: 3.0, wet: 0.5,
    noiseBed: 0.26, noiseColor: 'pink', noiseCutoff: 1400,
    glass: 0.25, stereoWobble: 0.15,
    events: { pulse: [9, 17], blade: [8, 16], arp: [16, 30], drip: [6, 13] },
  },
  // 04b · VOZES DISSIDENTES — caótico, polifônico
  'sala-04b-vozes-dissidentes': {
    root: 51.96, intensity: 0.68, tone: 'chaotic',
    waveA: 'sawtooth', waveB: 'square', detunes: [0, 2, 5, 9, 13], detuneSpread: 16,
    padCutoff: 700, padQ: 2.8, padLfoRate: 0.13, padLfoDepth: 460,
    lpRange: [600, 8600], hpRange: [50, 300], filterStep: 0.12,
    reverbSeconds: 5, reverbDecay: 3.6, wet: 0.4,
    noiseBed: 0.24, noiseColor: 'white', noiseCutoff: 2400,
    stereoWobble: 0.18,
    events: { pulse: [8, 14], blade: [4, 9], arp: [10, 20], drip: null },
  },
  // 04c · VOZES ANCESTRAIS — grave ancestral, reverberante
  'sala-04c-vozes-ancestrais': {
    root: 48.99, intensity: 0.56, tone: 'ancestral',
    waveA: 'triangle', waveB: 'sine', detunes: [0, 5, 7, 12],
    padCutoff: 400, padQ: 1.8, padLfoRate: 0.025, padLfoDepth: 240,
    lpRange: [320, 5200], hpRange: [20, 130],
    reverbSeconds: 9.5, reverbDecay: 3.2, wet: 0.62,
    noiseBed: 0.2, noiseColor: 'brown', noiseCutoff: 700,
    stereoWobble: 0.08,
    events: { pulse: [6, 12], blade: null, arp: [18, 34], drip: null },
  },
  // 05a · MÁQUINAS NO BIOMA — mecânico, motor, rítmico
  'sala-05a-maquinas-bioma': {
    root: 69.3, intensity: 0.64, tone: 'mechanical',
    waveA: 'square', waveB: 'sawtooth', detunes: [0, 12, 7], detuneSpread: 5,
    padCutoff: 480, padQ: 4.0, padLfoRate: 0.9, padLfoDepth: 300,
    lpRange: [500, 5600], hpRange: [40, 220], filterStep: 0.14,
    reverbSeconds: 3.5, reverbDecay: 4.0, wet: 0.28,
    noiseBed: 0.3, noiseColor: 'brown', noiseCutoff: 900,
    stereoWobble: 0.05,
    events: { pulse: [3, 6], blade: [5, 10], arp: null, drip: null },
  },
  // 05b · FOGO CRUZADO — feroz, ativo, perigoso
  'sala-05b-fogo-cruzado': {
    root: 77.8, intensity: 0.7, tone: 'fierce',
    waveA: 'sawtooth', waveB: 'square', detunes: [0, 1, 6, 8], detuneSpread: 18,
    padCutoff: 800, padQ: 3.6, padLfoRate: 0.18, padLfoDepth: 520,
    lpRange: [800, 9600], hpRange: [60, 340], filterStep: 0.16,
    reverbSeconds: 3, reverbDecay: 4.4, wet: 0.26,
    noiseBed: 0.34, noiseColor: 'white', noiseCutoff: 3200,
    stereoWobble: 0.2,
    events: { pulse: [4, 8], blade: [2, 6], arp: null, drip: null },
  },
  // 05c · VIAGEM CÓSMICA — sideral, etéreo, imenso
  'sala-05c-viagem-cosmica': {
    root: 46.25, intensity: 0.5, tone: 'cosmic',
    waveA: 'sine', waveB: 'triangle', detunes: [0, 12, 19, 26],
    padCutoff: 1000, padQ: 0.7, padLfoRate: 0.04, padLfoDepth: 360,
    lpRange: [900, 9800], hpRange: [70, 260],
    reverbSeconds: 10, reverbDecay: 2.4, wet: 0.66,
    noiseBed: 0.1, noiseColor: 'pink', noiseCutoff: 2600,
    glass: 0.9, stereoWobble: 0.19,
    events: { pulse: null, blade: [10, 20], arp: [14, 26], drip: null },
  },
  // 06a · RITUAL DE ÁGUA E SANGUE — profundo, pulsante, ritual
  'sala-06a-ritual-sangue': {
    root: 32.7, intensity: 0.65, tone: 'ritual',
    waveA: 'triangle', waveB: 'sine', detunes: [0, 3, 7, 10],
    padCutoff: 380, padQ: 2.0, padLfoRate: 0.03, padLfoDepth: 220,
    subLfoRate: 0.06, lpRange: [300, 4800], hpRange: [20, 150],
    reverbSeconds: 8, reverbDecay: 3.4, wet: 0.54,
    noiseBed: 0.22, noiseColor: 'brown', noiseCutoff: 600,
    stereoWobble: 0.07,
    events: { pulse: [4, 7], blade: [8, 16], arp: [16, 30], drip: [5, 10] },
  },
  // 06b · INSURREIÇÃO — revolucionário, intenso, tambor
  'sala-06b-insurreicao': {
    root: 82.4, intensity: 0.68, tone: 'rebellion',
    waveA: 'sawtooth', waveB: 'square', detunes: [0, 5, 7, 12], detuneSpread: 10,
    padCutoff: 560, padQ: 2.8, padLfoRate: 0.5, padLfoDepth: 340,
    lpRange: [500, 7200], hpRange: [40, 240], filterStep: 0.13,
    reverbSeconds: 4.5, reverbDecay: 3.8, wet: 0.34,
    noiseBed: 0.26, noiseColor: 'brown', noiseCutoff: 1000,
    stereoWobble: 0.1,
    events: { pulse: [2, 5], blade: [6, 12], arp: null, drip: null },
  },
  // 06c · RITUAL DE FUSÃO — primordial, cataclismo, muito grave
  'sala-06c-ritual-fusao': {
    root: 27.5, intensity: 0.72, tone: 'cataclysm',
    waveA: 'sawtooth', waveB: 'triangle', detunes: [0, 7, 12, 19, 3], detuneSpread: 12,
    padCutoff: 420, padQ: 2.6, padLfoRate: 0.05, padLfoDepth: 440,
    subLfoRate: 0.035, lpRange: [260, 7600], hpRange: [18, 200], filterStep: 0.09,
    reverbSeconds: 9, reverbDecay: 3.6, wet: 0.58,
    noiseBed: 0.3, noiseColor: 'brown', noiseCutoff: 800,
    glass: 0.3, stereoWobble: 0.15,
    events: { pulse: [5, 9], blade: [6, 12], arp: [14, 26], drip: [8, 16] },
  },
  // 07 · LIMIAR — síntese total, epifania
  'sala-07-final': {
    root: 41.2, intensity: 0.64, tone: 'synthesis',
    waveA: 'sine', waveB: 'sawtooth', detunes: [0, 7, 12, 19, 24],
    padCutoff: 700, padQ: 1.2, padLfoRate: 0.04, padLfoDepth: 380,
    lpRange: [600, 9000], hpRange: [30, 220],
    reverbSeconds: 9, reverbDecay: 2.8, wet: 0.6,
    noiseBed: 0.18, noiseColor: 'pink', noiseCutoff: 1800,
    glass: 0.5, stereoWobble: 0.14,
    events: { pulse: [6, 12], blade: [8, 16], arp: [12, 24], drip: [7, 14] },
  },
};

export function getAudioConfig(roomId) {
  return AUDIO_CONFIG[roomId] || { root: 41.2, intensity: 0.55, tone: 'default' };
}
