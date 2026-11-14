# Cel explosions

Explosion feedback is one coherent pooled effect rather than forty separate
soft fire puffs and a gray smoke cloud. A flattened ground shock anchors a
raised, lobed fire mass. Dark ink contours, saturated orange/yellow surfaces,
hot inner caps and fast outward strokes give it the same cel shading as the
figures. The cap rises while the lower skirt spreads; late embers and vapor
finish the effect without repeatedly spawning replacement particles.

The shared `emit(..., 'EXPLOSION', ...)` entry point redirects existing aerial,
lightning, corpse and finisher bursts to the new art. Grenades, rockets,
barrels, car chains and robot charges use their normal blast trigger with its
actual radius. The jetpack's blue explosion retains its blue palette.

Damage, allegiance, blast radii, grenade fire zones, audio, screen shake and
scorch marks retain their previous behavior.

Human grenade, rocket and jetpack dash-blast deaths now cycle through three additional deaths:
both legs destroyed beneath a thrown torso, one leg torn off while the rest of
the body flies away, and a diagonal split into two flying body sections. These
join the existing dismemberment deaths in a separate rotation, independent of
headshot, shotgun and lightning selections. The standard NM0 armor uses the
human rig; the armored orb, creatures, robots and airborne jetpack enemies keep
their own death tables. The player uses the human blast rotation too.

The new parts rise above their floor shadows, spin, shed blood and gibs, then
land and freeze into the existing body layer. Their clothing and surviving
limbs use the native fallen-figure materials. Explosion puddles have only a
six-tick hold and finish growing by tick 54; ordinary-death puddles retain their
slower six-second spread. The fast timing also follows detached parts and
below-ground blood deposits.

Each effect occupies one `CEL_EXPLOSION` particle and lasts 48 active simulation
ticks. Eight starts per frame and twenty-four simultaneous effects bound the
work. Painting uses a private cosmetic seed, never gameplay randomness, and
does not advance animation. Pause freezes the effect through the existing
particle update gate. Owner-bound explosions retain shovel-depth projection;
culling accounts for the full blast rather than only its ground origin.

The existing particle pool handles retirement and recycling. Run and travel
replacement clear the particle array, which also discards active explosions.
The separate comic bullet contacts and blood spray keep their existing paths.

Verification:

```sh
node tools/check-cel-explosions.js
node tools/check-explosion-deaths.js
node tools/check-blast-blood-pools.js
node tools/check-robot.js
node tools/check-player-kill-combo.js
VIS_DEPS=/workspace/newone-dev node tools/check-particle-performance.js
VIS_DEPS=/workspace/newone-dev node tools/visual-cel-explosions.js
VIS_DEPS=/workspace/newone-dev node tools/visual-explosion-deaths.js
```

The older particle-parity check continues to compare every unchanged particle
kind against its optimization baseline. Intentional explosion-art changes are
covered separately by the cel suite and native visual review.
The visual tool renders real grenade, rocket, blue dash and legacy burst routes
at native and enlarged scales, plus a phone scene and motion clip. Its default
output directory is `/tmp/newone-cel-explosions`.
