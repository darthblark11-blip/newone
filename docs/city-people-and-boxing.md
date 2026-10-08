# City residents, NM-0 patrols and boxing

Level 1 has a separate ambient resident layer with adult male and female citizens. Seeded appearances combine three skin palettes, five hair colors, seven hair styles, eight top colors, four clothing treatments and four trouser palettes. Skin and hair identity follow the live model into the stun pose and subsequent corpse.

Six civilians per eligible city block stroll around its sidewalk, pause at intervals, and navigate obstacles through the existing indexed steering system. Nearby gunfire produces a bounded local sound event; injury records the attacker's position. Civilians run away for six seconds after the most recent threat and settle into walking afterward. Panic retains neutral/friendly flags and cannot fire a weapon. Farmers and other unarmed townsfolk also use the shared unarmed player gait while frightened.

In Level 1 story mode, ambient civilians live outside the entire main gate enclosure, including the curtain walls and gate slabs. Arcade retains its inner-city civilians. Both Great Gates and the relay fortress remain off limits to ambient civilians in either mode, even after their gates are breached or the fortress is captured. A 180-unit buffer around the gates and relay compound keeps sidewalk routes, flight from gunfire and collision-checked stun recoil away from them. The story recruitment roster and military escorts are unchanged.

NM-0 city guards are a new rifle unit with green-gray plate carriers, helmet, visor and insignia. Each eligible procedural block has a synchronized marching pair and two fixed sentries. They use the existing sight/chase/fire state machine during combat and resume their own beat after losing the target. Patrols are distinct from the large orb-weapon armored enemy. Authored story cores and liberated blocks do not receive ambient hostile patrols.

The layer is capped at 42 civilians and 12 guards, adding at most four actors every 20 simulation frames. Distant residents bank their state and release their live actor. Injuries and deaths persist in `biomeState[1].cityPeople`; killed residents do not reappear when a block reloads. The fixed story population, recruitment roster and military escort ledger remain separate.

New civilians and ambient city guards only appear outside the camera's current view, with a 100-unit margin. This uses the rendered view, including zoom, aim pan and screen shake, rather than distance from the player. Saved residents whose positions are visible wait to reload; guard sentries are checked at their actual posts. Candidate blocks extend through the loaded two-chunk ring so zoomed-out views can still find off-screen residents. Story mode continues to suppress ambient hostile city patrols.

## Punching and stun

The player holds an orthodox guard for 180 simulation frames after a completed punch: left foot forward, right foot rear, bladed hips, chin-side hands and separate hip/shoulder drive. Jab, cross and left-hook motion share the current combo timing. Aiming a firearm or equipping a melee tool takes precedence over the guard.

One fist hit immediately stuns an unarmed civilian without reducing health. The new nonlethal reaction applies a collision-checked recoil, then a roughly 38-frame knee buckle and side roll, a small rebound, and a joint-limited damped settle. The four-second civilian stun ends with 32 frames of gradual recovery; the civilian then flees and remains neutral. Another punch extends the stun without popping the fallen body upright. Existing hostile four-hit stun duration and electrical skeleton flash are retained.

The new ground animation replaces the static placeholder and spinning stars. Skin, hair and clothing colors survive the fall. The light rig lowers and widens the actor's height footprint with the collapse, while its fallback shadow follows the same ownership rules. The existing lethal corpse fall timing is outside this change.

## Verification and previews

`node tools/check-city-people.js` exercises appearance coverage, local gunfire, player-gait panic, harmless AI, attacker-relative flight, a real first-punch hit, nonlethal fall/recovery, repeated blows, guard duration and tool/firearm precedence, formation/posts, combat engagement, residency, serialized deaths and falling material height.

`node tools/check-city-placement.js` checks story versus arcade placement, permanent fortress exclusions, off-screen spawning and restoration, and civilian movement at the forbidden boundaries.

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

