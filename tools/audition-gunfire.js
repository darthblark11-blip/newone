// Renders the game's gunfire to .wav so it can actually be listened to.
//
// The audio is generated at runtime, so there is no asset to open and check,
// and this file exists because that turned out to matter: two rewrites of the
// gunshots shipped on reasoning alone, and both were wrong in a way that was
// obvious within a second of hearing them. It runs the real sfx code through
// the harness, so what comes out is what the game plays.
//
//   node tools/audition-gunfire.js [outdir]      (default: ./audio-preview)
const fs = require('fs');
const path = require('path');
const { ctx, probe } = require('./harness.js');

const SR = 44100;
const OUT = process.argv[2] || path.join(__dirname, '..', 'audio-preview');

const param = () => ({ setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
ctx.AudioContext = function () {
  return {
    state: 'running', resume() {}, sampleRate: SR, currentTime: 0, destination: {},
    createOscillator() { return { type: '', frequency: param(), detune: param(), connect() {}, start() {}, stop() {} }; },
    createGain() { return { gain: param(), connect() {} }; },
    createBufferSource() { return { buffer: null, playbackRate: param(), connect() {}, start() {}, stop() {} }; },
    createBiquadFilter() { return { type: '', frequency: param(), Q: param(), gain: param(), connect() {} }; },
    createStereoPanner() { return { pan: param(), connect() {} }; },
    createWaveShaper() { return { curve: null, oversample: 'none', connect() {} }; },
    createDynamicsCompressor() { return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect() {} }; },
    createBuffer(nc, len, sr) { const d = new Float32Array(len); return { numberOfChannels: nc, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => d }; }
  };
};
probe('sfx.init()');

const GUNS = [
  ['pistol', 'WEAPONS.PISTOL'], ['smg', 'WEAPONS.SMG'], ['assault-rifle', 'WEAPONS.ASSAULT_RIFLE'],
  ['shotgun', 'WEAPONS.SHOTGUN'], ['revolver', 'WEAPONS.REVOLVER'], ['coach-gun', 'WEAPONS.COACH_GUN'],
  ['rocket-launcher', 'WEAPONS.ROCKET_LAUNCHER'],
  ['robot-beam', '"ORANGE_BEAM"'], ['laser', '"RED_LASER"'], ['alien-laser', '"ALIEN_LASER"'],
  ['lightning', '"LIGHTNING"'], ['taser', 'WEAPONS.TASER']
];
const shot = (w, v) => probe(`sfx.shotBuffers(sfx.profile(${w}))[${v}].getChannelData(0)`);
const gainOf = (w) => probe(`sfx.profile(${w}).gain`);
const MASTER = probe('0.9');

// Mix one shot in, at the level and detune the game would have played it with.
// Rate jitter is a resample, so it shifts length and pitch together the way
// varying playbackRate does in the browser.
function place(dst, src, at, gain, rate) {
  for (let i = 0; ; i++) {
    const s = i * rate;
    const j = s | 0;
    if (j + 1 >= src.length) break;
    const k = at + i;
    if (k >= dst.length) break;
    const f = s - j;
    dst[k] += (src[j] * (1 - f) + src[j + 1] * f) * gain;
  }
}

// One-pole lowpass, matching what distance does to a shot in sfx.spatial().
function darken(a, hz) {
  const c = 1 - Math.exp(-2 * Math.PI * Math.min(hz, SR * 0.45) / SR);
  let z = 0;
  for (let i = 0; i < a.length; i++) { z += (a[i] - z) * c; a[i] = z; }
  return a;
}

function wav(name, data) {
  let peak = 0;
  for (let i = 0; i < data.length; i++) { const v = Math.abs(data[i]); if (v > peak) peak = v; }
  // Only pull down if it would clip; never push up, or the relative loudness
  // between weapons -- which is half the point of listening to these -- is lost.
  const g = peak > 0.995 ? 0.995 / peak : 1;
  const n = data.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    let v = data[i] * g;
    v = v > 1 ? 1 : v < -1 ? -1 : v;
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  const p = path.join(OUT, name);
  fs.writeFileSync(p, buf);
  console.log(`  ${name}  ${(n / SR).toFixed(2)}s  peak ${peak.toFixed(3)}`);
}

fs.mkdirSync(OUT, { recursive: true });
console.log('rendering to ' + OUT);

// --- one file per weapon, three shots each so the variation is audible ------
for (const [name, expr] of GUNS) {
  const g = gainOf(expr) * MASTER;
  const out = new Float32Array(SR * 3);
  for (let i = 0; i < 3; i++) place(out, shot(expr, i % 3), Math.floor(SR * (0.05 + i * 0.9)), g, 0.97 + i * 0.03);
  wav(name + '.wav', out);
}

// --- every weapon in one pass, in the order listed above --------------------
{
  const out = new Float32Array(SR * (GUNS.length * 1.2 + 1));
  GUNS.forEach(([, expr], i) => place(out, shot(expr, 0), Math.floor(SR * (0.15 + i * 1.2)), gainOf(expr) * MASTER, 1));
  wav('all-weapons.wav', out);
}

// --- the robot: shot at, and killed ----------------------------------------
{
  const armour = probe("sfx.metalBuffers('armour')"), chassis = probe("sfx.metalBuffers('chassis')");
  const out = new Float32Array(SR * 4);
  for (let i = 0; i < 4; i++) place(out, armour[i % 3].getChannelData(0), Math.floor(SR * (0.1 + i * 0.42)), 0.62 * MASTER, 0.92 + i * 0.05);
  place(out, chassis[0].getChannelData(0), Math.floor(SR * 2.0), 0.72 * MASTER, 1);
  wav('robot-hit-and-death.wav', out);
}

// --- the robot shooting, at its own burst rate ------------------------------
{
  const g = gainOf('"ORANGE_BEAM"') * MASTER;
  const out = new Float32Array(SR * 3);
  for (let i = 0; i < 6; i++) {
    const at = Math.floor(SR * (0.15 + Math.floor(i / 2) * 0.9 + (i % 2) * (9 / 60)));
    place(out, shot('"ORANGE_BEAM"', i % 3), at, g, 0.97 + Math.random() * 0.06);
  }
  wav('robot-firing.wav', out);
}

// --- sustained fire, at the rate the SMG actually fires ---------------------
// 6 frames between shots at 60 fps. This is where a repeated waveform would
// give itself away as a machine rather than a gun.
{
  const g = gainOf('WEAPONS.SMG') * MASTER, step = Math.floor(SR * 6 / 60);
  const out = new Float32Array(SR * 3);
  for (let i = 0; i < 20; i++) place(out, shot('WEAPONS.SMG', i % 3), Math.floor(SR * 0.1) + i * step, g, 0.97 + Math.random() * 0.06);
  wav('smg-burst.wav', out);
}

// --- the same rifle shot walking away from the listener ---------------------
{
  const out = new Float32Array(SR * 5);
  [0, 300, 700, 1400, 2800].forEach((d, i) => {
    const one = new Float32Array(SR * 1.1);
    place(one, shot('WEAPONS.ASSAULT_RIFLE', i % 3), 0, gainOf('WEAPONS.ASSAULT_RIFLE') * MASTER, 1);
    darken(one, 18000 / (1 + d / 260));
    const lvl = 1 / (1 + d / 560 + (d * d) / 1600000);
    for (let k = 0; k < one.length; k++) { const j = Math.floor(SR * (0.1 + i)) + k; if (j < out.length) out[j] += one[k] * lvl; }
  });
  wav('rifle-by-distance.wav', out);
}

console.log('done');
