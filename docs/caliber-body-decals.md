# Caliber-based flesh bullet decals

The small-arms table now carries the requested visual caliber groups:

| Impact caliber | Weapons |
| --- | --- |
| LIGHT | Pistol, machine gun (SMG), dual SMGs |
| MEDIUM | Assault rifle, shotgun, coach gun |
| HEAVY | Revolver |

These are impact-art categories. They do not change damage, armor thresholds,
shot counts, magazine sizes, firing cadence, accuracy or projectile speed.
Shotgun and coach-gun pellets each leave their own medium wound.

Actual unarmored humanoid body and leg hits receive a compact deterministic
wound pattern: an irregular red tissue edge, a dark puncture and directional
torn blood. Light wounds remain compact, medium wounds open farther and heavy
revolver wounds have the largest, deepest-looking opening. The painter retains
the existing wound center and size field, so clothing, limb attachment and
fatal-wound spray continue to share the same anchor. Low-stance remapping still
decides which body part was actually hit before choosing the decal.

Headshot decals and effects keep their established behavior. Armor and machine
scars, alien and animal decals, laser burns, arrows, electric attacks, floor
pools, comic impact bursts and airborne blood use their existing systems.
Standard NM0 armor receives flesh styling after its existing armor threshold
is crossed. The armored orb remains outside the humanoid decal system.

New wounds store a caliber string and a numeric cosmetic seed alongside the
old attachment data; leg wounds also retain their numeric angle within the
limb frame. Their geometry is fixed; painting consumes no gameplay randomness
and does not animate or mutate a wound. The shape cache is bounded at 96
patterns. Living torso marks are clipped to the actual body surface, and leg marks
respect the existing limb-width clamp. Untagged legacy wounds keep their
existing ellipse appearance. The Canvas painter draws cached polygon paths
directly, avoiding p5 vertex allocations while preserving the fallback's exact
pixels. Frozen corpse copies preserve the new metadata,
including body pieces and the body layer baked into floor banks.

Actor wound decals were not serialized by the existing campaign save format;
loading still rebuilds fresh actors. This update introduces no save migration
or change to that policy. Plain JSON copies of tagged wound records reproduce
the same art without retaining their original actor or a drawing surface.

Verification:

```sh
node tools/check-caliber-body-decals.js
node tools/check-caliber-decal-paths.js
node tools/check-fatal-wounds.js
node tools/check-humanoid-corpse-standard.js
node tools/check-robot.js
node tools/check-hunting-ballistics.js
node tools/check-saveload.js
VIS_DEPS=/workspace/newone-dev node tools/visual-caliber-body-decals.js
```
