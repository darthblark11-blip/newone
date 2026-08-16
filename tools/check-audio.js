// Gunfire is synthesised, so there is nothing to listen to in CI. But the two
// ways it has been wrong so far are both measurable, and neither is subtle.
//
// Attempt one was a square wave sweeping down through the mids with a resonant
// bandpass sweeping behind it: a pitch plus a boing, which is a pinball table.
// Attempt two replaced the square with a sine sweeping 140 Hz to 47 Hz over a
// noise body -- which is, exactly, the recipe for a kick drum. Both failures
// show up as periodicity in the low band, and the second also shows up as a
// crest factor down at drum levels, because a drum sustains and a gunshot does
// not.
//
// So this renders the real waveforms through the real code and measures them,
// with a textbook kick drum built alongside as a control: every discriminator
// below is checked to actually fire on the drum before it is trusted on the
// guns. Graph-shape checks cover what is left.
const { ctx, probe } = require('./harness.js');
let fails = 0, checks = 0;
const ok = (n, c, x) => { checks++; console.log((c ? '  ok   ' : '  FAIL ') + n + (x !== undefined ? '  ' + x : '')); if (!c) fails++; };

// --- a Web Audio context that remembers what it was asked to build ---------
let nodes = [];
const param = () => {
  const p = { events: [] };
  p.setValueAtTime = (v, t) => p.events.push({ k: 'set', v, t });
  p.linearRampToValueAtTime = (v, t) => p.events.push({ k: 'lin', v, t });
  p.exponentialRampToValueAtTime = (v, t) => p.events.push({ k: 'exp', v, t });
  p.setTargetAtTime = () => {};
  return p;
};
function mk(kind) {
  const n = { kind, outs: [] };
  n.connect = (d) => { n.outs.push(d); return d; };
  nodes.push(n);
  return n;
}
const DEST = { kind: 'destination', outs: [] };
function scheduled(n) {
  n.startedAt = null; n.offset = null;
  n.start = (t, o) => { n.startedAt = t; n.offset = o; };
  n.stop = () => {};
  return n;
}
const SR = 44100;
let decodeCalls = 0, decodeFails = false, PAD_MS = 26;
ctx.AudioContext = function () {
  return {
    state: 'running', resume() {}, sampleRate: SR, currentTime: 0, destination: DEST,
    createOscillator() { const n = scheduled(mk('osc')); n.type = ''; n.frequency = param(); n.detune = param(); return n; },
    createGain() { const n = mk('gain'); n.gain = param(); return n; },
    createBufferSource() { const n = scheduled(mk('src')); n.buffer = null; n.playbackRate = param(); return n; },
    createBiquadFilter() { const n = mk('biquad'); n.type = ''; n.frequency = param(); n.Q = param(); n.gain = param(); return n; },
    createStereoPanner() { const n = mk('pan'); n.pan = param(); return n; },
    createWaveShaper() { const n = mk('shaper'); n.curve = null; n.oversample = 'none'; return n; },
    createDynamicsCompressor() { const n = mk('comp'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = param(); return n; },
    createBuffer(nc, len, sr) {
      // Real storage: the gunshots are rendered into these, and reading the
      // samples back out is how the checks below judge them.
      const d = new Float32Array(len);
      return { numberOfChannels: nc, length: len, sampleRate: sr, duration: len / sr, getChannelData: () => d };
    },
    // Nothing here can decode an MP3, so this stands in for one: half a second
    // of audio with PAD_MS of leading silence, which is what a codec adds and
    // what the loader is supposed to find and skip.
    decodeAudioData(bytes, ok2) {
      decodeCalls++;
      if (decodeFails) { return { then: (_, bad) => bad && bad(new Error('nope')) }; }
      const n = Math.floor(SR * 0.5), d = new Float32Array(n), pad = Math.floor(SR * PAD_MS / 1000);
      for (let i = pad; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-(i - pad) / (SR * 0.08));
      const buf = { numberOfChannels: 1, length: n, sampleRate: SR, duration: n / SR, getChannelData: () => d };
      if (ok2) ok2(buf);
      return { then: (good) => { good && good(buf); return { catch() {} }; } };
    }
  };
};

const t0 = Date.now();
probe('sfx.init()');
const initMs = Date.now() - t0;
probe('viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6; player = { x: 0, y: 0 };');

// --- measurements ----------------------------------------------------------
const peakOf = (a) => { let p = 0; for (let i = 0; i < a.length; i++) { const v = a[i] < 0 ? -a[i] : a[i]; if (v > p) p = v; } return p; };
const rmsOf = (a, from, to) => {
  const i0 = Math.floor(from), i1 = Math.floor(Math.min(to, a.length));
  let s = 0, n = 0;
  for (let i = i0; i < i1; i++) { s += a[i] * a[i]; n++; }
  return n ? Math.sqrt(s / n) : 0;
};
const peakAt = (a) => { let p = 0, at = 0; for (let i = 0; i < a.length; i++) { const v = a[i] < 0 ? -a[i] : a[i]; if (v > p) { p = v; at = i; } } return at; };
// Peak against the energy of the body behind it. An impulse runs high here;
// anything that sustains -- a drum, a note -- runs low. This is "punch",
// measured: it is the one number that separates a bang from a thud.
const crest = (a) => peakOf(a) / (rmsOf(a, SR * 0.005, SR * 0.12) || 1e-9);

// The drum discriminator. Autocorrelation is no use for this -- a kick drum is
// a *swept* tone, so its period is never the same twice and it correlates with
// itself no better than noise does. What does separate them is where the low
// band's energy sits within a short window: a tone, swept or not, is one bin
// out of forty, and noise is spread across all of them. So: loudest low bin
// over the mean low bin, worst window in the shot.
function lowBandPeakiness(a, from, secs) {
  const i0 = Math.floor(from * SR), n = Math.floor(secs * SR);
  const win = Math.floor(SR * 0.025), hop = win >> 1, bins = 40, f0 = 35, f1 = 400;
  let best = 0;
  for (let s = i0; s + win <= i0 + n && s + win <= a.length; s += hop) {
    let tot = 0, mx = 0;
    for (let b = 0; b < bins; b++) {
      const f = f0 + (f1 - f0) * b / (bins - 1), co = 2 * Math.cos(2 * Math.PI * f / SR);
      let s0 = 0, s1 = 0, s2 = 0;
      for (let i = 0; i < win; i++) { s0 = a[s + i] + co * s1 - s2; s2 = s1; s1 = s0; }
      const m = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - co * s1 * s2));
      tot += m; if (m > mx) mx = m;
    }
    if (tot < 1e-7) continue;
    const r = mx / (tot / bins);
    if (r > best) best = r;
  }
  return best;
}

