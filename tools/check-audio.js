// Gunfire is synthesised, so there is nothing to listen to in CI and nothing
// to diff either. What can be checked is the shape of the graph each shot
// builds, and the shape is where the old shots went wrong: they were a pitched
// square-wave sweep with a resonant bandpass sweeping down behind it, every
// layer starting on the same sample, replaying the same few noise samples
// every time. That is an arcade cabinet, not a weapon, and every one of those
// properties is visible in the node graph.
//
// So this stands a recording AudioContext up in place of the harness stub,
// fires each weapon through the real sfx path, and asserts on what got built.
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
  n.startedAt = null; n.stoppedAt = null; n.offset = null;
  n.start = (t, o) => { n.startedAt = t; n.offset = o; };
  n.stop = (t) => { n.stoppedAt = t; };
  return n;
}
ctx.AudioContext = function () {
  return {
    state: 'running', resume() {}, sampleRate: 44100, currentTime: 0, destination: DEST,
    createOscillator() { const n = scheduled(mk('osc')); n.type = ''; n.frequency = param(); n.detune = param(); return n; },
    createGain() { const n = mk('gain'); n.gain = param(); return n; },
    createBufferSource() { const n = scheduled(mk('src')); n.buffer = null; n.playbackRate = param(); return n; },
    createBiquadFilter() { const n = mk('biquad'); n.type = ''; n.frequency = param(); n.Q = param(); n.gain = param(); return n; },
    createStereoPanner() { const n = mk('pan'); n.pan = param(); return n; },
    createWaveShaper() { const n = mk('shaper'); n.curve = null; n.oversample = 'none'; return n; },
    createDynamicsCompressor() { const n = mk('comp'); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = param(); return n; },
    createBuffer(nc, len, sr) {
      // Real duration, short channel array: the layers pick a random start
      // offset inside a buffer, but nobody here is listening to the samples.
      return { numberOfChannels: nc, length: len, sampleRate: sr, duration: len / sr,
               getChannelData: () => new Float32Array(Math.min(len, 4096)) };
    }
  };
};

probe('sfx.init()');
probe('viewLeft = -1e6; viewRight = 1e6; viewTop = -1e6; viewBottom = 1e6; player = { x: 0, y: 0 };');

const first = (p) => (p && p.events.length ? p.events[0].v : null);
const dive = (n, kind, seen) => {           // first node of `kind` downstream
  seen = seen || new Set();
  for (const o of n.outs || []) {
    if (seen.has(o)) continue;
    seen.add(o);
    if (o.kind === kind) return o;
    const hit = dive(o, kind, seen);
    if (hit) return hit;
  }
  return null;
};
const attackOf = (g) => {
  const e = g && g.gain.events;
  if (!e || e.length < 2) return null;
  return e[1].k === 'lin' ? +(e[1].t - e[0].t).toFixed(6) : 0;
};
// One entry per voice the shot built, described the way the ear would hear it.
function fire(weaponExpr, x, y) {
  nodes = [];
  probe(`sfx.activeVoices = 0; sfx.shoot(${weaponExpr}, ${x}, ${y});`);
  return nodes.filter(n => n.kind === 'src' || n.kind === 'osc').map(s => {
    // A noise layer is shaped by the filter it feeds; an oscillator carries
    // its own frequency and goes straight to the voice, so read each where it
    // actually lives rather than off whatever happens to be downstream.
    const isOsc = s.kind === 'osc';
    const f = (isOsc ? null : s.outs[0]) || {};
    const g = dive(s, 'gain');
    return {
      src: s.kind, wave: s.type, at: s.startedAt, offset: s.offset,
      filt: f.type, freq: isOsc ? first(s.frequency) : first(f.frequency), q: first(f.Q),
      sat: !!dive(s, 'shaper'), attack: attackOf(g), peak: g ? (g.gain.events[1] || g.gain.events[0]).v : null
    };
  });
}

const GUNS = ['WEAPONS.PISTOL', 'WEAPONS.SMG', 'WEAPONS.DUAL_SMG', 'WEAPONS.ASSAULT_RIFLE',
              'WEAPONS.SHOTGUN', 'WEAPONS.REVOLVER', 'WEAPONS.COACH_GUN', 'WEAPONS.ROCKET_LAUNCHER'];

