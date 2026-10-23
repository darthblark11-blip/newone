# NM-0 descent and underground chamber

The northern end of the headquarters reserves three routes. The central
`DESCENT` door reaches the downward-only elevator. The northwest and northeast
wing doors remain sealed. The laboratory's twenty guards, archive door, armor
blueprint and surface exit retain their existing places and purpose.

The descent asks before leaving the headquarters. At Level 9's arrival, the
lift doors part onto a narrow rock tunnel, which opens into a much wider ritual
chamber. This is a closed authored interior; there is no outdoor terrain or
reinforcement population beyond its walls.

## Elevator controls

Approach the central northern door. Tap `ELEVATOR`, press **F** or
**Enter** on a keyboard, or press gamepad **A** to open the confirmation.
Choose **YES · GO DOWN** or **NO · STAY HERE**. Arrow keys or the D-pad switch
the selection; **Enter**, **F** or **A** accepts it, and **Esc** or gamepad
**B** declines. Declining leaves the player at headquarters.

Accepting runs a 1.8-second descent, carries the player's health, shield,
weapons and ammunition into Level 9, and opens the arrival doors over 900 ms.
Movement and combat wait for the lift to open. There is no upward destination.
Route state and the underground encounter participate in the normal save/load
path; a hard reset discards the new run's route and enemy state.

## Environment

The elevator floor occupies `(-150,950)` to `(150,1250)`. Its approach tunnel
occupies `(-170,-400)` to `(170,1000)`, and the main chamber occupies
`(-760,-1900)` to `(760,-400)`. These floor rectangles join without a collision
seam. Native walls, pillars, timber supports, reliquaries and a northern altar
make the excavation solid. The elevator landing and all four initial magician
stations remain clear.

Floor art uses deterministic irregular stone courses, shallow cracks, a worn
earthen traffic strip and an inlaid ritual dais. The dais and elevator markings
are unlit material. Fourteen tiki torches and the player's flashlight are the
permanent light sources. The torch baskets have wrapped timber shafts, woven
collars, nested animated flames and a few rising embers. Rock walls, props and
figures share the existing cel geometry, camera lean and depth ordering.

At most ten 384×384 floor canvases represent 768-unit world tiles. Tiles bake
only when first visible and are reused until the environment resets. Torch
animation and floor texture do not consume gameplay randomness.

## Occult Magicians

Magicians use gold-encrusted, folded cloaks and deep hoods, carry a staff and
an open book, and use the native damage, hit and corpse pipeline. Their cloak
color identifies their attack family:

| Color | Attacks |
| --- | --- |
| Black | Chants over visible summoning circles and raises groups of three zombies while alive. |
| Red | Charges a fireball that separates into three outward projectiles; at close range also drives a forward cracked-ground lava eruption 6 metres from the staff. |
| Blue | Charges a lightning shard; its second spell is a centered shock field with a 3-metre radius. |

There are four initial casters: one red magician at the tunnel's far end, then
black, red and blue magicians around the main chamber. A black magician can
maintain at most twelve living summons, with twenty-four living zombies across
the encounter. Death stops further summoning. Existing zombies remain tangible
opponents; they do not replace the caster's health or create a separate kill
counter. Zombie emergence and bite windups are visible.

Fireball splitting, staff cracks and blue shock rings telegraph their danger.
Spells test the same enclosed floor and native solid fixtures as movement;
rock, pillars and other solid cover block them. Charging ends when a caster is
stunned or killed. Spell arrays and summoned populations are bounded, and
pause, death screens and elevator transitions suspend their simulation.

## Focused checks

```sh
node tools/check-underground-environment.js
node tools/check-underground-lighting.js
node tools/check-underground-integration.js
node tools/check-occult-combat.js
node tools/check-occult-art.js
```

The check exercises native collision along the entire entrance path, all four
magician stations, sealed boundaries and diagonal corners. It also verifies
solid fixtures, three headquarters route markers, bounded floor allocation,
cache reuse/release and geometry rendering without combat RNG consumption.

The lighting check covers noon/midnight darkness, torch and flashlight priority,
weapon-independent flashlight use and canvas/WebGL consistency. Combat and art
checks cover the separate spell families, native targets, caster interruption,
bounded summoning and rendering of held staffs, books and gold hooded cloaks.