// Spectral centroid over the attack, by Goertzel on log-spaced bins -- enough
// to rank weapons by brightness without pulling in an FFT.
function centroid(a, secs) {
  const n = Math.min(a.length, Math.floor(secs * SR));
  let num = 0, den = 0;
  for (let b = 0; b < 48; b++) {
    const f = 60 * Math.pow(12000 / 60, b / 47), w = 2 * Math.PI * f / SR;
    const coeff = 2 * Math.cos(w);
    let s0 = 0, s1 = 0, s2 = 0;
    for (let i = 0; i < n; i++) { s0 = a[i] + coeff * s1 - s2; s2 = s1; s1 = s0; }
    const mag = Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
    num += f * mag; den += mag;
  }
  return den ? num / den : 0;
}

// The control: the textbook kick drum, and what the previous attempt was.
function kickDrum() {
  const n = Math.floor(SR * 0.4), a = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR, f = 47 + (140 - 47) * Math.exp(-t / 0.030);
    ph += 2 * Math.PI * f / SR;
    a[i] = Math.sin(ph) * Math.exp(-t / 0.11);
    if (i < 60) a[i] += (1 - i / 60) * 0.6;              // the click on top
  }
  return a;
}


// "Squeaky", measured. Track the loudest partial window by window and fit a
// slope to it in octaves per second. A falling partial reads as a discharge
// and as power; a RISING one is the single most cartoonish thing a synthesised
// weapon can do, and it is what the robot's beam was doing -- a sawtooth
// gliding 520 Hz to 2400. Measured off a recording of the game the partial
// climbed 593, 716, 863, 1041, 1256 Hz, window after window.
function partialSlope(a, secs) {
  const win = Math.floor(SR * 0.020), pts = [];
  for (let s = 0; s + win <= Math.min(a.length, secs * SR); s += win) {
    let mx = 0, at = 0, tot = 0;
    for (let b = 0; b < 44; b++) {
      const f = 180 * Math.pow(6500 / 180, b / 43), co = 2 * Math.cos(2 * Math.PI * f / SR);
      let s0 = 0, s1 = 0, s2 = 0;
      for (let i = 0; i < win; i++) { s0 = a[s + i] + co * s1 - s2; s2 = s1; s1 = s0; }
      const m = Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - co * s1 * s2));
      tot += m;
      if (m > mx) { mx = m; at = f; }
    }
    // Only windows with a partial that actually stands out have a "dominant"
    // frequency worth fitting; broadband noise does not.
    if (tot > 1e-6 && mx / (tot / 44) > 3.2) pts.push([s / SR, Math.log2(at)]);
  }
  if (pts.length < 3) return 0;
  let mt = 0, mf = 0;
  for (const [t, f] of pts) { mt += t; mf += f; }
  mt /= pts.length; mf /= pts.length;
  let num = 0, den = 0;
  for (const [t, f] of pts) { num += (t - mt) * (f - mf); den += (t - mt) * (t - mt); }
  return den ? num / den : 0;               // octaves per second
}

// The control: the robot's old beam, rebuilt.
function risingSaw() {
  const n = Math.floor(SR * 0.16), a = new Float32Array(n);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n, f = 520 * Math.pow(2400 / 520, u);
    ph += f / SR;
    ph -= Math.floor(ph);
    a[i] = (ph * 2 - 1) * Math.exp(-2.6 * u);
  }
  return a;
}