console.log('== nothing in a gunshot is pitched ==');
{
  // The whole complaint. A square or sawtooth sweep through the mids is a note
  // with harmonics stacked on it, and the ear names notes -- that is the blip.
  // The only oscillator a ballistic shot is allowed is the sub-bass pressure
  // wave, which has to be a sine and has to sit under the range where pitch
  // reads as melody.
  let pitched = null, tooHigh = null;
  for (const w of GUNS) {
    for (const l of fire(w, 0, 0)) {
      if (l.src !== 'osc') continue;
      if (l.wave !== 'sine') pitched = `${w} has a ${l.wave} oscillator`;
      if (l.freq >= 200) tooHigh = `${w} oscillator starts at ${Math.round(l.freq)} Hz`;
    }
  }
  ok('no ballistic weapon uses a square or sawtooth voice', pitched === null, pitched || 'sine only, every gun');
  ok('and its one oscillator stays under 200 Hz, where pitch is felt not named',
     tooHigh === null, tooHigh || 'every punch layer is sub-bass');
  // Energy weapons are supposed to sound synthetic, so they keep the sawtooth.
  const laser = fire('"RED_LASER"', 0, 0);
  ok('lasers keep their sawtooth -- they are meant to sound electronic',
     laser.some(l => l.wave === 'sawtooth'), laser.length + ' layers');
  ok('and the arc cannon is a discharge, not a cartridge',
     fire('"LIGHTNING"', 0, 0).some(l => l.wave === 'sawtooth'), 'routed to the energy profile');
}

console.log('== a shot is several events, not one blip ==');
{
  const rifle = fire('WEAPONS.ASSAULT_RIFLE', 0, 0);
  const starts = rifle.map(l => l.at);
  const spread = Math.max(...starts) - Math.min(...starts);
  ok('a close shot builds its full stack of layers', rifle.length === 5, rifle.length + ' voices');
  ok('they do not all start on the same sample', new Set(starts).size > 1,
     `${new Set(starts).size} distinct start times, ${Math.round(spread * 1000)} ms apart`);
  ok('the action cycles behind the blast rather than inside it', spread >= 0.01,
     `latest layer lands at +${Math.round(spread * 1000)} ms`);
  const blast = rifle.find(l => l.sat);
  ok('the muzzle blast is driven into the soft clipper', !!blast, blast ? `lowpass from ${Math.round(blast.freq)} Hz` : 'no saturated layer');
  ok('the blast opens in well under a millisecond', blast && blast.attack !== null && blast.attack <= 0.0005,
     blast ? (blast.attack * 1000).toFixed(2) + ' ms' : 'n/a');
  const mech = rifle.find(l => l.q && l.q >= 5);
  ok('the action layer is resonant, so it rings like metal', !!mech,
     mech ? `Q ${mech.q} at ${Math.round(mech.freq)} Hz` : 'no high-Q layer');
  ok('every voice ramps in rather than jumping to peak', rifle.every(l => l.attack !== null && l.attack > 0),
     rifle.map(l => (l.attack * 1000).toFixed(2)).join(' / ') + ' ms');
}

console.log('== two shots in a row are two different sounds ==');
{
  // Every shot used to replay the same opening samples of the same buffer, and
  // an identical click at a fire rate is what turns a weapon into a machine.
  const a = fire('WEAPONS.SMG', 0, 0).filter(l => l.src === 'src').map(l => l.offset);
  const b = fire('WEAPONS.SMG', 0, 0).filter(l => l.src === 'src').map(l => l.offset);
  ok('noise layers enter the buffer at an offset', a.every(o => typeof o === 'number' && o > 0), a.map(o => o.toFixed(3)).join(' / '));
  ok('and a second shot draws different noise than the first',
     a.every((o, i) => o !== b[i]), 'no repeated sample window');
}

console.log('== distance takes a shot apart from the top down ==');
{
  const near = fire('WEAPONS.ASSAULT_RIFLE', 0, 0);
  const mid = fire('WEAPONS.ASSAULT_RIFLE', 900, 0);
  const far = fire('WEAPONS.ASSAULT_RIFLE', 3000, 0);
  ok('close by you get the crack and the action', near.length === 5, near.length + ' voices');
  ok('further out both are gone, blast and tail remain', mid.length === 3,
     mid.length + ' voices at 900 units');
  ok('far off it is a thump and nothing else', far.length === 2,
     far.length + ' voices at 3000 units');
  ok('and it gets quieter as well as simpler', far[0].peak < mid[0].peak && mid[0].peak < near[0].peak,
     [near[0].peak, mid[0].peak, far[0].peak].map(v => v.toFixed(3)).join(' > '));
}

