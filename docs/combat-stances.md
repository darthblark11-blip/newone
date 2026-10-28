# Crouch and prone combat stances

Combat stances share the existing HEAD / BODY / LEGS aiming system. They apply
to the player and humanoid allies/enemies across the campaign, including the HQ.
They are separate from knockouts, dead bodies, boxing poses and ambient scientists.
Automatic contact cover layers its posture over the selected stance without changing it.
See [Collision-based cover](collision-cover.md) for wall peeks and low-cover pop-ups.

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

Standing LEGS contact follows the two actual thigh/shin chains without filling
the gap between them. Low firearm range follows the shooter's effective launch
stance: standing 15 m, crouched 20 m and prone 26 m. The round keeps that range
through later stance changes; the laser previews the current stance. Surviving
hostile humanoid leg hits can trigger side-specific falls and temporary prone
or seated fighting; [Leg injuries](leg-injuries.md) describes those states.
Seated enemies use the crouch elevation matrix, with an extended floor footprint.

Prone contact uses a directional capsule with 25-unit half-length and 10-unit
radius, independently of the HEAD damage profile. The player's capsule follows
the planted body heading, so turning the gun does not rotate the feet or wall
clearance. Swept projectile contacts and
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
Standing/crouch transitions take 150 ms; ordinary transitions involving prone
take 300 ms. A moving dive takes 700 ms.
Smoothstep interpolation drives the pose. Incoming hits use standing coverage
below 0.5, crouched coverage from 0.5 to below 1.5, and prone coverage thereafter.
An ordinary drop passes through crouched coverage before reaching prone.
Holding the stance control for 200 milliseconds while moving instead commits a
directional dive with invulnerability only during the 700 ms dive. The planted
body faces travel from launch and interpolates into a level belly-down position
within 65 ms. It stays extended while airborne, then falls onto the floor with one
dust burst at contact. At the apex the body rises fourteen units above its shadow
and grows uniformly by 9%, then settles back to its normal prone size. The 220-unit
lunge sweeps the full body against cover and cannot steer midair. A stationary
hold lowers the actor in place without invulnerability. Another transition must
wait for completion and a 180 ms recovery window. Pausing freezes progress.

Standing and crouching share the same hip-direction solver. The pelvis follows
travel through forward/sideways directions; travel beyond 112.5° from the torso
uses the opposite hip heading and a backward stride. Turns ease over 230 ms
with a 0.0032 rad/ms limit. The final hip heading stays within 97.2° of the torso,
including when stopped, releasing the aim stick or changing aim at rest.
Stopping retains the planted hip heading while the step motion settles.
Standing keeps its original leg surfaces, dark footwear, speed and full stride
clock; crouch keeps its separate folded legs and 46% clock. Rear standing
movement covers the full rear hemisphere relative to aim, including shallow
rear diagonals between 90° and 112.5°. Its camera-facing cloth uses the original
forward stride's broad, lighter trouser cap, taper and light planes. The narrow
ankle and dark boot point forward underneath the body. This surface projection
follows the existing rear joints without changing their motion or dimensions.
Backward steps use the body's stride clock, a small following thigh motion and
a smooth recovery curve. The rear presentation stays consistent when stopping;
the existing motion weight settles the joints. Leg stains map onto the projected
cloth, and the chemist coat follows the standing hip frame. The hip solver keeps
its existing 112.5° fold and trailing motion. Prone, boxing, melee, digging and
riding keep their own poses.

Standing weapon-aim turns accelerate and brake through the shortest angular arc,
instead of snapping to a new stick or mouse heading. The barrel, shots, laser
and weapon lights follow the resulting heading. The filter retires when the
weapon's aiming hold ends; ordinary movement faces travel immediately.
Crouch/prone and dedicated melee, support-action, mounted,
building and scripted controls keep their own heading paths. Bow draw quality
still observes the raw gesture, so body smoothing cannot improve an abrupt pull.

Crouch uses a separate articulated pose: hips back, chest/head leaning forward,
knees bent forward/outward and ankles under the hips. Folded thighs cover the
shins, with rounded knee contours visible beside the shirt. A slight uniform
camera size reduction conveys lower elevation without distorting the body.
Each recovering knee withdraws under the shirt while the heel lifts behind the
hip, exposing the back of the calf and the shoe tread. Chest and shoulders
counter-rotate against the stepping leg, with a smaller opposing pelvis turn.
The pelvis follows the movement stick independently of small sight corrections;
rear-diagonal travel beyond 112.5° from aim uses backward stepping. Hip turns
ease over 230 ms with a rotation-speed limit. Steps use 46% of the base gait
clock, broad shoulder/hip weight transfer, and a gradual settle when stopping.