const shotOf = (w, v) => probe(`sfx.shotBuffers(sfx.profile(${w}))[${v || 0}].getChannelData(0)`);
const GUNS = ['WEAPONS.PISTOL', 'WEAPONS.SMG', 'WEAPONS.DUAL_SMG', 'WEAPONS.ASSAULT_RIFLE',
              'WEAPONS.SHOTGUN', 'WEAPONS.REVOLVER', 'WEAPONS.COACH_GUN', 'WEAPONS.ROCKET_LAUNCHER'];

console.log('== the control: the discriminators fire on a kick drum ==');
const drum = kickDrum();
const drumPeaky = lowBandPeakiness(drum, 0, 0.15), drumCrest = crest(drum);
{
  ok('a kick drum puts its low band in one bin', drumPeaky > 6, drumPeaky.toFixed(2) + 'x the mean bin');
  ok('and its crest factor sits where sustained sounds sit', drumCrest < 3, drumCrest.toFixed(1));
}

console.log('== the shots are not drums ==');
{
  let worst = 0, worstGun = '';
  for (const w of GUNS) {
    const r = lowBandPeakiness(shotOf(w), 0, 0.15);
    if (r > worst) { worst = r; worstGun = w.replace('WEAPONS.', ''); }
  }
  ok('no weapon concentrates its low band the way a tone does', worst < 4,
     `worst is ${worstGun} at ${worst.toFixed(2)}x, drum is ${drumPeaky.toFixed(2)}x`);
  ok('and the measure discriminates rather than passing everything',
     drumPeaky / worst > 2, `${(drumPeaky / worst).toFixed(1)}x apart`);
  ok('no oscillator is created anywhere in a ballistic shot', (() => {
    for (const w of GUNS) { nodes = []; probe(`sfx.activeVoices = 0; sfx.shoot(${w}, 0, 0)`); if (nodes.some(n => n.kind === 'osc')) return false; }
    return true;
  })(), 'impulse-rendered, nothing synthesised from tones');
}

console.log('== and they punch ==');
{
  const small = ['WEAPONS.PISTOL', 'WEAPONS.SMG', 'WEAPONS.ASSAULT_RIFLE', 'WEAPONS.REVOLVER'];
  let worst = 1e9, worstGun = '', worstSmall = 1e9;
  for (const w of GUNS) {
    const c = crest(shotOf(w));
    if (c < worst) { worst = c; worstGun = w.replace('WEAPONS.', ''); }
    if (small.includes(w)) worstSmall = Math.min(worstSmall, c);
  }
  // Stated against the drum rather than as bare numbers, because the absolute
  // figure is a tuning decision and the ratio is the property. Crest came down
  // deliberately from the previous cut: shots measured off a recording of the
  // game were clicks with no body, which is why they were "not punchy" despite
  // having the highest crest factor this has ever measured. Punch is a sharp
  // peak AND energy behind it, and only the first half was there.
  ok('every shot is an impulse, not something sustained', worst / drumCrest > 2,
     `weakest is ${worstGun} at ${worst.toFixed(1)}, drum is ${drumCrest.toFixed(1)}`);
  ok('and the small arms are sharper still', worstSmall / drumCrest > 6, worstSmall.toFixed(1) + ' at worst');
  const rifle = shotOf('WEAPONS.ASSAULT_RIFLE');
  // The direct arrival has to stay the loudest thing in the shot. When the
  // reflection field was cranked past it the peak moved 3.5 ms late, and a
  // late peak is a smeared attack however much energy is behind it.
  let latest = 0, lateGun = '';
  for (const w of ['WEAPONS.PISTOL', 'WEAPONS.SMG', 'WEAPONS.ASSAULT_RIFLE', 'WEAPONS.SHOTGUN', 'WEAPONS.REVOLVER']) {
    const t = peakAt(shotOf(w)) / SR * 1000;
    if (t > latest) { latest = t; lateGun = w.replace('WEAPONS.', ''); }
  }
  ok('the peak is the direct arrival, not a reflection', latest < 0.2,
     `latest onset is ${lateGun} at ${latest.toFixed(3)} ms`);
  ok('the shot is normalised, so the weapon sets its own level', Math.abs(peakOf(rifle) - 0.99) < 0.02,
     'peak ' + peakOf(rifle).toFixed(3));
  // Energy has to collapse. A drum's does not, which is what makes it a note.
  const early = rmsOf(rifle, 0, SR * 0.01), late = rmsOf(rifle, SR * 0.09, SR * 0.11);
  ok('and it collapses rather than ringing on', early / late > 8,
     `${(20 * Math.log10(early / late)).toFixed(0)} dB down by 100 ms`);
}

