# City residents, NM-0 patrols and boxing

Level 1 has a separate ambient resident layer with adult male and female citizens. Seeded appearances combine three skin palettes, five hair colors, seven hair styles, eight top colors, four clothing treatments and four trouser palettes. Skin and hair identity follow the live model into the stun pose and subsequent corpse.

Six civilians per eligible city block stroll around its sidewalk, pause at intervals, and navigate obstacles through the existing indexed steering system. Nearby gunfire produces a bounded local sound event; injury records the attacker's position. Civilians run away for six seconds after the most recent threat and settle into walking afterward. Panic retains neutral/friendly flags and cannot fire a weapon. Farmers and other unarmed townsfolk also use the shared unarmed player gait while frightened.

In Level 1, ambient civilians stay at least 300 HUD metres (3,000 world units) from the outer faces of the main fortress enclosure and the relay fortress compound. A 15-unit actor margin keeps their whole body outside this buffer; each rectangle covers the full compound, including the curtain walls, gate slabs and outer wall faces. The rule applies in story and arcade modes and remains in force after gates are breached or fortresses are captured. Story mode also reserves the entire opening enclosure. Sidewalk routes, flight from gunfire and collision-checked stun recoil respect the same boundary. Civilians remain available in nearby city blocks beyond this buffer; the story recruitment roster and military escorts are unchanged.

NM-0 city guards are a new rifle unit with green-gray plate carriers, helmet, visor and insignia. Each eligible procedural block has a synchronized marching pair and two fixed sentries. They use the existing sight/chase/fire state machine during combat and resume their own beat after losing the target. Patrols are distinct from the large orb-weapon armored enemy. Authored story cores and liberated blocks do not receive ambient hostile patrols.

The layer is capped at 42 civilians and 12 guards, adding at most four actors every 20 simulation frames. Distant residents bank their state and release their live actor. An NM-0 ambush banks and removes living ambient civilians before physics or AI runs and suspends ambient candidate searches until the ambush ends. Existing living civilian actors inside the enlarged fortress buffer are banked and removed immediately, including between population refreshes. Distant eligible residents resume through the usual off-screen restoration; guards, recruits and military remain separate. Injuries and deaths persist in `biomeState[1].cityPeople`; killed residents do not reappear when a block reloads. The fixed story population, recruitment roster and military escort ledger remain separate.

New civilians and ambient city guards only appear outside the camera's current view, with a 100-unit margin. This uses the rendered view, including zoom, aim pan and screen shake, rather than distance from the player. Saved residents whose positions are visible wait to reload; guard sentries are checked at their actual posts. Candidate blocks extend through the loaded two-chunk ring so zoomed-out views can still find off-screen residents. Story mode continues to suppress ambient hostile city patrols.

## Punching and stun

The live player stance now uses shared southpaw boxing: right foot forward,
left rear power hand, nearest-target lock, four explicit punches, directional
guard/parry and upper-body sways. Visible joints and contact geometry come from
one solver. Selecting a melee tool or returning to the equipped firearm leaves
the stance. Old saved/preview poses retain their 180-frame guard fallback. See
[Boxing and quick draw](boxing-and-duels.md) for controls and verification.

One fist hit immediately stuns an unarmed civilian without reducing health.
Civilian and outdoor hostile knockdowns use the earlier directional fall:
locomotion determines travel while moving, a stationary victim falls with the
hit, collision stops the recoil, and the 40-frame buckle settles through the
original constrained limb springs. These world falls have no minigame launch,
roll or bounce. Another punch extends the stun without restarting the pose.
The civilian's four-second stun ends with 32 frames of gradual recovery, then
neutral flight. Hostile stun duration and electrical skeleton flashes retain
their earlier behavior.

`startPunchStun()` / `advanceStun()` and the native stun painter are separate
from Peacemaker's `startSaloonKnockoutPhysics()` /
`stepSaloonKnockoutPhysics()` / `drawSaloonKnockoutFigure()`. Only the activity
uses the five varied ragdoll responses. Residents streamed out mid-fall keep
their banked age and continue through the original frame-based path.

Skin, hair and clothing colors survive the fall. The light rig lowers and widens the actor's height footprint with the collapse, while its fallback shadow follows the same ownership rules. Existing lethal corpse fall timing is outside this change.

## Verification and previews

`node tools/check-city-people.js` exercises appearance coverage, local gunfire, player-gait panic, harmless AI, attacker-relative flight, a real first-punch hit, nonlethal fall/recovery, repeated blows, guard duration and tool/firearm precedence, formation/posts, combat engagement, residency, serialized deaths and falling material height.

`node tools/check-world-knockdown-legacy.js` compares six civilian/hostile
scenarios at six fall ages against recorded `55cb435` trajectories, joint angles
and actual paint signatures. It also checks real outdoor punches, repeated
stuns, recovery, electrical falls, collision and banked-age continuation.

`node tools/check-knockout-physics.js` and
`node tools/check-saloon-ragdoll-variety.js` check separate minigame travel,
lift, bounded contacts, five responses, identical repeated blows, fixed-step
frame agreement, wall sliding, anatomy, settled bodies and player costumes.
The minigame integrator cannot advance a world fall.

`node tools/check-city-placement.js` checks the 300-metre fortress buffers, exact boundary tangents and actor margins, newly eligible blocks between the former and current buffers, story and arcade placement, breached/captured exclusions, off-screen spawning and restoration, old saved residents in restricted areas, immediate removal between population refreshes, suspended candidate searching during ambushes, preserved injured/stunned/dead records, visible deferred and off-screen restoration after ambushes, and wander/panic/stun movement at the forbidden boundaries.

Existing character 71/71, corpse 87/87, population 130/130, save/load 33/33, depth 95/95, lighting 112/112, generation 2723/2723 and render 179/179 checks pass. The real-browser frame check passes 12/12 over 90 frames; its software renderer exercises the existing lighting frame-budget fallback. No mobile performance measurement or manual full combat playthrough was performed.

For the actual p5 appearance sheet and animation:

```
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome node tools/visual-city-people.js animate
```

The animation uses the game's character renderer, shared gait parameters and actual stun updates. The separate world preview uses live residents from the procedural population layer:

```
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=1 people
```

Previews: `docs/previews/city-people.png`, `city-people-motion.gif`, and `city-people-in-world.png`.