Prone uses a shorter torso with distinct hip, knee and ankle joints and longer
rearward legs. Neutral poses center the head; active aim adds a cheek offset.
A lowered rifle rests across the upper chest/neck with both wrists on its
native grips, while a sidearm rests near the strong-side chest and leaves the
other arm available for crawling. The normal brief aim hold prevents flicker
between carry and presentation. Firing raises the weapon before resolving its
muzzle, including a shot immediately after a neutral carry.

Player prone aiming locks voluntary movement on the first input frame while
combat timers continue. The body heading is captured when lying down and follows
neutral crawling; aiming then rolls around that planted heading. Relative to a
body lying north, the continuous poses pass through:

| Aim | Prone pose |
| --- | --- |
| North | Face down, weapon forward |
| Northwest / northeast | Posted right / left elbow |
| West / east | Right / left side, opposite hip raised |
| Southwest / southeast | Interpolating from the side onto the back |
| South | Face up, weapon aimed back past the torso |

Head, chest, hips and shoulders reveal the roll; the pack lies underneath when
face up. Arms and gun rise above the chest on back-lying poses, while palms stay
below the gun and the head keeps its own depth. Gun, flashlight and cannon use
the true aim direction independently of the body's anchored floor footprint.
Main-weapon and cannon aim/fire stop crawling; the normal brief aim hold and a
140 ms lowering blend return the actor to a neutral crawl before movement resumes.
Flasks alone do not create an aim lock. Pause freezes these transitions.

Crawling alternates planted elbow pulls and outward recovery arcs with eased
contact speed and a smooth lift off the floor. Rounded upper-arm/forearm masses
and elbow caps keep a deeply folded sleeve from becoming a pointed ribbon.
Opposite knees advance under the pelvis, shoulders rotate against the hips, and the
carried weapon follows that changing support. The actor root does not wobble
sideways. Sleeves fit the existing arm lengths rather than stretching to grips.
Shoulder roots sit inside the chest contour. In face-down/crouched poses, a final torso/head pass
occludes sleeves, palms and gun parts passing below the body, including reload
and support-action arms. The neutral long-gun grip sits forward at the collar
so the receiver clears the chest during the crawl.
Palms and reload/support hands draw below the firearms. The dash pack reveals
its full vented back plate and twin drive housings as the torso drops prone;
its art stays mounted above back clothing and armor while face down and turns
underneath the actor when rolling onto the back.
The shell and twin drives have projected thickness and opaque surfaces that
sort around the torso during a roll. Outboard engines and exhaust collars stay
visible beside the supine torso. A rear-facing sidearm extends its firing arm
toward the feet; supine forearms lie above the abdomen, with palms below the gun.
Native guns, reloads and bow use one rigid weapon mount. Chemist hand actions
retain an independent body mount. Physical shots, muzzle flashes and torch
direction share the posed gun. Contact shadows tighten or flatten, and lowered health
bars/nameplates follow `actorStanceUIAnchor`. Brief merged damage/CRIT numbers
for hits against lowered actors use the same moving anchor and pause with combat.

The prone footprint also extends world collision probes. A dive requires space,
and turning cannot sweep the body through nearby walls. A blocked drop returns
to crouch; losing angular clearance keeps the last safe facing. Dash requires a
standing actor: its first press from a lower stance requests a rise.

Controls:

- Touch: tap the button above the left movement stick, across from dash, to toggle crouch/stand.
  Hold it for **0.2 seconds** to enter prone. It remains separate from the right aiming silhouette.
- Keyboard: tap **C** to toggle crouch/stand; hold **C** for **0.2 seconds** to enter prone.
  **Z** retains the explicit prone/stand shortcut. Shovel mode retains its C dig key.
- Controller: tap **D-pad down** to toggle crouch/stand; hold for **0.2 seconds** to enter
  prone. **L3** retains dash; **R3** retains aim/bow release.

A short tap never advances from crouch to prone. Tapping while prone requests
standing. Movement at the moment the hold reaches 0.2 seconds determines the
dive direction; releasing the movement stick before that point lowers in place.
The dive checks its full body footprint against cover and ends invulnerability
on landing or an interrupted dive. Holding the button after entry does not repeat
the action or stand the player back up when released.

Menus consume held input until release. Mounted actors, underground shovel use,
boxing and saloon activities retain their dedicated controls. Elevator prompts,
descent and arrival doors suspend stance input and transitions. Saves record the
current effective player stance; loading restores a settled valid pose. Older
saves start standing, and an obstructed saved prone footprint falls back to crouch.
Prone saves also preserve the anchored body heading; older saves fall back to
their saved aim heading.

## Balance and enemy response

| Settled stance | Movement speed | Stationary weapon spread | Recoil recovery rate |
| --- | --- | --- | --- |
| Standing | 100% | 100% | 100% |
| Crouched | 60% | 80% | 125% |
| Prone | 25% | 65% | 150% |