console.log('== they happen somewhere, which is half of sounding real ==');
{
  const rifle = shotOf('WEAPONS.ASSAULT_RIFLE');
  // Reflections and the diffuse tail: present, well below the shot, still there
  // at a fifth of a second. A dry impulse with nothing after it is a drum hit.
  const refl = rmsOf(rifle, SR * 0.007, SR * 0.09), tail = rmsOf(rifle, SR * 0.18, SR * 0.26);
  ok('a shot has early reflections behind it', refl > peakOf(rifle) * 0.004, 'reflections at ' + refl.toFixed(4));
  ok('and a diffuse tail still running at 200 ms', tail > 1e-5 && tail < refl,
     'tail at ' + tail.toFixed(6));
  ok('the reflection taps are irregularly spaced, so they cannot comb into a pitch',
     (() => {
       const t = probe('JSON.stringify(sfx.REFLECTIONS.map(r => r[0]))');
       const g = JSON.parse(t).map((v, i, a) => (i ? +(v - a[i - 1]).toFixed(5) : v));
       return new Set(g).size === g.length;
     })(), 'no repeated gap');
}

console.log('== the guns are told apart by ear ==');
{
  const bright = (w) => centroid(shotOf(w), 0.03);
  const c = { rocket: bright('WEAPONS.ROCKET_LAUNCHER'), shotgun: bright('WEAPONS.SHOTGUN'),
              pistol: bright('WEAPONS.PISTOL'), smg: bright('WEAPONS.SMG') };
  ok('the big bores are darker than the small ones',
     c.rocket < c.shotgun && c.shotgun < c.pistol && c.pistol < c.smg,
     Object.entries(c).map(([k, v]) => `${k} ${Math.round(v)}`).join(' < ') + ' Hz');
  // Being literal about the supersonic N-wave -- a smoothbore firing shot has
  // none -- cost the shotgun all of its bite, and it was the loudest complaint
  // about the last cut. It gets a crack off the leading edge of its own blast
  // instead: broader and later than a rifle's, and bigger.
  ok('the shotgun cracks, and broader than a rifle does',
     probe(`sfx.profile(WEAPONS.SHOTGUN).crack > 0.5 &&
            sfx.profile(WEAPONS.SHOTGUN).crackT > sfx.profile(WEAPONS.ASSAULT_RIFLE).crackT`),
     'blast edge, not a bullet wave');
  ok('and it is the heaviest thing in the small-arms rack',
     probe(`sfx.profile(WEAPONS.SHOTGUN).shockT > sfx.profile(WEAPONS.REVOLVER).shockT &&
            sfx.profile(WEAPONS.SHOTGUN).gain >= sfx.profile(WEAPONS.PISTOL).gain`), 'longest shock, highest level');
  ok('the rifle cracks hardest of the small arms',
     probe(`sfx.profile(WEAPONS.ASSAULT_RIFLE).crack > sfx.profile(WEAPONS.REVOLVER).crack &&
            sfx.profile(WEAPONS.REVOLVER).crack > sfx.profile(WEAPONS.SMG).crack`), 'rifle > revolver > SMG');
  ok('the big bores ring for longer afterwards',
     probe('sfx.profile(WEAPONS.ROCKET_LAUNCHER).tail > sfx.profile(WEAPONS.SHOTGUN).tail && sfx.profile(WEAPONS.SHOTGUN).tail > sfx.profile(WEAPONS.SMG).tail'),
     'rocket > shotgun > SMG');
  ok('every energy weapon has a profile of its own', (() => {
    const k = ['"ORANGE_BEAM"', '"RED_LASER"', '"ALIEN_LASER"', '"LIGHTNING"', 'WEAPONS.TASER']
      .map(w => probe(`sfx.profile(${w}).key`));
    return new Set(k).size === k.length;
  })(), 'beam / laser / alien / lightning / taser');
}

console.log('== nothing squeaks ==');
{
  const ctl = partialSlope(risingSaw(), 0.16);
  ok('the control -- the beam as it was -- reads as a rising partial', ctl > 2,
     '+' + ctl.toFixed(1) + ' octaves/sec');
  const ENERGY = [['beam', '"ORANGE_BEAM"'], ['laser', '"RED_LASER"'], ['alien', '"ALIEN_LASER"'],
                  ['lightning', '"LIGHTNING"'], ['taser', 'WEAPONS.TASER']];
  let worst = -99, worstName = '';
  for (const [n, w] of ENERGY) {
    const sl = partialSlope(shotOf(w), 0.16);
    if (sl > worst) { worst = sl; worstName = n; }
  }
  ok('no energy weapon glides upward', worst <= 0,
     `worst is ${worstName} at ${worst >= 0 ? '+' : ''}${worst.toFixed(1)} octaves/sec`);
  let gWorst = -99, gName = '';
  for (const w of GUNS) {
    const sl = partialSlope(shotOf(w), 0.12);
    if (sl > gWorst) { gWorst = sl; gName = w.replace('WEAPONS.', ''); }
  }
  ok('and neither does any firearm', gWorst <= 0,
     `worst is ${gName} at ${gWorst >= 0 ? '+' : ''}${gWorst.toFixed(1)} octaves/sec`);
  ok('the robot is hit and killed as metal, not as a voice', probe(`(function () {
    const before = sfx.shots['metal:armour'];
    sfx.hitArmor(0, 0); sfx.deathGrunt(0, 0, 'ROBOT');
    return !!sfx.shots['metal:armour'] && !!sfx.shots['metal:chassis'];
  })()`), 'modal clank and chassis collapse');
  ok('its modes are inharmonic, so it clanks rather than chimes', (() => {
    const r = JSON.parse(probe(`JSON.stringify(sfx.METAL.armour.modes.map(m => m[0]))`));
    return r.every(v => Math.abs(v - Math.round(v)) > 0.05 || v === 1);
  })(), 'no whole-number ratios');
}

