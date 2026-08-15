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
  ok('rendering every weapon up front is quick enough to hide in startup', initMs < 400, initMs + ' ms');
  ok('distance lowers the level a shot plays at', (() => {
    const lvl = (x) => { nodes = []; probe(`sfx.activeVoices = 0; sfx.shoot(WEAPONS.ASSAULT_RIFLE, ${x}, 0)`);
      const g = nodes.find(n => n.kind === 'gain'); return g.gain.events[0].v; };
    return lvl(0) > lvl(600) && lvl(600) > lvl(2500);
  })(), 'spatial() attenuation, unchanged')
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
