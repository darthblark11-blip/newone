# Crouch and prone combat stances

Combat stances share the existing HEAD / BODY / LEGS aiming system. They apply
to the player and humanoid allies/enemies across the campaign, including the HQ.
They are separate from knockouts, dead bodies, boxing poses and ambient scientists.

## Hitboxes and trajectories

| Incoming elevation | Standing | Crouched | Prone |
| --- | --- | --- | --- |
| HEAD | Head critical | Passes overhead | Passes overhead |
| BODY | Body damage | Head critical | Passes overhead |
| LEGS | Existing body damage / leg decal | Body damage | Head critical |

`Bullet.tH` remains the original elevation throughout flight. `stanceHitProfile`
resolves anatomy per target; it does not rewrite the projectile. An overhead
miss consumes no ammunition beyond the original shot and causes no shield hit,
impact effect, wound, hit statistic or kill credit. It can hit another actor or
ordinary solid farther along its trajectory.

Prone contact uses a directional capsule with 25-unit half-length and 10-unit
radius, independently of the HEAD damage profile. Swept projectile contacts and
the broad phase cover the longer shape. Hunting cover uses the same resolver,
so a lowered humanoid cannot invisibly intercept an overhead shot to an animal.

Critical damage uses the existing weapon's `headDmg`, including bow power and
existing armor/shield rules. Energy weapons without a distinct head profile use
a 2× fallback for stance-promoted criticals. Wounds, armor feedback, sounds,
fall causes and headshot credit follow the resolved anatomy. Rockets retain
projectile contact height; explosions, fire and melee keep their own damage
rules and do not become harmless merely because a target is prone.

## Transitions, poses and controls

The actor's stance stores a continuous level: standing 0, crouched 1, prone 2.
Standing/crouch transitions take 150 ms; transitions involving prone take 300 ms.
Smoothstep interpolation drives the pose. Incoming hits use standing coverage
below 0.5, crouched coverage from 0.5 to below 1.5, and prone coverage thereafter.
A direct dive therefore passes through crouched vulnerability before reaching
prone. Requesting a stance never grants immediate immunity. Another transition
must wait for completion and a 180 ms recovery window. Pausing freezes progress.

Crouch compresses the native root-local forward profile by 30% and widens the
shoulders by 8%. Prone blends into an elongated directional figure with rearward
boots and forward braced arms. Native guns, reloads, bow and chemist actions use
the shared stance transform. Physical shots, muzzle flashes and light emitters
share the posed muzzle. Contact shadows tighten or flatten, and lowered health
bars/nameplates follow `actorStanceUIAnchor`. Brief merged damage/CRIT numbers
for hits against lowered actors use the same moving anchor and pause with combat.

The prone footprint also extends world collision probes. A dive requires space,
and turning cannot sweep the body through nearby walls. A blocked drop returns
to crouch; losing angular clearance keeps the last safe facing. Dash requires a
standing actor: its first press from a lower stance requests a rise.

Controls:

- Touch: the button beside/above the left movement stick cycles standing →
  crouch → prone → standing. It remains separate from the right aiming silhouette.
- Keyboard: **C** toggles crouch; **Z** toggles prone. Shovel mode retains its C dig key.
- Controller: **D-pad down** cycles stances. **L3** retains dash; **R3** retains aim/bow release.

Menus consume held input until release. Mounted actors, underground shovel use,
boxing and saloon activities retain their dedicated controls. Elevator prompts,
descent and arrival doors suspend stance input and transitions. Saves record the
current effective player stance; loading restores a settled valid pose. Older
saves start standing, and an obstructed saved prone footprint falls back to crouch.

## Balance and enemy response

| Settled stance | Movement speed | Stationary weapon spread | Recoil recovery rate |
| --- | --- | --- | --- |
| Standing | 100% | 100% | 100% |
| Crouched | 60% | 80% | 125% |
| Prone | 25% | 65% | 150% |

Movement retains only 35% of the stability bonus. Fire cooldowns, magazine sizes
and weapon definitions do not change. Weapons with zero inherent spread do not
gain an artificial accuracy bonus.

Humanoid shooters observe a changed target stance for 500 ms of visible time
before adjusting elevation. An amber LOW AIM warning announces the correction
to LEGS against prone targets. Lost sight restarts the observation period.
Some sustained ranged engagements also use crouch or occasional distant prone
positions; actors rise when combat ends or the target closes in.

Focused verification lives in `tools/check-stance-{hits,controls,ai,render}.js`.
`tools/check-stance-scene.js` replays native touch input and complete frames at
phone and landscape sizes. `tools/visual-combat-stances.js` renders native pose
comparisons and a full HQ combat scene with adapting enemy fire.