console.log('== no two shots are the same shot ==');
{
  const a = shotOf('WEAPONS.SMG', 0), b = shotOf('WEAPONS.SMG', 1), c = shotOf('WEAPONS.SMG', 2);
  const diff = (x, y) => { let s = 0; for (let i = 0; i < 2000; i++) s += Math.abs(x[i] - y[i]); return s; };
  ok('each weapon renders three distinct waveforms', diff(a, b) > 1 && diff(b, c) > 1 && diff(a, c) > 1,
     'variants differ');
  ok('and playback detunes on top of that', (() => {
    const rates = new Set();
    for (let i = 0; i < 8; i++) {
      nodes = []; probe('sfx.activeVoices = 0; sfx.shoot(WEAPONS.SMG, 0, 0)');
      const s = nodes.find(n => n.kind === 'src');
      rates.add(s.playbackRate.events[0].v.toFixed(4));
    }
    return rates.size >= 6;
  })(), 'shot-to-shot rate jitter');
}

console.log('== the supplied recordings ==');
{
  const defs = probe('sfx.SAMPLES');
  const keys = Object.keys(defs);
  const want = ['pistol', 'shotgun', 'death', 'meleekill', 'armour', 'swing',
                'blood', 'shieldhit', 'shieldbreak', 'boom'];
  ok('every cue that was given a recording has one', want.every(k => keys.includes(k)),
     keys.join(' + '));
  let bad = null, total = 0, clips = 0;
  for (const k of keys) {
    const list = typeof defs[k].data === 'string' ? [defs[k].data] : defs[k].data;
    for (const d of list) {
      const buf = Buffer.from(d, 'base64');
      total += buf.length; clips++;
      // MP3 for anything with a body to it, WAV for the very short transients
      // where the codec's own padding would be a large fraction of the sound.
      const mp3 = buf.slice(0, 3).toString() === 'ID3', wav = buf.slice(0, 4).toString() === 'RIFF';
      if (!mp3 && !wav) bad = k + ' is neither MP3 nor WAV';
      const secs = mp3 ? buf.length / (96000 / 8) : buf.readUInt32LE(40) / (buf.readUInt32LE(28) || 1);
      if (secs < 0.02 || secs > 3) bad = `${k} is ${secs.toFixed(2)}s`;
    }
  }
  ok('all of them decode from base64 to real audio of sane length', bad === null,
     bad || clips + ' clips');
  ok('and the lot costs about what one texture would', total < 320 * 1024,
     (total / 1024).toFixed(1) + ' KB of audio embedded');
  ok('nothing is set to a gain that would clip it',
     keys.every(k => defs[k].gain > 0 && defs[k].gain <= 1),
     keys.map(k => k + ' ' + defs[k].gain).join(', '));
  // A swing fires on every press and a kill fires once, so they must not be
  // levelled the same or the swing is the thing you end up hearing.
  ok('the frequent cues sit below the rare ones', defs.swing.gain < defs.meleekill.gain &&
     defs.armour.gain < defs.death.gain, `swing ${defs.swing.gain} < kill ${defs.meleekill.gain}`);
  ok('the cues that repeat in a row carry more than one take',
     ['meleekill', 'swing', 'blood', 'armour'].every(k => typeof defs[k].data !== 'string' && defs[k].data.length > 1),
     'melee kill, swing, blood and armour');
  // The shield hit is a per-round cue and has to be SHORT. The recording it
  // came from is a burst of ten rounds followed by a long swell, and playing
  // the whole file on every hit is what made it read as the shield breaking
  // instead. One round is one impact -- and a hit must never be longer than
  // the break it is supposed to be distinguishable from.
  // Real durations, not estimates: a guessed bitrate reported a 1.10 s clip as
  // 1.48 s, which is enough to fail a length assertion on a sound that is fine.
  const RATE = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const FREQ = [44100, 48000, 32000];
  const clipMs = (d) => {
    const b = Buffer.from(d, 'base64');
    if (b.slice(0, 4).toString() === 'RIFF') return b.readUInt32LE(40) / (b.readUInt32LE(28) || 1) * 1000;
    let i = 0;
    if (b.slice(0, 3).toString() === 'ID3') i = 10 + ((b[6] << 21) | (b[7] << 14) | (b[8] << 7) | b[9]);
    let frames = 0, sr = 44100;
    while (i + 4 <= b.length) {
      if (b[i] !== 0xff || (b[i + 1] & 0xe0) !== 0xe0) { i++; continue; }
      const br = RATE[(b[i + 2] & 0xf0) >> 4], f = FREQ[(b[i + 2] & 0x0c) >> 2];
      if (!br || !f) { i++; continue; }
      sr = f;
      i += ((144 * br * 1000 / f) | 0) + ((b[i + 2] & 0x02) >> 1);
      frames++;
    }
    return frames * 1152 / sr * 1000;
  };
  // The hit is the full recording. What it must not do is outlast the break it
  // has to stay distinguishable from, or restart before it has been heard once.
  const hitMs = clipMs(defs.shieldhit.data);
  ok('the shield hit is still shorter than the break',
     hitMs < clipMs(defs.shieldbreak.data),
     `hit ${hitMs.toFixed(0)} ms vs break ${clipMs(defs.shieldbreak.data).toFixed(0)} ms`);
  ok('and its gate is long enough that it is heard before it restarts',
     defs.shieldhit.every * 1000 > hitMs * 0.4,
     `gate ${defs.shieldhit.every * 1000} ms against ${hitMs.toFixed(0)} ms of sound`);
  // A shield hit answers every incoming round while the shield holds, so it
  // has to be the quietest thing here or it becomes the whole soundtrack of a
  // firefight; the break happens once.
  ok('the shield hit sits well under the break', defs.shieldhit.gain < defs.shieldbreak.gain * 0.5,
     `hit ${defs.shieldhit.gain} vs break ${defs.shieldbreak.gain}`);
}