console.log('== the guns are told apart by ear ==');
{
  const crackOf = (w) => { const l = fire(w, 0, 0).find(x => x.filt === 'highpass'); return l ? l.peak : 0; };
  const punchOf = (w) => { const l = fire(w, 0, 0).find(x => x.src === 'osc'); return l ? l.freq : 0; };
  // A smoothbore firing shot puts nothing supersonic downrange, so it has no
  // N-wave at all -- which is most of why a shotgun is not just a loud pistol.
  ok('the shotgun has no supersonic crack', crackOf('WEAPONS.SHOTGUN') === 0, 'no N-wave layer');
  ok('the coach gun agrees with it', crackOf('WEAPONS.COACH_GUN') === 0, 'no N-wave layer');
  ok('the rifle cracks hardest of the small arms',
     crackOf('WEAPONS.ASSAULT_RIFLE') > crackOf('WEAPONS.REVOLVER') &&
     crackOf('WEAPONS.REVOLVER') > crackOf('WEAPONS.SMG'), 'rifle > revolver > SMG');
  ok('the big bores thump lower than the small ones',
     punchOf('WEAPONS.ROCKET_LAUNCHER') < punchOf('WEAPONS.SHOTGUN') &&
     punchOf('WEAPONS.SHOTGUN') < punchOf('WEAPONS.SMG'),
     ['ROCKET', 'SHOTGUN', 'SMG'].map((n, i) => n + ' ' + Math.round([punchOf('WEAPONS.ROCKET_LAUNCHER'), punchOf('WEAPONS.SHOTGUN'), punchOf('WEAPONS.SMG')][i]) + 'Hz').join(' < '));
  const rates = GUNS.map(w => Math.round(fire(w, 0, 0).find(l => l.sat).freq));
  ok('and every one of them opens its blast at its own brightness',
     new Set(rates).size >= 5, rates.join(' / ') + ' Hz');
}

console.log('== the bus and the budget ==');
{
  ok('master runs through a limiter into the destination',
     probe('!!(sfx.limiter && sfx.master)'), 'compressor present');
  // Reservations are handed back on a timer, so firing a burst without ever
  // yielding is the worst case the budget will ever see: nothing is released
  // while the burst runs. What has to hold is not a hard cap -- every shot has
  // to be audible, so the essential layers are always allowed through -- but
  // that the inessential ones stop being built once the budget is spent.
  nodes = [];
  probe('sfx.activeVoices = 0');
  const burst = [];
  for (let i = 0; i < 12; i++) {
    nodes = [];
    probe('sfx.shoot(WEAPONS.SMG, 0, 0)');
    burst.push(nodes.filter(n => n.kind === 'src' || n.kind === 'osc').length);
  }
  ok('a burst sheds the action and the tail once the budget is spent',
     burst[0] === 5 && burst[burst.length - 1] === 3, burst.join(' '));
  ok('but every shot in it still gets crack, blast and punch',
     burst.every(c => c >= 3), Math.min(...burst) + ' layers at worst');
  ok('so the burst costs far less than it would unbudgeted',
     burst.reduce((a, b) => a + b, 0) < 12 * 5,
     burst.reduce((a, b) => a + b, 0) + ' voices instead of ' + 12 * 5);
  probe('sfx.activeVoices = 0');
  ok('the noise textures are long enough to keep offsets meaningful',
     probe('sfx.noiseBuffers.pink.duration >= 1 && sfx.noiseBuffers.white.duration >= 1'),
     probe('sfx.noiseBuffers.pink.duration') + ' s');
  ok('every cue that is not gunfire still finds a buffer',
     probe(`['snap','body','tail','impact','rumble'].every(k => !!sfx.noiseBuffers[k])`),
     'legacy keys intact');
  ok('and every one of those cues still plays without throwing',
     probe(`(function () {
       try {
         sfx.activeVoices = 0;
         sfx.hitBody(0,0); sfx.hitHead(0,0); sfx.hitArmor(0,0); sfx.deathGrunt(0,0,'ROBOT');
         sfx.slash(0,0); sfx.dash(0,0); sfx.reload(0,0); sfx.explosion(0,0);
         sfx.charge(0,0); sfx.throwG(0,0); sfx.bite(0,0); sfx.play(440,'sine',0.1,0.2);
         sfx.noise(0.1,0.2,800,'lowpass');
         return true;
       } catch (e) { return String(e); }
     })()`) === true, 'all cues');
}

console.log(`\n${checks - fails}/${checks} checks passed`);
process.exit(fails ? 1 : 0);
