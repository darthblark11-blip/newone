# NM-0 descent and underground chamber

The northern end of the headquarters reserves three routes. The central
`DESCENT` door reaches the downward-only elevator. The northwest and northeast
wing doors remain sealed. The laboratory's twenty guards, archive door, armor
blueprint and surface exit retain their existing places and purpose.

The descent asks before leaving the headquarters. At Level 9's arrival, the
lift doors part onto a narrow rock tunnel, which opens into a much wider ritual
chamber, then three connected ceremonial rooms beyond its north door. This is
a closed authored interior; there is no outdoor terrain or
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
seam. Native walls, pillars, timber supports, reliquaries and an altar make the
excavation solid. The altar sits beside the north doorway, keeping the passage
and elevator landing clear.

| Room | Floor bounds | Black / red / blue | Total |
| --- | --- | --- | --- |
| Ritual Chamber | `(-760,-1900)` to `(760,-400)` | 3 / 6 / 3 | 12 |
| Processional Nave | `(-580,-3450)` to `(580,-2250)` | 2 / 4 / 3 | 9 |
| Votive Transept | `(180,-5000)` to `(1520,-3750)` | 3 / 6 / 6 | 15 |
| Grand Sanctuary | `(-900,-7200)` to `(900,-5500)` | 4 / 7 / 7 | 18 |

The nave has paired columns, broken pews and a processional aisle. The offset
transept uses ritual inlays and reliquaries around intersecting routes. A bent
passage leads into the broad sanctuary, with side aisles and a larger altar.
Gold tracery, pointed stonework and hanging cloth retain the cel shaded look.
Undisturbed magicians face their altar and raise their books in ceremony.

Approach a north door and tap **OPEN DOOR**, press **F** or **Enter**, or press
gamepad **A** outside boxing stance. Doors part over 650 ms and then clear
movement, bullets and spell sight together. Opening does not require clearing
the preceding room. Unopened rooms stay dormant. The HUD counts magicians in
the current room; the complete dungeon roster is finite at 54.

Floor art uses deterministic irregular stone courses, shallow cracks, a worn
earthen traffic strip and an inlaid ritual dais. The dais and elevator markings
are unlit material. Thirty-nine tiki torches and the player's flashlight are the
permanent light sources. The torch baskets have wrapped timber shafts, woven
collars, nested animated flames and a few rising embers. Rock walls, props and
figures share the existing cel geometry, camera lean and depth ordering.

At most twenty-four 384×384 floor canvases represent 768-unit world tiles. Tiles
bake only when first visible; least recently used tiles release their canvases
when the cache fills. Leaving the dungeon releases the remaining buffers. Torch
animation and floor texture do not consume gameplay randomness.

## Occult Magicians

Magicians use gold-encrusted, folded cloaks and deep hoods, carry a staff and
an open book, and use the native damage, hit and corpse pipeline. Their cloak
color identifies their attack family:

| Color | Attacks |
| --- | --- |
| Black | Seeks cover and chants out of sight, raising groups of six zombies while alive. |
| Red | Charges a fireball that separates into three outward projectiles; also drives a forward cracked-ground lava eruption 30 metres from the staff. |
| Blue | Charges a lightning shard; its second spell is a centered shock field with an 18-metre radius. |

The opening chamber triples the original color mix to three black, six red
and three blue magicians. Each black magician can maintain twenty-four living
summons independently. The twelve authored summoners therefore have room for
288 living zombies across the dungeon. Death stops further summoning. Existing zombies remain tangible
opponents; they do not replace the caster's health or create a separate kill
counter. Zombie emergence and bite windups are visible. Crowded emergence
sites and the population caps can reduce the number raised in a chant.

Saved encounters retain all 54 casters plus up to 288 summons, including wounds,
defeated casters, prepared spells and opened or partly opened doors.
Door state restores before actor and player collision checks. Older four-caster
saves gain the new stations while preserving the health and deaths of their
original magicians. If new furniture blocks an old saved position, loading
places that person on nearby clear floor in the same room. Subsequent saves
never refill defeated rooms.

Fireball splitting, staff cracks and blue shock rings telegraph their danger.
Spells test the same enclosed floor and native solid fixtures as movement;
rock, pillars and other solid cover block them. Charging ends when a caster is
stunned or killed. Spell arrays and summoned populations are bounded, and
pause, death screens and elevator transitions suspend their simulation.

Magicians notice visible threats within 75 metres and begin ranged casts within
54 metres. Red and blue magicians move at 6 and 5.6 metres per second; black
magicians move at 5.5 metres per second. They retreat toward safer spacing and
can reposition during early preparation and recovery. Lava and shock casts
plant their feet for the committed portion of the warning. Lost sight leads
to pursuit of the last observed position rather than freezing immediately.
Black magicians favor actual occluding cover, remember the nearby threat, and
continue summoning without needing a direct view of the player.

Casters and zombies share a cached 40-unit A* grid with diagonal clearance,
smoothed waypoints, crowd separation and a bounded search budget. Runtime
searches resume across frames under one shared node-expansion budget instead
of allowing several complete searches to stall a frame. Door changes
invalidate geometry caches. Paths and live target references are rebuilt after
loading; saved encounter state retains the last observed threat position.

Solid queries use a separate spatial index. Interior floor queries avoid
repeated footprint sampling; room seams and boundary contacts retain their
original collision rules. Native movement still checks collision on each step.
See [Dungeon performance](dungeon-performance.md) for measurements and parity
checks.

Fire preparation, flying fireballs and the advancing fissure carry animated
flames, ember trails and temporary warm scene lights. Electrical charges,
shards and shock fields add blue light. All projectile exits—body hits, walls,
expiry, fireball splitting and caster interruption—leave fading comic fragments.
Wall contacts place the burst on the near face of cover. The same light list
feeds WebGL and the canvas fallback, while idle rooms retain only torch and
flashlight lighting. Spell light candidates and procedural particle bursts
have separate fixed budgets and consume no gameplay randomness.

## Focused checks

```sh
node tools/check-underground-environment.js
node tools/check-underground-lighting.js
node tools/check-underground-integration.js
node tools/check-occult-combat.js
node tools/check-occult-art.js
node tools/check-dungeon-combat.js
node tools/check-dungeon-navigation.js
node tools/check-mage-refinement.js
node tools/check-occult-spell-fx.js
```

The checks exercise native collision along the entrance and connecting passages,
all magician stations, sealed boundaries and diagonal corners. They also verify
solid fixtures, three headquarters route markers, bounded floor allocation,
cache reuse/release, door controls and geometry rendering without combat RNG consumption.

The lighting check covers noon/midnight darkness, torch and flashlight priority,
weapon-independent flashlight use and canvas/WebGL consistency. Combat and art
checks cover the separate spell families, native targets, caster interruption,
bounded summoning and rendering of held staffs, books and gold hooded cloaks.