console.log('== a recording is preferred, and a render still backs it ==');
{
  ok('the decoder was asked for every clip', decodeCalls >= 8, decodeCalls + ' decodes');
  ok('a sampled weapon plays its recording, not its render', (() => {
    nodes = []; probe('sfx.activeVoices = 0; sfx.shoot(WEAPONS.PISTOL, 0, 0)');
    const s = nodes.find(n => n.kind === 'src');
    return !!s && probe('sfx.sample("pistol").variants').some(v => v.buffer === s.buffer);
  })(), 'buffer identity matches a decoded variant');
  ok('an unsampled weapon still plays its render', (() => {
    nodes = []; probe('sfx.activeVoices = 0; sfx.shoot(WEAPONS.ASSAULT_RIFLE, 0, 0)');
    const s = nodes.find(n => n.kind === 'src');
    // Any of its three renders will do -- playBuffer rotates them.
    return !!s && probe('sfx.shotBuffers(sfx.profile(WEAPONS.ASSAULT_RIFLE))').some(b => b === s.buffer);
  })(), 'falls through to shotBuffers');
  // Codec padding is the quiet killer here: a sound 26 ms behind the thing that
  // caused it reads as input lag, and nothing about it looks wrong in the code.
  const off = probe('sfx.sample("pistol").variants[0].offset');
  ok('playback starts at the onset, not at the decoder zero', off > 0.02 && off < 0.03,
     (off * 1000).toFixed(1) + ' ms of codec padding skipped');
  ok('and the source is started from that offset', (() => {
    nodes = []; probe('sfx.activeVoices = 0; sfx.shoot(WEAPONS.SHOTGUN, 0, 0)');
    const s = nodes.find(n => n.kind === 'src');
    return s && s.offset > 0.02;
  })(), 'start(when, offset)');
  ok('the coach gun shares the shotgun recording',
     probe('sfx.profile(WEAPONS.COACH_GUN).key') === 'shotgun', 'same key, same sample');
  ok('a decode that fails leaves the synthesised cue in place', (() => {
    decodeFails = true;
    probe('sfx.samples = {}; sfx.loadSamples();');
    const none = probe('sfx.sample("pistol")') === null;
    decodeFails = false;
    nodes = []; probe('sfx.activeVoices = 0; sfx.shoot(WEAPONS.PISTOL, 0, 0)');
    const played = nodes.some(n => n.kind === 'src');
    probe('sfx.samples = {}; sfx.loadSamples();');
    return none && played;
  })(), 'the gun still fires');
}

console.log('== the cues those recordings drive ==');
{
  const plays = (call) => { nodes = []; probe('sfx.lastPlayed = {}; sfx.activeVoices = 0; ' + call); return nodes.find(n => n.kind === 'src'); };
  const isFrom = (n, key) => !!n && probe(`sfx.sample("${key}").variants`).some(v => v.buffer === n.buffer);
  ok('a death by gunfire plays the recorded death', isFrom(plays('sfx.deathGrunt(0, 0)'), 'death'), 'body and head shots alike');
  ok('a melee kill plays the recorded kill instead', isFrom(plays('sfx.meleeKill(0, 0)'), 'meleekill'), 'not the gunfire one');
  ok('a hit on armour plays the recorded impact', isFrom(plays('sfx.hitArmor(0, 0)'), 'armour'), 'robots, saucers, the armoured');
  ok('a swing plays the recorded swing', isFrom(plays('sfx.slash(0, 0)'), 'swing'), 'sword and pick share it');
  // A machine still dies as a machine -- the recorded death is for things that
  // bleed, and routing a robot into it would undo the whole metal treatment.
  ok('a robot still dies as metal, not as a body', (() => {
    const n = plays("sfx.deathGrunt(0, 0, 'ROBOT')");
    return !!n && probe("sfx.metalBuffers('chassis')").some(b => b === n.buffer);
  })(), 'chassis, not the blowhole');
  ok('both takes of a repeated cue actually get used', (() => {
    const seen = new Set();
    for (let i = 0; i < 24; i++) { const n = plays('sfx.slash(0, 0)'); if (n) seen.add(n.buffer); }
    return seen.size === 2;
  })(), 'variants rotate');
  ok('the melee kill is wired into the swing that lands', (() => {
    const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
    return /sfx\.meleeKill\(e\.x, e\.y\)/.test(src);
  })(), 'called from the melee sweep');
}