Prone speed applies to neutral crawling; aiming and firing hold the player still.

Movement retains only 35% of the stability bonus. Fire cooldowns, magazine sizes
and weapon definitions do not change. Weapons with zero inherent spread do not
gain an artificial accuracy bonus.

Humanoid shooters observe a changed target stance for 500 ms of visible time
before adjusting elevation. An amber LOW AIM warning announces the correction
to LEGS against prone targets. Lost sight restarts the observation period.
Some sustained ranged engagements also use crouch or occasional distant prone
positions; actors rise when combat ends or the target closes in.

Incoming player/allied fire now supplies a separate response before ordinary
stance roles and cover pop-up timing. A visible, aimed muzzle event or a real
nearby projectile supplies evidence; merely selecting an aim button does not.
The response takes 180 ms, with a 1.8 second memory refreshed by further shots
to bridge ordinary reloads. Repeated HEAD fire makes hostile humanoids crouch.
An actor already below that plane keeps its useful crouch/prone posture rather
than standing because it stopped moving or reached the next cover firing cycle.
Changing elevation, firing elsewhere or ending the attack releases the hold.

LEGS fire mixes three stable baseline responses: dive to usable nearby cover,
crouch to move body damage into the low plane, or keep fighting. A blocked dive
falls back to crouching. NPC cover dives use the original 420 ms animation,
65 ms unfolding and up to 270 units of travel, stopping at a safe sheltered
landing. The full prone footprint is swept throughout, firing waits for landing,
and the actor then joins crouched cover. The dive uses ordinary stance damage
rules. `ENEMY_SHOT_REACTIONS` and the role choice in `updateEnemyShotReaction`
keep reaction delay, memory and baseline responses available for difficulty tuning.
Cover gunners also stop repeating low shots that cannot reach a distant target
and can resume their ordinary approach to find a closer position.

Focused verification lives in `tools/check-stance-{hits,controls,ai,render}.js`.
`tools/check-enemy-shot-reactions.js` covers actual fire, sustained ducking,
reloads, incoming elevations, cover timing and all three leg-fire responses.
`tools/check-enemy-cover-dive.js` covers protected landings, swept motion,
timers, damage, pause and the handoff back to combat.
`tools/check-prone-dive-motion.js` covers all eight directions, preparation timing,
frame-rate independent travel, paused pose continuity and full-body cover sweeps.
`tools/check-prone-dive-damage.js` checks dive immunity across projectiles, spells,
blasts, damage over time, contact attacks and landing.
`tools/check-directional-footwork.js`, `tools/check-crouch-footwork.js` and
`tools/check-prone-directional-aim.js` check restored standing leg geometry,
crouched heel/sole recovery, planted aiming, cannon controls and eight-direction
roll geometry.
`tools/check-prone-pack-aim.js` checks continuous pack projection, opaque depth
passes, visible supine engines, and reachable rear-facing sidearm arms.
`tools/check-standing-aim-turn.js` covers turn acceleration, braking, angular
seams, input release, shot/light alignment and bow gesture quality.
`tools/check-standing-fluidity.js` checks rear-pose continuity on stopping,
heel-return velocity, joint settling and the existing stride clock.
`tools/check-standing-heels.js` retains the canonical rear joint and recovery
checks. `tools/check-standing-rear-surface.js` checks the original rear trouser
mesh, palette, projected stain attachment and painter stack.
`tools/check-standing-backsteps.js` compares standing/crouch hip direction through
movement, stopping, aim release and aim turns, including the visible standing
hip transform, native standing cadence, leg wounds and dedicated action exceptions.
`tools/check-standing-movement-parity.js` verifies native standing hip transforms
against the crouch reference and can render a comparison clip and direction sweeps.
`tools/check-player-footwear.js` checks the restored dark footwear across ordinary
and aimed movement, low stances, suits, utility actions and corpses.
`tools/check-stance-anatomy.js` checks bent joints, proportions, crawl support,
rendered arm lengths, grip attachment, neutral/aimed geometry and smooth joint motion.
`tools/check-stance-layering.js` checks torso/head occlusion and single action
draws for ordinary, reload, chemist and tool poses in both lowered stances,
including hands beneath guns and the pack's full prone face.
`tools/check-stance-scene.js` replays native touch input and complete frames at
phone and landscape sizes. `tools/visual-combat-stances.js` renders native pose
comparisons and a full HQ combat scene with adapting enemy fire.
`tools/visual-stance-motion.js` produces native idle/aim and gait sheets plus a
motion clip covering transitions, crouched movement and crawling.
`tools/visual-directional-stances.js` renders aimed walk/jog/run, crouch stepping
and all eight planted prone aims, including real barrel/torch/cannon alignment.
`tools/visual-standing-run.js` compares the original carried gait with aimed
forward/backward/diagonal travel, and renders input-driven weapon-aim turns.