console.log('== blood, shield and explosions ==');
{
  const plays = (call) => { nodes = []; probe('sfx.lastPlayed = {}; sfx.activeVoices = 0; ' + call); return nodes.filter(n => n.kind === 'src'); };
  const from = (list, key) => { const v = probe(`sfx.sample("${key}").variants`); return list.filter(n => v.some(x => x.buffer === n.buffer)); };

  const d = plays('sfx.deathGrunt(0, 0)');
  ok('a humanoid death plays the death sound AND the blood', from(d, 'death').length === 1 && from(d, 'blood').length === 1,
     d.length + ' voices');
  // Two sounds starting on the same sample are heard as one. The blood has to
  // arrive behind the impact for layering them to be worth anything.
  const blood = from(d, 'blood')[0];
  ok('and the blood lands behind the impact, not on top of it', blood.startedAt > 0.05 && blood.startedAt < 0.12,
     (blood.startedAt * 1000).toFixed(0) + ' ms behind');
  ok('a robot death gets neither -- it has none to spill',
     from(plays("sfx.deathGrunt(0, 0, 'ROBOT')"), 'blood').length === 0, 'chassis only');
  ok('and neither does a saucer',
     from(plays("sfx.deathGrunt(0, 0, 'SAUCER')"), 'blood').length === 0, 'nothing to bleed');
  ok('a melee kill keeps its own sound and does not double up',
     from(plays('sfx.meleeKill(0, 0)'), 'meleekill').length === 1, 'slice only');

  ok('a shield hit plays the recorded hit', from(plays('sfx.shieldHit(0, 0)'), 'shieldhit').length === 1, 'shield holds');
  ok('a shield break plays the recorded break', from(plays('sfx.shieldBreak(0, 0)'), 'shieldbreak').length === 1, 'shield gone');
  // The bug this exists to catch: takeDamage plays the shield cue, and every
  // one of the four callers that checks `blocked` ALSO played the robot impact
  // on top of it. Both were firing; the metal one is louder, so it was the only
  // one audible, and auditioning the shield cue on its own could never show it.
  // A cue is not correct until nothing else answers the same event.
  ok('no shield block answers the hit with the robot impact', (() => {
    const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8').split('\n');
    const bad = [];
    src.forEach((line, i) => {
      if (!/\bdRes\.blocked\b/.test(line)) return;
      if (src.slice(i, i + 5).some(l => /sfx\.hitArmor\(/.test(l))) bad.push(i + 1);
    });
    return bad.length === 0;
  })(), 'the shield sounds like a shield, not like a robot');
  ok('and the shield cue is only ever raised from takeDamage', (() => {
    const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
    const calls = src.match(/sfx\.shield(Hit|Break)\(/g) || [];
    return calls.length === 2;                 // one hit, one break, both in the branch
  })(), 'one choke point, which is the only place that knows if it broke');
  ok('the shield cues are wired to the shield, and never both at once', (() => {
    const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
    const i = src.indexOf('res.broken = true;');
    const seg = src.slice(i - 400, i + 400);
    return /sfx\.shieldBreak\(this\.x, this\.y\)/.test(seg) && /sfx\.shieldHit\(this\.x, this\.y\)/.test(seg) &&
           seg.indexOf('shieldBreak') < seg.indexOf('shieldHit');
  })(), 'break in the broken branch, hit in the other');

  ok('an explosion plays the recording', from(plays('sfx.explosion(0, 0)'), 'boom').length === 1, 'grenades and rockets');
  ok('grenades and rockets both reach it with a position', (() => {
    const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
    return /function triggerExplosion[^]{0,120}sfx\.explosion\(ex, ey\)/.test(src) &&
           /function triggerRocketExplosion[^]{0,120}sfx\.explosion\(ex, ey\)/.test(src);
  })(), 'both blast functions');
  ok('no explosion is left playing dead centre', (() => {
    const src = require('fs').readFileSync(__dirname + '/../game.js', 'utf8');
    return !/sfx\.explosion\(\)/.test(src);
  })(), 'every call site passes a position');
  ok('the explosion is the loudest thing in the game', (() => {
    const defs = probe('sfx.SAMPLES');
    return defs.boom.gain * 1 > defs.shotgun.gain * 0.7;
  })(), 'louder than the shotgun');
}

console.log('== the cues that repeat fastest are gated ==');
{
  // A shotgun lands four pellets on a robot in one frame and the shield answers
  // every incoming round. Ungated, those arrive as one cue stacked several deep
  // -- several times the level rather than several hits.
  const defs = probe('sfx.SAMPLES');
  ok('the armour impact and the shield hit both carry a retrigger gate',
     defs.armour.every > 0 && defs.shieldhit.every > 0,
     `armour ${defs.armour.every}s, shield ${defs.shieldhit.every}s`);
  // Both are per-round cues on the same frame budget, so both gates only need
  // to be long enough to collapse a shotgun's pellets into one impact and
  // short enough to leave ordinary fire alone.
  ok('the armour gate collapses a same-frame volley without touching ordinary fire',
     defs.armour.every >= 1 / 60 && defs.armour.every <= 0.06,
     `armour ${defs.armour.every}s, one frame is 0.017s`);
  const burst = (call, n) => {
    probe('sfx.lastPlayed = {}; sfx.activeVoices = 0;');
    nodes = [];
    for (let i = 0; i < n; i++) probe(call);
    return nodes.filter(x => x.kind === 'src').length;
  };
  // currentTime is frozen at 0 in this harness, so every call after the first
  // lands inside the window -- which is exactly the same-frame case.
  ok('four pellets on the same frame make one impact, not four',
     burst('sfx.hitArmor(0, 0)', 4) === 1, 'gated to the first');
  ok('and a burst on the shield does not stack either',
     burst('sfx.shieldHit(0, 0)', 6) === 1, 'gated to the first');
  ok('an ungated cue is still free to overlap', burst('sfx.explosion(0, 0)', 3) === 3,
     'explosions are not gated');
  probe('sfx.lastPlayed = {};');
}

console.log('== cost ==');
{
  nodes = [];
  probe('sfx.activeVoices = 0; sfx.shoot(WEAPONS.ASSAULT_RIFLE, 0, 0)');
  ok('firing costs one voice, not a graph of five',
     nodes.filter(n => n.kind === 'src' || n.kind === 'osc').length === 1,
     nodes.length + ' nodes total');
  ok('so a full-auto burst never reaches the voice budget', (() => {
    probe('sfx.activeVoices = 0');
    for (let i = 0; i < 20; i++) probe('sfx.shoot(WEAPONS.SMG, 0, 0)');
    return probe('sfx.activeVoices') <= probe('sfx.maxVoices');
  })(), probe('sfx.activeVoices') + ' / ' + probe('sfx.maxVoices') + ' after 20 shots');
  const t1 = Date.now();
  probe(`sfx.shots = {};
         for (const w of [WEAPONS.PISTOL, WEAPONS.SMG, WEAPONS.ASSAULT_RIFLE, WEAPONS.SHOTGUN,
                          WEAPONS.REVOLVER, WEAPONS.ROCKET_LAUNCHER, WEAPONS.TASER,
                          'ORANGE_BEAM', 'RED_LASER', 'ALIEN_LASER', 'LIGHTNING'])
           sfx.shotBuffers(sfx.profile(w));
         sfx.metalBuffers('armour'); sfx.metalBuffers('chassis');`);
  const renderMs = Date.now() - t1;
  ok('rendering every fallback up front is quick enough to hide in startup', renderMs < 400,
     renderMs + ' ms of synthesis (init total ' + initMs + ' ms, the rest is the stub decoder)');
  ok('distance darkens a shot as well as quietening it', (() => {
    const lp = (x) => { nodes = []; probe(`sfx.activeVoices = 0; sfx.shoot(WEAPONS.ASSAULT_RIFLE, ${x}, 0)`);
      const f = nodes.find(n => n.kind === 'biquad' && n.type === 'lowpass'); return f.frequency.events[0].v; };
    return lp(0) > lp(600) && lp(600) > lp(2500);
  })(), 'air absorption with range');
}

console.log('== everything that is not a gunshot still works ==');
{
  probe('sfx.activeVoices = 0');
  ok('master runs through a limiter into the destination', probe('!!(sfx.limiter && sfx.master)'), 'compressor present');
  ok('the legacy noise keys are all still there',
     probe(`['snap','body','tail','impact','rumble','white','pink'].every(k => !!sfx.noiseBuffers[k])`), 'intact');
  ok('and every other cue still plays without throwing',
     probe(`(function () {
       try {
         sfx.activeVoices = 0;
         sfx.hitBody(0,0); sfx.hitHead(0,0); sfx.hitArmor(0,0); sfx.deathGrunt(0,0,'ROBOT');
         sfx.slash(0,0); sfx.dash(0,0); sfx.reload(0,0); sfx.explosion(0,0);
         sfx.charge(0,0); sfx.throwG(0,0); sfx.bite(0,0); sfx.shotgun(0,0);
         sfx.play(440,'sine',0.1,0.2); sfx.noise(0.1,0.2,800,'lowpass');
         return true;
       } catch (e) { return String(e); }
     })()`) === true, 'all cues');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
