# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A single-file, top-down 2D shooter / world-building game written against **p5.js in
global mode**. The entire game — engine, art, AI, story, UI — lives in `game.js`
(~18,400 lines, ~900 KB). There is no build step, no module system, no test suite,
and no package manifest. The file is loaded directly by an HTML page (it targets
OpenProcessing, so keep it lint-clean for that environment) and every function is a
global.

**Consequences that matter for every edit:**

- p5's drawing API (`fill`, `rect`, `push`, `translate`, `image`, …) is on `window`.
  Functions that paint to an off-screen buffer take a target `g` and call `g.rect(...)`;
  passing `window` as `g` paints to the main canvas. `paintClutter(g, d, t)` is the
  model for this pattern — reuse it when adding art that must work both baked and live.
- Everything is a global, so name collisions are real. Grep before naming anything.
- Rendering happens inside a camera transform. Screen-space work (UI, vignette,
  weather screen layer) must be outside it or explicitly reset.
- Performance is a *design constraint*, not a polish pass. This runs on phones. The
  existing code is full of comments explaining exactly which optimisation bought which
  frame rate — **read those comments before "simplifying" anything**. Many things that
  look redundant (bake queues, view clamps, texel-size choices, chunk caches) exist
  because the naive version dropped the game to 20 fps.

## Current goal

**Expand the overworld environments and flesh out their aesthetics** — a livelier,
denser, more readable world for both the legacy (hand-authored) maps and the
procedurally streamed biomes. The systems below are all already implemented and
working. The job is to *extend* them, not rebuild them.

## The gameplay loop this world serves

1. **Story mode / cutscene** opens each level (biome).
2. Story section completes → the **open-world biome** opens up.
3. The player moves between **overworld sub-biomes and outposts**, then leaves via the
   **travel menu** (north or south).
4. Next biome, loop repeats.

So environment work has two audiences: the authored story arena (fixed, dressed,
cinematic) and the endless streamed world around it (procedural, deterministic,
cheap). Both must read as the same place.

---

## World architecture

### Two world builders, one seam

`generateMap()` (~line 17960) is the single entry point. It decides which of the two
builders runs:

| Level state | Builder | Notes |
|---|---|---|
| Level 0 (prologue house), Level 8 (NM-0 HQ) | `legacyGenerateMap()` only | Closed rooms, no streaming, `BIOME_ACTIVE = false` |
| Sector 1 (Stick City) — always | **Hybrid**: `legacyGenerateMap()` core + streamed chunks outward | `AUTHORED_SECTORS = [1]` |
| Sectors 2–4 while their story arc runs | **Hybrid** | `hasAuthoredCore()` → `!storyArcCleared()` |
| Sectors 2–4 after arc cleared, Sectors 5–7 | **Fully streamed** | `isBiomeLevel()` |

The gate functions are at ~13309–13362: `isAuthoredSector`, `storyArcCleared`,
`hasAuthoredCore`, `isBiomeLevel`, `isStreamedLevel`. An arc is cleared once the
sector's town is `established` (Level 1 additionally needs the south Great Gate
breached). **After that, re-entering the sector drops you into the generated world
instead of the scripted arena** — this is intentional and load-bearing.

### The authored core

When hybrid, `legacyGenerateMap()`'s output is lifted out of `buildings[]` into
`authoredSolids` / `authoredCars`, tagged `isAuthored`, and republished every frame by
the chunk manager. Four derived structures control the seam:

- `authoredCore` — bounding box, snapped out to chunk edges (`computeAuthoredCore`).
  Also keeps the *real* extents as `rx0/ry0/rx1/ry1`; use those for "am I standing in
  the story's ground" questions, the snapped ones only for chunk decisions.
- `authoredChunks` — the set of chunks the streamer leaves alone (`buildAuthoredChunkSet`).
  Occupancy-based, not bbox-based, with interior hole-filling. Slabs ≥ `SPAN_LIMIT`
  (3000) are excluded so Stick City's 9600-wide Great Gates don't blank out a
  kilometre of streamed world.
- `authoredMask` — chunk-bucketed AABB index (`buildAuthoredMask`), used by
  `hitsAuthored()` to give overhanging authored geometry right of way over anything
  procedural.
- `adoptLateAuthoredSolids()` — picks up buildings pushed in after level start.

The city grid numbers are shared on purpose: `legacyGenerateMap()` lays blocks on a
**1200 pitch with a 960 block inset 120 from each chunk corner**, and the `CITY` chunk
layout uses exactly the same numbers, so streets, sidewalks and lane markings line up
across the seam with nothing to fudge. **Preserve these numbers.**

### Chunk streaming

```
CHUNK_W        = 1200   // world units per chunk edge (1 city block + streets)
CHUNK_TEX      = 384    // baked terrain buffer resolution (3.125 units/texel)
CHUNK_BASE     = 200    // per-pixel noise pass resolution
CHUNK_LOAD_R   = 2      // 5x5 = 25 chunks live
CHUNK_KEEP_R   = 3      // evict beyond this
CHUNK_BAKE_CAP = 4      // bakes per frame …
CHUNK_BAKE_MS  = 7      // … or until this much of the frame is gone
CHUNK_TEX_CACHE= 14     // retired buffers kept for backtracking
NOISE_GRID     = 4      // noise sampled every Nth pixel, then interpolated
BIOME_SEED     = 1337
```

`ChunkManager` (~15806) owns residency (`refreshResidency`, driven by the *camera*
range, not just the player chunk), the amortised bake queue (`processBakeQueue`,
`ensureVisibleBaked` exempts visible chunks from the budget), the texture LRU
(`retire` / `texCache`), `syncAuthoredRemovals()`, `rebuildWorldArrays()`,
`drawTerrain()`, `drawDecor()`, `warmUp()`.

**Determinism is absolute.** Every chunk derives its whole layout from
`(biome, cx, cy)` via `chunkHash()` → `makeRng()`. Nothing is persisted, so leaving
and returning to a biome regenerates it bit-for-bit at zero memory cost. The only
mutable state is `biomeState[biome].destroyed["cx,cy,idx"]`, stripped at the end of
`generateChunkContent()`. **Never introduce chunk content that depends on frame count,
player state, or generation order across chunks** — it will pop when you walk away and
come back.

Cross-chunk continuity is achieved by making features a function of the chunk
*column* and world *y* only, never of the chunk record: see `trailCentreX()`,
`frontierTrailX()`, `jungleTrailX()`, `woodTrailX()`. Follow that pattern for any new
road, river, ridge or fence line that must survive a seam.

### Travel anchors

Every pure biome has three permanent, non-chunked landmarks that double as spawn
points (`buildAnchorStructures`, ~13832):

- `ANCHOR_HELIPAD` at `(0, 0)` — first arrival
- `ANCHOR_CHECKPOINT` at `(0, -CHUNK_W*2)` — arriving from the south (travelling north… see `arrivalAnchor`)
- `ANCHOR_OUTPOST` at `(0, +CHUNK_W*2)` — southern border wall

Hybrid sectors get **no** anchors — their landmarks are the authored ones (the Great
Gates), and the anchors would sit on top of the core. `generateChunkContent()` keeps a
`nearAnchor()` clearance radius so arrivals never drop the player inside geometry.

Travel plumbing: `travelDestination`, `canTravel`, `travelBlockedReason`,
`startExtraction`, `updateExtraction`, `arrivalAnchor`, `placePlayerAtAnchor`
(~17802–17960).

**The way in is the pause menu**, on the right half of the `CONTINUE` row and only while
`inOverworldView`. It used to be a green button drawn over the play screen, and there were
**three** hitboxes that started travel — that one, plus two with nothing drawn over them at
all — so a stray tap while exploring could end the level. A button that ends a level does
not belong on the play screen; the deliberate act of opening the pause menu is what the
old press-and-hold timer on it was standing in for. `tools/check-menu.js` sweeps the whole
unpaused overworld screen and asserts no tap anywhere starts travel.

### The overworld network (Sectors 1 and 2)

Sits between the trail helpers and the chunk generator, and is read by **both**
`generateChunkContent()` and `bakeBiomeDetail()` — that is the whole point of it. All
of it is decided by one axis index, so a chunk can answer questions about a neighbour
it has never generated.

```
axisHash(biome, i, salt)        // stable 0..1 per column OR per row
woodHasTrunk(biome, cx)         // ~42% of columns. Column 0 always — the anchors sit on it
woodHasLink(biome, cy)          // ~25% of rows, never a river row
woodHasRiver(biome, cy)         // ~24% of rows
woodLinkY(biome, cy, wx)        // east-west centreline, f(row, world x)
woodRiverY / woodRiverHalf      // ditto, plus a width that breathes along its length
woodCrossing(biome, cx, cy)     // where a trunk meets the water → {x, y, half, ford}
woodJunction(biome, cx, cy)     // where a trunk meets a link
woodSpur(biome, cx, cy)         // dead-end fork, wholly inside one chunk
cityHasCanal / cityCanalY / cityCanalHalf     // east-west waterway through a block row
cityHasTram(biome, cy)          // rails on the street along row cy's NORTH edge
cityZoneAt(biome, ox, oy)       // PARK PLAZA INDUSTRIAL CONSTRUCTION COMMERCIAL RESIDENTIAL
coreTaperX / coreTaperY         // 0..1, eases to 0 approaching the authored core
```

Three rules this layer exists to enforce:

1. **North-south features are a function of column and world y; east-west features are a
   function of row and world x.** Never of the chunk record. That is what makes a river
   meet itself across a vertical seam and a road meet itself across a horizontal one.
2. **Crossings are solved, not stored.** `woodCrossing` and `woodJunction` iterate a
   fixed-point solve over the two centrelines. The chunk north of a river and the chunk
   south of it both get the same answer without either having generated the other, which
   is what lets the approach roads on both banks aim at the same deck.
3. **Anything with its own rng stream keeps it.** `woodSpur` builds its own
   `makeRng(chunkHash(…, 6553))` rather than drawing from the caller's, because the
   generator and the bake run against different seeds. Drawing from either would put the
   painted road and the clearing it leads to in different places.

**`coreTaperX` / `coreTaperY` are not optional.** A waterway or road that runs into
hand-authored ground has to ease out over its last ~430 units, and *collision has to
taper with the paint*. Canal and river solids are skipped wherever the taper has closed
the channel — otherwise you get an invisible wall standing on dry ground beside the
city. `tools/check-render.js` guards exactly this.

### Standing water and wading

Marsh pools are **baked into the terrain**, not drawn live. A pond used to be an opaque
ellipse laid over the ground by `drawGroundLots()` every frame — a hard-edged saturated
disc that sat *on* the landscape rather than in it, and covered anything baked
underneath (which is why reeds had to ring it from outside its own silhouette). The
river 300 units away was already doing this properly.

`woodPools(biome, cx, cy)` is the shared list, on its own rng stream for the same reason
`woodSpur()` has one: the generator and `bakeBiomeDetail()` must produce the identical
pools or the player gets water they cannot wade. **Every rejection lives inside
`woodPools()`** — region at the pool's own centre, core taper, anchors, checkpoints
(all four chunk corners), trunk, link, river, and each other — because a pool one caller
threw away and the other still painted is exactly the bug this arrangement prevents.

Consequences for placement order: **pools go down first in the `WOODLAND` case**, before
anything that has to keep out of them. They are the one thing the generator does not get
to move, so the spur head, the set pieces and the timber all test against them through
`solidsClearAt()` and the lattice. `woodSpur()` also declines a head that would land in
water — better than a road that ends in a pond.

`waterDepthAt(x, y)` (0 dry, 1 mid-pool) drives both halves of wading: a 44% speed cut in
`attemptMove()` — the same choke point `elevSpeedFactor` uses, so it lands on everything
that moves — and the half-submerged read at the end of `Character.show()`, which draws
water *over* the body's lower half rather than changing the body art. The pond list is
rebuilt once a frame and is almost always empty.

**Set pieces must reserve the ground they actually occupy**, not the box they were
centred on. A hedge line, a ruin ring or a cordwood stack all reach past the
`lat.block()` around their centre, and the timber scatter runs afterwards — so both the
region branch and the spur head sweep every solid they created back into the lattice.

### Sub-biomes (Sector 2's woodland)

A biome is one palette and one layout; a landscape is not. `woodRegion(biome, wx, wy)`
resolves six regions off three slow world-space fields — `MEADOW · TIMBER · MARSH ·
HEATH · BURN · FARM` — at roughly a three-chunk patch size. Measured coverage: meadow
35%, timber 21%, marsh 16%, burn 11%, farm 10%, heath 7%.

The system has two halves and they answer different questions:

- **Tone is continuous.** One extra noise lattice (`latD`) in `bakeChunkTerrain`, applied
  per texel as an (r,g,b) swing from `ZONE_TINT[layout]`. Three multiply-adds, no seam
  possible, and it is what stops a kilometre of the same grass reading as a tiled
  texture. Only `WOODLAND`/`CITY`/`CITY_DENSE` have a tint; everything else is untouched.
- **Content is discrete, and asked per FEATURE — never per chunk.** A tree checks the
  region at its own trunk (`RG_TREES` gives the acceptance rate, `RG_CANOPY` the foliage
  colour bias); a piece of clutter checks it at its own position; each pass of regional
  ground paint checks it at its own sample point. A boundary then comes out as one kind
  of thing thinning while another thickens, which is what an ecotone looks like — rather
  than a line down a chunk edge where everything changes at once.

The exception is the handful of set pieces that only make sense several pieces at a time
— a boulder field, a hedged field, a spread of marsh pools — which are decided once from
the region at the chunk's own middle.

**Set pieces are placed before the timber, and by attempts rather than by the lattice.**
Both matter. The lattice hands out whole cells, and once a trunk road, a river and thirty
trees have taken their share of a 64-cell grid there is no contiguous 5×4 block left:
asking it for a field failed in four chunks out of five and a stone row never landed at
all. `findSpot(w, h, pad)` inside the `WOODLAND` case asks the far weaker question a set
piece actually needs — is this patch of ground clear — and the lattice keeps the scatter
around it honest.

### Water and decks

Two flags carry the semantics, because neither is an ordinary mass:

- **`isRiver`** — blocks characters, but not bullets, orbs or line of sight. Only the
  deep channel is solid; the painted shallows either side are passable, so brushing the
  bank costs a step sideways rather than stopping you on a line you cannot see. Emitted
  as `propType: "RIVER"` / `"CANAL"` biome props with **no case in `drawBiomeProps()`** —
  they are collision volumes only; the water you see is baked into the terrain.
- **`isDeck`** — never blocks anything. Bridges are built to be stood on.

Both are handled in `Character.checkCol`, `updateBullets`, `hasLOS`, `updateOrbs` and
`getPatrolBuilding`. **A new water body or walkable surface needs all five.**

Crossings come in two grades on purpose — `BRIDGE` (a structure, visible from a
distance, a destination) and a ford (a gravel bar, no structure, just the evidence of
one). The gap left in the collision run must clear the deck's *own width*, not merely
reach the centreline.

---

## The seven biomes

`BIOMES` table at ~13169. Each entry carries `sky`, a `pal` palette
(`base/alt/dark/accent/road/mark/walk/grass`), `weather`, `layout`, `climate`
(`clear`, `wet`, `rain` chance/hour, `cloud`, `dayF`, `nightF`), `fog` RGBA,
`clutterDensity`, and `lore`.

| # | Name | Layout | Weather | Character |
|---|---|---|---|---|
| 1 | Stick City | `CITY` | ACID_RAIN | Grid megablock, always authored core; canal and tram rows |
| 2 | The Undercity | `WOODLAND` | ACID_RAIN | Dark; `CITY_DENSE` inside the curtain wall, road network, rivers and six sub-biomes outside |
| 3 | Dry Gulch | `FRONTIER` | DUST | Agrarian belt, ghost town, mine bench relief |
| 4 | The Green Line | `JUNGLE` | FOG | Overgrown military cordon |
| 5 | The White Silence | `TUNDRA` | SNOW | Sparse, `clutterDensity: 0.35` |
| 6 | The Violet Waste | `ALIEN` | SPORES | Bioluminescent |
| 7 | The Crystal Flats | `CRYSTAL` | SHIMMER | Terminus, huge diurnal swing |

**Palettes are authored at midday, not midnight.** The whole day/night model
*subtracts* light — night is a wash laid over the top — so a palette written at night
values leaves nothing for daylight to be. Any new palette must follow this.

`layoutFor(biome, cx, cy)` resolves the per-chunk layout (this is where Undercity
splits into `CITY_DENSE` inside the core vs `WOODLAND` outside). `palFor()` does the
same for palettes (`WOOD_PAL` override).

---

## The environment pipeline — where to add things

This is the map you need for the current goal. Five distinct places art can live, each
with different cost and different rules.

### 1. `bakeChunkTerrain(biome, cx, cy, staticDecor)` — ~14557

Renders one chunk's ground **once** into an off-screen `p5.Graphics` and thereafter
blits it as a single `image()`. The expensive per-pixel work (layered noise, dithering,
alpha blending) is paid once per chunk. Noise is sampled on a coarse lattice and
bilinearly interpolated — ~2,500 lookups instead of ~40,000.

Helpers: `softStamp` (soft-edged blob), `bakeRibbon` (a road/river that follows a
centre function down the chunk), `bakeRibbonH` (the same thing running east-west),
`bakeStreet` (straight street with optional open ends), `bakeWatercourse` (bank →
shallows → channel → current streaks).

`bakeRibbonH` takes an optional `shoulders` count (default 5) and, if you pass small
multipliers for `edgeHalf`/`coreHalf` and the real half-width through `widthAt`, defines
the ribbon entirely in units of its own width — which is how a river gets a channel that
breathes along its length.

**Ribbon layer counts are the most expensive knob in the bake.** Every layer is another
full-chunk polygon. A woodland river row already carries the column's trunk road and
usually a spur, so the watercourse deliberately runs at 5+6 layers and 3 shoulders where
a road uses 12 and 5. Measured in draw calls per chunk (`tools/`): biome 2 averages
~1460 with a worst case of ~3400 on a trunk+river+spur chunk.

### 2. `bakeBiomeDetail(g, def, biome, cx, cy, ox, oy, rng, sample, latA, pal, layout)` — ~14846

The per-layout ground *art*, called from the bake. One `case` per layout:
`CITY`/`CITY_DENSE` (asphalt arterials → block interior → sidewalks → lane markings),
`FRONTIER` (dirt track, authored cross streets, relief, town main street), `WOODLAND`,
`JUNGLE` (mud track), `TUNDRA`, `ALIEN`, `CRYSTAL`.

**This is the primary place to add ground-level richness** — new surface types, wear
patterns, field boundaries, dry washes, plazas, tilled rows.

### 3. `generateChunkContent(biome, cx, cy)` — ~13909

Produces `{ solid, decor, decorBake, cars }` for one chunk.

- `solid` → collidable, enters `buildings[]`
- `decor` → **animated** props, redrawn live every frame
- `decorBake` → **static** props, stamped into the terrain buffer, zero per-frame cost
- `cars` → parked vehicles

Layout cases mirror the biome layouts. Placement discipline:

- Open biomes place every solid through **one lattice** (`makeLattice`) so nothing can
  land on anything else. City layouts don't need it — their buildings are carved out of
  a subdivided block.
- `solidsClearAt(list, x, y, w, h, pad)` is the manual overlap test; use it whenever you
  place outside the lattice.
- Respect `nearAnchor(x, y, pad)` clearance.
- Respect `hitsAuthored()` — the final filter drops anything overlapping authored geometry.

Clutter: `clutterCount = floor(70 * def.clutterDensity)`, gated by
`bnoise(biome, dx, dy, 0.0022) < 0.38` so clutter **pools in low-traffic areas** rather
than spreading evenly. Type chosen by `pickClutterType(def, rng, layout)`.

### 4. `paintClutter(g, d, t)` — ~16378

The micro-prop art. Target-aware: same code paints into a chunk buffer or the live
canvas. Every prop gets a **contact shadow** so it sits *on* the ground rather than
floating. Existing cases:

`PEBBLE · TRASH · PAPER · PUDDLE · WEED · CRACK · GRASS · FLOWER · HEATHER · ASH ·
TUMBLEWEED · BONE · SAGE · VINE · FERN · LOG · STUMP · MUSHROOM · REED · ICE · DRIFT ·
SPOREPOD · GLOWMOSS · SHARD · RIPPLE · MANHOLE · CONE · TREE · PINE · SNAG`

`pickClutterType(def, rng, layout, region)` takes the sub-biome as a fourth argument and
keeps a separate rotation per region. Ground cover is the fastest read a sub-biome has —
the litter under your feet changes several strides before the tree line does.

`CLUTTER_ANIMATED` (~14467) decides baked vs live. A type goes in the live list only
if it animates (`TUMBLEWEED`, `SPOREPOD`, `GLOWMOSS`, `SHARD`) **or** it is too large
and too round to survive rasterising at 3.125 world units per texel (`TREE` — a 30-unit
canopy lobe is 9 texels and comes back as hard squares).

**Adding a clutter type = three edits:** a `case` in `paintClutter`, a return in
`pickClutterType`, and a `CLUTTER_ANIMATED` entry if it animates. Miss the first and the
type still gets picked — it just falls through the switch and paints nothing. `GRASS` did
exactly that for a quarter of all woodland clutter until it was found by
`tools/check-generation.js`, which asserts every type `pickClutterType` can return has
art.

`REED` and `RIPPLE` are placed by the water code rather than by the general clutter
scatter. `RIPPLE` is live because it is the only thing that moves on a baked water
surface — but do **not** put one on an `isPond`: a pond is drawn later, by
`drawGroundLots()`, and its opaque ellipse covers anything baked inside it. That is also
why pond reeds ring it from outside its silhouette.

### 5. `drawBiomeProps()` — ~16675 and `drawBuildings()` — ~2004

`drawBiomeProps()` draws everything flagged `isBiomeProp` (anchors and set pieces).
It culls with `inView()` before the switch.

- Anchors and posts: `HELIPAD · CHECKPOINT · OUTPOST · BORDERWALL · GUARDBOX ·
  BLASTWALL · SANDBAG · BOULDER · BUNKER · WRECK`
- Crossings: `BRIDGE · CANALBRIDGE`
- Waterside: `BOLLARD · BARGE · QUAYCRANE`
- Civic square: `FOUNTAIN · PLANTER · BENCH`
- Building site: `HOARDING · SPOIL · MATERIALS · SITEHUT`
- Street furniture: `HYDRANT · POSTBOX · KIOSK · BUSSTOP`
- Woodland: `CABIN · LOGPILE · SIGNPOST · RUINWALL · MONOLITH · HEDGE · WATCHTOWER`
- Surfaces drawn in the ground pass by `drawBiomeDecks()`: `BRIDGE · CANALBRIDGE ·
  BOARDWALK` (the deck only — their rails and parapets are in `drawBiomeProps()`)
- Collision only, no art by design: `RIVER · CANAL`

Two conventions worth keeping:

- **Cast the shadow before you rotate.** `rotate()` carries `LIGHT_DX/DY` around with it,
  and a scene where half the props throw north-east and half throw south-east has no sun
  in it. Prefer encoding orientation in which of `w`/`h` is longer over carrying a
  separate `angle` — an `angle` rotates only the art, while collision stays axis-aligned
  on the unrotated `w`/`h`.
- **A bridge is a surface, not a mass.** Draw the deck flat and put everything with
  height — parapets, rails, posts — at the rim throwing inward, or it reads as a crate
  lying in the river.

`drawBuildings()` is the legacy/authored building renderer — a long dispatch over
boolean flags on each building record. Current flags include:

`isWall · isTerminal · isBasementTable · isCouch · isTV · isUpstairsTable ·
isGiantBarrier · isGovFortress · isUBarrier · isMall · isCasino · isTheater ·
isArena · isAmusementPark · isCircus · isTower · isStreetLight · isDumpster ·
isCar · isPalm · isHouse · isRock · isAlienPlant · isEnergyPole · isAlienBldg ·
isPinkPlanet · isPyramid · isChip · isFence · isTrailer · isBarn · isMarket ·
isGasStation · isLiquorStore · isShanty · isApartment · isBlockBuilding ·
isWesternBldg · isWaterTower · isWell · isHayBale · isWagonProp · isCactusProp ·
isCrateProp · isTumbleweedProp · isGrassLot · isPond · isParkingLot ·
isCropField · isParkingCar · isTreeTrunk · isBiomeProp`

Early-outs at the top of the loop matter: `inView()` culling, `isBiomeProp` (handled
elsewhere), `isTreeTrunk` (collision volume only — the canopy is the decor entry), and
ground-stack items (`isCropField`, `isPond`, `isParkingLot`) which are drawn by
`drawGroundLots()` / `drawBuildingPads()` instead.

**Adding a building type = a flag on the record in `legacyGenerateMap()` or
`generateChunkContent()`, a branch in `drawBuildings()`, and a matching branch in
`drawBuildingShadows()`.** Skipping the shadow is the most common way a new prop looks
pasted on.

There is also a dedicated western-building art module (`DG` palette ~1298 plus
`dgBoards`, `dgBoardwalk`, `dgHitchRail`, `dgFacadeBand`, `dgWindow`, `dgDoor`,
`dgSignPlate`, `dgAwning`, `dgGable`, `drawWesternBuilding` ~1492). It's the best
worked example in the file of composing a rich façade from small reusable primitives —
**mirror this approach when fleshing out other biomes' architecture.**

---

## Lighting, shadows, atmosphere

### Shadows

`drawBuildingShadows()` (~1968) forks immediately:

- **Streamed biomes** → `drawBiomeShadows()` (~16240). One **global light vector**
  (`LIGHT_DX = 0.58`, `LIGHT_DY`, ~16175) for every caster, so the whole scene reads as
  one lit space. Helpers: `buildingRise`, `shadowFill`, `castShadow`, `castShadowRect`,
  `charShadowX/Y`, `charShadowFill`.
- **Legacy maps** → the per-flag branch list, with per-level alpha and offset.

Shadow length and density are driven by the sun: `shadowLengthScale()`,
`shadowDensity()`, modulated by `skyDiffusion()`.

### World clock and sun

`seedWorldClock`, `updateWorldClock`, `worldHour`, `sunAltitude`, `daylight`,
`goldenHour`, `sunHeight`, `sunColour`, `keyStrength`, `warmth`,
`worldTemperatureF`, `worldClockLabel` (~17615–17730). `drawClimateReadout()` surfaces
it in the HUD.

### Light rig

`drawLightPass()` (~17353) applies illumination **multiplicatively** so lamp pools read
as light rather than as bright decals. `addLight`, `lightGradient`, `buildGradeLayer`,
`radialFalloff`, `softBlob`, `softRect` support it. `drawNightLights()` (~17530) draws
only the *fixtures* (bulb, housing glow, wet sheen straight down) with
`globalCompositeOperation = 'lighter'`, sorted by distance to the player and clamped to
visible lamps — the ground pool is the light rig's job, not this function's.

### Emitters — the one list of lights

`sceneEmitters()` is every light in the world, gathered once a frame and read by all
three consumers: the canvas rig, the GPU rig and `drawNightLights()`. Each of them used
to walk `activeBuildings` itself and decide independently what was lit, which is three
chances for a lamp to throw a pool with no bulb in it, or for the two rigs to disagree
about the scene the moment the watchdog swaps them.

An emitter carries `x, y, z, r, p, c, soft, rMin`, an optional cone (`aim`, `half`,
`inner`, `spill`) and a `fix` naming which fixture `drawNightLights()` should draw.
`z` is what decides what can occlude it — a 46-unit lamp head is not shadowed by a
26-unit wall — and **`rMin` is not optional on anything carried**: it is the clearance
inside which nothing may shadow the source, and without it the polar reduction finds the
bearer's own silhouette at r=0 in every direction.

**`PROP_EMITTERS` is how the overworld lights itself.** A biome prop throws light purely
by having an entry — no per-prop code anywhere else. Offsets are from the prop's centre
because the thing that emits is rarely the middle of the thing that carries it: a
watchtower's floodlight is at the top of the mast, a hut's light comes out of its
windows. Currently lit: the three travel anchors (`OUTPOST`, `CHECKPOINT`, `HELIPAD` —
the first thing a player sees arriving after dark, and often the only fixed light for a
kilometre), the posts around them (`WATCHTOWER`, `GUARDBOX`, `BUNKER`) and anywhere
somebody lives or works (`CABIN`, `SITEHUT`, `KIOSK`, `BUSSTOP`). `check-lighting.js`
asserts every key is a `propType` that actually reaches `drawBiomeProps()`, because a
light attached to a prop that is never emitted is silent.

**The torch is a property of the gun, not of the player.** `WEAPON_TORCH` lists which
weapons carry one — `PISTOL · SMG · DUAL_SMG · ASSAULT_RIFLE · ROCKET_LAUNCHER · TASER`.
The shotgun and the three western guns deliberately do not: they are the scavenged and
the improvised, and picking one up at night should put you back in the dark. It leaves
the **muzzle**, at the `WEAPON_MUZZLE` offset that mirrors the `bLX`/`bLY` the bullets
are fired from, so the light and the rounds come out of the same place; its `rMin`
is measured from there and has to reach back *past* the bearer. It sorts first in the
budget, so the player's own beam is never the light that gets dropped when a street gets
busy, and it draws no fixture — the beam is the light, and a bulb at the source is just a
bright disc sitting on the gun.

`TORCH_SPILL` is the bleed at the source, held to the fixed world radius `TORCH_SPILL_R`
rather than to a fraction of the beam. Scaled to the beam it was a 460-unit pool centred
on the gun — a disc under the player with the cone growing out of it, which read as a
base plate rather than as light.

Cones are `aim` plus an inner and outer half-angle. In the GPU path they are one dot and
one `smoothstep` against `uCone = (cos outer, cos inner)`, with omnidirectional sources
passing `(-1.001, -1.0)` — always satisfied — rather than taking a branch, because a
divergent branch on a tile GPU costs more than the arithmetic it saves. `TORCH_SPILL` is
the small omnidirectional bleed at the source; without it a torch reads as a cardboard
wedge taped to the gun. The canvas rig draws the same cone as a wedge path plus a small
core pool.

### The deferred rig (WebGL2)

`GLRig` sits in front of `drawLightPass()` and does the same job on the GPU, plus the
things a canvas cannot do: per-pixel relief shading, Blinn-Phong specular, ray-marched
sun shadows and **shadows cast by point lights**. `glRigFrame()` returns false on
anything without WebGL2, and the canvas rig — which is untouched — carries that frame
instead. One line in `draw()` chooses between them.

**The game is p5 in 2D mode, so there is no geometry pass to hang G-buffer outputs off.**
The rig is built on the two things that already exist instead:

- **Diffuse** is the finished p5 canvas, uploaded as a texture. It is the frame the game
  was going to draw anyway, so it costs nothing to produce.
- **Height/material** is `glRigPaintHeight()`, a small second p5.Graphics painted with
  flat greys from the same lists `drawBiomeShadows()` walks. **No art and no per-type
  dispatch** — it reads `buildingRise()`, `groundElev()` and a standing height, so adding
  a building type does *not* mean touching it. Channels are `R` height, `G` gloss,
  `B` facing as turns, `A` coverage.
- **Normals** are Sobel-differenced from that height field on the GPU. There are no
  authored normal maps in this game and no UV set to hang them on; deriving them is the
  honest answer, and it gives real relief on walls, kerbs and benches for four taps.
  The tangent-space path — sampling an atlas and rotating it into the entity's own facing
  with a 2D rotation matrix — **is implemented and running**, fed a neutral 1×1 texture
  until an atlas exists. `glRigSetNormalAtlas(img, mix)` is the way in.

Six passes, in this order, all pre-allocated in `glRigInit()`:

```
height paint -> upload -> normals -> ambient+sun (heightmap ray march)
             -> per light: occlusion -> polar reduction -> additive composite
             -> final composite -> drawImage back into the 2D canvas
```

Five things here are load-bearing:

1. **The rig must be a no-op on flat, unlit, unoccluded ground.** Both light colours are
   normalised to luma 1 and the ambient term is `amb - sunPow * Lz`, so a bare road at
   noon comes out of the GPU path pixel-identical to the canvas path and everything the
   rig adds is a departure from that baseline. Every biome palette in this file was
   authored at midday against that level; regrading the whole scene would invalidate all
   of them. `check-lighting.js` and the browser suite both assert it.
2. **It goes back into the p5 canvas, not onto the page.** The HUD, the sticks and every
   cutscene overlay are drawn *after* the light pass, so a GL canvas stacked over the top
   would bury all of them.
3. **Exactly one pass casts the sun, and it is the whole pass list.** Every caster in
   `activeBuildings` is in the height buffer, so *three* separate places had to stand
   down, not one: `drawBiomeShadows()`, the `castShadow`/`castShadowRect` pair that
   `drawBiomeProps()` calls 28 times, and the contact oval in `Character.show()`
   (`charShadowOwned()`). Each of them was drawing a second, differently shaped shadow
   under the marched one, which is what a scene with two suns in it looks like.
   Micro-prop shadows baked into the terrain stay either way — they are in the albedo,
   and they were baked against the same `LIGHT_DX/DY` the march uses. `slope` is derived
   from `shadowLengthScale()` so a marched shadow is the length the 2D pass would have
   drawn.
4. **An emitter is never shadowed by its carrier.** `rMin` per light. The player's torch
   sits nine units above the player's own silhouette, so without it the polar reduction
   finds an occluder at r=0 in every direction and the light comes out as a wedge with the
   bearer standing in a hole.
5. **The polar reduction takes the occluder's peak, not its first edge sample.** The
   occlusion target is LINEAR filtered, so the sample that trips the threshold is sitting
   on the occluder's filtered edge and reads about half its true height. Recording that
   let half of every point light through every wall in the scene.

Two things the height field cannot hold, and what happens instead:

- **A flying unit.** A height field only knows how high the ground is at a point, so a
  saucer entered into it reads as a *tower standing on the ground* — occluding lamps
  around its own footprint and casting from its base rather than from the air.
  `CHAR_AIRBORNE` keeps them out of the buffer and keeps their offset oval, which is the
  correct shadow for an airborne caster and the only one this projection allows.
- **A tree's crown, from its trunk.** Timber collides at a fixed 34×34 whatever the tree
  is, so the collision box is the wrong silhouette to cast from — and only the woodland
  gives its trees a trunk solid at all. The jungle's canopies, and every tree the clutter
  scatter drops, are **decor and nothing else**. So the height pass walks the same live
  decor list `drawDecor()` paints from and sizes each crown off `CANOPY_MASS` at the
  entry's own `s`. Keyed on the solid instead, a jungle at night had trees that occluded
  no lamp, took no torch and threw nothing but a painted oval.

**The player carries no light; their weapon does.** There used to be a 240-unit pool
pinned to the player, and the GPU rig inherited it. It meant the player was never
actually in the dark, so the one thing a night is for — making you walk toward the lamps
— could not happen, because the light came with you. What replaced it is the weapon
torch (see **Emitters**), which is a cone, comes off the muzzle, and goes away when the
player picks up a scavenged gun.

Cost control: point lights are scissored to their own screen box, the light list is the
same nearest-first budget `drawLightPass()` uses, the height buffer runs at half rig
resolution (every march sample and every occlusion resample reads it), and
`glRigWatchdog()` drops through `GLRIG_SCALES` and finally stands the rig down if the
frame budget goes — fall fast, recover slowly, because a rig oscillating between tiers
reads as flicker.

### A shadow needs a sun

`shadowDensity()` is multiplied by `daylight()`. It used to bottom out at 0.55, so at
midnight every prop in the world still had a hard oval lying beside it thrown by a sun
that had set hours earlier — while the deferred rig, whose sun term goes to zero on its
own, had correctly stopped casting. The two disagreed and the painted one was wrong.

**`shadowLengthScale()` deliberately does not take the same term.** It is how *long* a
shadow is, not how dark, and the rig derives its ray-march slope from it.

The painted contact shadows in `paintClutter()` follow the same rule, but only on the
**live** pass: a baked shadow is part of the chunk's albedo and that one texture has to
serve every hour of the day, which is the reason the baked list is only ever the small
stuff. A canopy drops its painted oval altogether once the rig is running, because the
rig is marching a real one off the crown's own silhouette.

### Weather

`WeatherSystem` (~16978). Particle pool sizes by kind:
`ACID_RAIN: 220 · DUST: 150 · FOG: 24 · SNOW: 200 · SPORES: 90 · SHIMMER: 54`.
Fog is fill-rate bound, hence few large banks. `rollWeather`, `setRaining`,
`applyBiomeWeather`, `initBiomeWeather` drive it from `climate`.

### Cloud shadows

`drawCloudShadows()` (~18092) — the signature top-down atmospheric effect, since the
sky is off-screen. A tiling cloud mask scrolled across the world at two scales and
speeds (parallax), subtracting light from the ground layer *under* buildings and units.
4–8 `image()` calls per frame regardless of cloud density. `cloudCover()`, `cloudHash()`.

### The pseudo-3D projection

A top-down camera has no horizon, so the only cue that a mass has height is its **roof
being displaced from its footprint, away from the middle of the screen**. `massLean(wx,
wy, rise)` is that displacement, and `MASS_LEAN` (1.5) is the one number that sets how
strong the whole effect is — it is the fake camera's focal length, nothing more.

Three things about it are load-bearing:

1. **It is not the light vector.** The walls used to extrude along `LIGHT_DX/DY`, so
   every building in the city leaned the same way its own shadow fell and the two merged
   into a single smear — which is exactly why a street of them read as flat shapes with
   stains beside them. The lean is where the **camera** is; the shadow is where the
   **sun** is; the scene only reads as solid when those two disagree.
2. **The base stays on the collision rect and the roof moves**, never the other way
   round. What you bump into is at ground level, so a building that pinned its roof to
   the collision box and slid its base around would appear to skate on the ground every
   time the camera panned. It also keeps the rig's height field — which stamps masses at
   their collision rect — agreeing with what is drawn.
3. **Faces are shaded by their own normal, not by which of them is showing.** Only the
   two faces the lean turns toward the camera are drawn, and which two that is flips as a
   building crosses the middle of the view; shading per normal is what keeps its lit side
   the *same* side while that happens.

Wall detail runs **along** the lean (mullions), not across it. Storey lines banded across
the face read as a stack of plates at this depth of projection — there are only ever a
few dozen pixels of face to divide.

`node tools/check-depth.js` covers both halves: the sort order (in front, behind, inside
a footprint, several characters interleaved, nothing dropped or drawn twice, props routed
to the right pass) and the projection (the lean reverses across the view where the sun
does not, the footprint stays on the collision rect, the visible faces flip in all four
quadrants, and `drawBuildings()` leaves the canvas transform balanced over every solid a
city chunk can produce).

### Elevation

`ELEV_ZONES` (~1827) — currently only Sector 3 (mine bench, boot hill, stock bench,
hotel/bank steps). Each zone has `x, y, w, h, f` (feather), `z` (height), `treads`.
`groundElev`, `elevRenderScale` (things get bigger as they rise),
`elevSpeedFactor` (slopes cost movement), `bakeElevation`. Relief belongs to the
authored sector only — `elevZones()` returns null once the arc is cleared.

Note the design intent in the comments: **boot hill is laid across the south end of
Main Street on purpose**, so the size change happens on the route everyone walks.
Apply the same thinking to any new relief.

---

## Render order (inside `draw()`)

```
updateActiveWorld() / updateWorldClock() / updateProductionMeters()
drawGround()               → chunkMgr.drawTerrain() → drawAuthoredGroundOverlay()
                             → chunkMgr.drawDecor() → drawCloudShadows()
                             (or legacyDrawGround() when not BIOME_ACTIVE)
drawBuildingPads()
drawGroundLots()
drawBiomeDecks()           (BIOME_ACTIVE only) — bridge and boardwalk surfaces
drawBloodChunks()
updateCorpses()
─── everything above is GROUND. Everything below is drawn OVER the player. ───
player.show() / updateEntities()      ← characters QUEUE via actorShow()
drawBuildingShadows()      → drawBiomeShadows() in biomes
drawDepthSorted()          → the queued characters interleaved with
                             drawBuildings() / drawBiomeProps() by ground contact
                             (outside a biome: the old flat order)
drawParkingCars()
projectiles / particles / orbs / shockwaves
drawNightLights() + weather.drawWorld()   (BIOME_ACTIVE only)
glRigFrame() or drawLightPass()           (BIOME_ACTIVE only — GPU rig first)
drawBiomeScreenLayer()
drawUI() / drawBiomeHud() / updateExtraction()
```

**Masses and characters are one depth-sorted pass** (`drawDepthSorted()`), not two
layers. Every character draw goes through `actorShow()`, which queues rather than paints
while `_depthOn`; the queue is then interleaved with the visible masses in ascending
order of **ground contact** — `massDepth()` is the south edge of a footprint,
`actorDepth()` is a character's own origin, which is where their collision circle, their
contact shadow and their entry in the rig's height field all already are.

That one comparison replaces the old fixed order. Standing inside a footprint puts your
feet north of its base, so the roof still hides you — which is what the old order existed
to get right. Standing in front of it puts them south, so you draw over the wall, which
the old order got wrong: walking along a building's south face made the player sink into
it. `drawBuildings()` and `drawBiomeProps()` take an optional `(list, i0, i1)` so the
sorted pass can hand each of them one run of an already-sorted array.

Levels 0 and 8 are not sorted (`depthSortActive()` is `BIOME_ACTIVE`) — closed interiors
composed against the old order, with nothing to gain.

The ordering question for any new art is still "is this a mass or a surface?":

- **A mass** (building, boulder, hedge, parapet, tree canopy) goes in the late pass and
  draws over the player. That is correct.
- **A surface** (bridge deck, boardwalk, road, lot, water) must go in the ground stack,
  before the characters, or the player walks *under* it. `drawBiomeDecks()` exists for
  exactly this: it draws the flat half of every `isDeck` prop, and the standing half —
  handrails, parapets — stays in `drawBiomeProps()` so the far rail still passes in
  front of whoever is crossing.

Anything new must be inserted at the layer that matches its physical height, or it will
read as floating — or, worse, swallow the player.

---

## Population and settlements

`resetPopulation`, `popRelease`, `popReleasable`, `popPlace`, `settlementRoster`,
`refreshPopulation` (~15553–15806). Settlements get a roster of citizens placed against
their chunk's solids; `Citizen` (~10751) is the wandering NPC class. `nearSettlement()`,
`maintainBanditPosse()`, `sweepForeignHostiles()`, `nativeToOverworld()` keep hostiles
and neutrals in the right places — a settlement whose story arc is still running is a
neutral scene, the country past it is not.

### The population ledger

**Population, allies, surviving citizens and the global count were four names for one
thing, computed four different ways, and every one of them derived from whatever entities
happened to be standing in the world when somebody asked.** Entities come and go — culled,
streamed, released with their settlement, rebuilt on a level change — so the number drifted
whenever the player moved, and the Directive "corrected" itself against the drift by
unassigning everybody.

There is one ledger now: `townsData[sector]`, a hard integer per department per sex.
Nothing derives it from the world. It changes only on events that should change it:

```
sectorLedger(id)              // the record, fields guaranteed
sectorPopSum(t)               // popTotal IS this — never stored independently
grantCitizens(id, m, f)       // the only way anybody joins; lands in UNASSIGNED
grantSectorSurvivors(level)   // one payout per sector, ever (`popGranted` latch)
sectorSurvivorCount(level)    // popSeeded − popKilled for 1 and 2
globalPopulationCount()       // the sum of the sectors
loadLedgerIntoWindow(id)      // fill the Directive's edit buffer
storeWindowIntoLedger(id)     // write it back
escortCasualty()              // one soldier off their HOME sector's roll
```

**One army by default; splitting it is a choice.** The Directive is *undivided*: everyone
the player frees joins a single roster (`POP_POOL`) that travels with them, so Stick City's
eighty and the Green Line's cordon are one column of numbers and clearing a new sector
**adds** to it while the jobs already handed out survive. Every grant lands in the pool.

Dividing it is the second half, and it is a **move, not a second system**. `postCitizen(
dept, sex, from, to)` shifts one integer out of the pool into a sector's own ledger or back
— a subtraction and an addition that always happen together, so a citizen is in exactly one
place and `globalPopulationCount()` (which sums every record, pool included) can neither
double-count nor lose anybody. `drawGarrisonMenu()` / `handleGarrisonClicks()` are the
screen: pick a sector, move people per department per sex. Reached from **DEPLOY BY
SECTOR** beside BACK on either copy of the Directive.

The pool is just another ledger record, which is the whole reason this was a small change:
the invariants, the save, the legacy migration and both structural checks apply to it
unaltered. `consolidateLegacyIntoPool()` runs once on load — an older save has its people
filed under the sectors they were freed in, and undivided is the default now.

**`window.pop*` is an edit buffer, not state.** It is loaded when the Directive opens and
written back when it is confirmed; between those two moments **nothing else may touch it —
including the panel's own draw pass.** That is not a style preference, it is the whole
reason the `+` and `−` buttons work: they write to the buffer from inside the draw block,
so a reload at the top of that same block undoes every press before it can be drawn, and
nothing can be assigned at all. `beginDirective(id, panel)` makes the load happen **once**,
when the panel opens on a sector, rather than sixty times a second while the player is
using it; `invalidateDirectiveBuffer()` is how a grant, a confirm or a level change says
the buffer is stale. BACK invalidates and reloads, which is what makes it a cancel.

**Opening the pause Directive points it at the sector the player is standing in.** It used
to open on whatever `viewingTownId` happened to hold — the last town looked at, or nothing
at all — so opening it from the Green Line showed Stick City's ledger, or an empty one.

**Surviving citizens are arithmetic.** For Stick City and the Undercity it is
`popSeeded − popKilled` — eighty minus the ones shot before the towers came down —
recorded by `processKill()` as it happens. A headcount could never be right: the roster is
spawned, streamed and rebuilt, so the answer changed depending on where the player was
standing when the towers fell. The stun baton and the taser exist so that *all eighty* is
reachable, and it is not reachable against a live headcount. Sectors 3 and up have no
seeded roster, so their allies are counted once at the moment the arc closes and then
written down as a number like everything else.

**`popGranted` is the latch that stops a sector paying out twice.** Re-entering, re-clearing
an ambush or reloading a save all used to recompute the population from whoever was standing
there.

**The escort is a loan, not an emigration.** Soldiers taken through the travel menu stay on
their home sector's military roll (`escortHome`), so travelling moves nobody between ledgers
and the global count does not change because the player did. They appear in the allies bar
because they are standing next to you, which is all that bar has ever meant. Dying is the
one thing that changes the ledger, and it is deducted as an integer at the moment it
happens.

**A save written before the ledger keeps its people.** The old records stored the total as
its own number and the departments *without* a sex split — `popFarming: 25, popMilitary: 30,
popTotal: 80` — so a ledger reading only the M/F columns reads the whole town as **zero**,
and `saveTownData()` then writes the zeros straight back. Loading an old file destroyed the
save rather than merely mis-displaying it. `migrateLegacyLedger()` adopts such a record on
first read; the sum being non-zero is what stops it running twice, and which sex column it
lands in is decided by the sector, because the old record does not say.

**Every door into the Directive must grant on the way through.** `openSectorDirective()`
opens the panel and the panel reads the ledger, so a caller that opens it without granting
shows a sector of nobody with nothing to assign. Three callers were doing exactly that —
the post-ambush cutscene (which is the Green Line's tan outpost, and every other ambush
sector), the farm hand-off, and Stick City's northern branch — each setting the old scalar
`popTotal` and then opening a panel that no longer reads it. They all go through
`openDirectiveWithGrant()` now, and `check-population.js` asserts *structurally* that no
bare `openSectorDirective(` call survives outside the wrapper, because the failure is a
missing call with no runtime symptom to catch.

**A zero must not latch on a sector that counts its people off the ground.** The tan
outpost flips the whole cordon friendly in one cutscene beat and opens the Directive on
another; granted in the wrong order, `popGranted` would record nobody and the sector would
be empty for the rest of the game. A zero is only ever final where the arithmetic says so —
`popSeeded` minus `popKilled`.

**Two holes the tan outpost fell down, both closed.** `viewingTownId` is `undefined` until
a Directive has been opened, and it is what most callers pass — keyed on that,
`sectorLedger()` minted a phantom sector that `globalPopulationCount()` then added to the
world's total; it falls back to `currentLevel` now. And `ensureDirectiveRoster()` used to
invent an unassigned roster by halving the scalar `popTotal` whenever the gendered counts
looked empty. Against a ledger that can only do damage — `popTotal` is whatever sector was
last looked at, so opening the Green Line's Directive dealt Stick City's headcount into the
Green Line's columns. It is a ledger load.

**The one that was actually doing it.** `processKill()`'s ally-death branch decremented
*four* different things on every friendly death — `globalPopulation`, the `popTotal`
scalar, the `popMilitary` scalar, and **`townsData[1].popMilitary` / `.popTotal`,
hard-coded to sector 1** whatever sector the player was standing in. In the Green Line's
post-ambush that fires dozens of times, so a firefight two biomes away rewrote Stick City's
Directive; and on a record with no legacy `popMilitary` field it wrote
`Math.max(0, undefined - 1)` — NaN — into the save. An ally death is one event on one
ledger and goes through `escortCasualty()`, which knows which.

Two structural checks now hold the line, and they are the guarantee rather than a sample of
it: **nothing writes a `townsData` record outside the ledger API**, and **nothing increments
or decrements the derived scalars** (`popTotal`, `popMilitary`, `globalPopulation` and the
rest are recomputed, never adjusted — a body changing sides used to mint a citizen out of
nothing). `storeWindowIntoLedger()` additionally refuses to write a sector the edit buffer
was not loaded for, so a panel opened on the Green Line cannot overwrite Stick City.

**What was removed.** `seedSectorPopulationFromSurvivors()` zeroed all eight department
counts and dumped everyone back into UNASSIGNED, and it was called from five places
including the plain level-finish fallback — so clearing an ambush in a sector the player had
already organised threw the whole Directive away. That is the "the game unassigns all
citizens" bug. A third copy of the ESTABLISH handler also lived inside `draw()`, reading
`mx`/`my` and flipping a town to `established` without writing the assignments anywhere.

The Directive panel exists twice (the overworld trigger and the pause menu). Both now read
`loadLedgerIntoWindow()` and nothing else, both carry a **BACK** button, and both show
**CONTINUE** instead of a greyed-out ASSIGN when the sector has nobody to hand over — which
used to be a dead end with no way forward and no way out.

### The sector population (Sectors 1 and 2, story mode)

**This is not the wanderer system and must never be routed through it.**
`seedSectorPopulation(level, count)` places 80 of the sector's own people around the
blocks near the player when a story arena opens, and `legacyStartAtLevel()` calls it
*last*, after the barrels and pickups exist, so nobody is placed inside one.

It is a closed loop and every part of it depends on the roster being a fixed pool:

```
seedSectorPopulation()  →  80 hostiles, all in RECRUITABLE, flagged isPopulation
the player kills some   →  spawnSingleEnemy() declines to refill an authored core
the arc completes       →  recruitSectorSurvivors() converts whoever is left
                        →  seedSectorPopulationFromSurvivors() → popTotal
```

Three guards make "eighty minus what you shot" true, and breaking any one of them
silently breaks the mechanic rather than crashing:

1. **It cannot go through `spawnSingleEnemy()`.** That function tops up the open road
   and carries two correct guards against putting strangers inside a settlement — it
   bails when the *player* is not in the outer region, and `getSafeSpawn(true)` rejects
   every candidate inside an authored core mid-arc. At the start of Levels 1 and 2 the
   player is standing in the middle of exactly such a core, so the original
   `for (80) spawnSingleEnemy()` returned eighty times without creating anything and the
   sector opened with nine people in it. That is the bug this exists to fix.
2. **It is never culled.** `cullDistantEnemies()` drops anything past `CHUNK_W * 4`
   (4800); Stick City is ~10600 across. Without the `isPopulation` exemption the roster
   would shrink as the player walked, which is indistinguishable from killing them.
3. **It is never topped up.** Same guard as (1), working in our favour: kills are
   permanent, which is what makes sparing anyone a decision.

**A liberated sector never spawns another local.** The two towers-down guards in
`spawnSingleEnemy()` only bail for a sector with *no* overworld table, so 1 and 2 fell
through on the assumption that `inBiomeOverworld()` would route them to the machine table.
Anywhere that is not true — the authored streets, the moment before `BIOME_ACTIVE` comes
up, an ambush window — the per-level ladder runs instead, and for Stick City that ladder
hands out `NORMAL`. Yellow regulars kept walking into a sector whose yellow regulars the
player had just freed, wearing the same shirt as the citizens standing next to them and
shooting at them. `LIBERATED_SPAWN` is what NM-0 actually has left to send: machines
mostly, plus its own intake (`NM0_ROOKIE`). It holds **no recruitable type** — after the
towers, every human in that uniform is one the player spared, and spawning more takes it
back. Both entries are in `SECTOR_GARRISON`, so `sweepForeignHostiles()` leaves them.

**A wanderer belongs on the open road, not in the authored streets.** `getOuterSpawn()`
is what guarantees that. The outer-region guard clears the *player*; `getSafeSpawn()` then
scatters the body 140–900 units away from them and knows nothing about the curtain wall —
and the authored-core rejection inside `getSafeSpawn()` only applies **mid-arc**, which is
exactly the window that ends when the ambush is cleared. So it re-rolls until the point
itself is clear of `inAuthoredSector(…, 500)` and of any settlement, and **declines rather
than force a placement**: a missed spawn is invisible, a robot in the town square is not.
It deliberately does *not* use the full `outerRegionUncached()` test — that also rejects
the 3×3 chunk neighbourhood around every checkpoint, and at 21% checkpoint density it
refused so much ground that standing near a post stopped the spawner dead.

`SECTOR_POP_MIX` is deliberately *all* recruitable types (`NORMAL`/`MOLOTOV` for Stick
City, `FEMALE_PISTOL` for the Undercity) so the count is exact rather than
eighty-of-which-sixty-seven-mattered. Those types are also in `SECTOR_GARRISON`, so
`sweepForeignHostiles()` leaves them standing. NM-0's armour arrives with the story
beats instead; to give the sector a standing garrison, add it to `SECTOR_POP_MIX` and
raise the seed count by the same amount so the eighty stays eighty.

`tools/check-generation.js` also asserts that `woodPools()` and the chunk generator agree
chunk for chunk, that marsh country actually carries water, that no pool sits on an
anchor, a road or the river, and that `waterDepthAt()` ramps rather than steps.

`node tools/check-saveload.js` round-trips the save: the escort, the world clock, the
sky and its roll schedule, all three ambushes with their spawn budgets, a cutscene
restored mid-run, and a finished one that must not replay. The save is a flat snapshot
of a very wide slice of state and the failure is always one of two shapes — something
written but never read back, or read back *before* `startAtLevel()` overwrites it.
`militaryToBringM/F` and `ambushKind` were both the second kind.

`node tools/check-cutscene.js` plants a garrison outside the curtain wall and checks the
tower cutscene still leaves the player in-sector, clear of geometry, on the same side of
the gate as the muster.

`node tools/check-population.js` asserts the roster seeds at exactly 80, that nobody
spawns inside geometry, that it survives a walk across the sector, that kills reduce it
and nothing refills it, and that none of this happens in arcade mode, in a cleared
sector, or in any other level.

**Only the roster converts.** `recruitSectorSurvivors()` requires `isPopulation`.
Checkpoint garrisons, streamed settlement residents and any wanderer that drifted in are
all the right *type* to recruit and none of them are people the player spared.

**The roster is not part of any ambush.** `checkAmbushCleared()` skips `isPopulation`
for the same reason — it waits for the field to be clear of hostiles, and eighty
residents standing around the blocks are never going to clear. Left in, the gate ambush
could only be finished by killing all eighty, which is the exact opposite of the
mechanic and sealed the sector for anyone who spared a soul.

### Cutscenes and scripted placement

Every cutscene that teleports the player onto a speaker has to pick that speaker
from **inside the sealed sector**. `sealedSector` is set by `legacyGenerateMap()` for
Sectors 1 and 2, and `insideSector()` / `clampToSector()` are the tests. In a hybrid
sector `enemiesList` also holds the streamed country past the curtain wall, where a
checkpoint garrison is a `FEMALE_PISTOL` and sorts no differently from a resident — the
tower cutscene picked one of those and dropped the player inside the south gate slab,
out of bounds, with the muster spawning back inside the sector behind a shut gate.

`window.storyBeats` (`markStoryBeat` / `storyBeatDone`) is the record of which cutscenes
have actually finished, by name — `L1_TOWN`, `L3_FARM`, `L4_CONTACT` and so on. Replay
used to be gated purely on side effects, and every flag the town scene's replay guard
keyed off is cleared by the beat that follows it, so reloading a liberated sector put
the player straight back into a cutscene they had already watched.

**Cutscene speakers are object references into `enemiesList`, and the entity list is not
saved.** `loadGame()` re-casts them from whoever is actually standing there, and closes
the scene if the sector has nobody left to say the lines — a restored cutscene with a
null speaker reads `.x` off it on the very next frame.

### The escort

Soldiers assigned in the travel menu (`militaryToBringM` / `militaryToBringF`) are
spawned by `legacyStartAtLevel()` on arrival. Three things that layer has to do, all of
which it silently did not:

- **Count.** Every `popTotal` calculation reads `window.militaryToBring` — the
  *singular* — and nothing ever assigned it from the M/F split the menu fills in, so an
  escort arrived and the destination's population had never heard of it.
- **Be consumed.** Left set, the same escort was re-created from scratch on every
  subsequent level entry.
- **Arrive with the player.** They are placed relative to wherever the player was when
  `legacyStartAtLevel()` ran, and *both* arrival paths move the player afterwards —
  `placePlayerAtAnchor()` for a streamed biome, `placePlayerAtAuthoredEntry()` for a
  Great Gate. `startAtLevel()` re-forms them on the player at the very end, which is
  ordering-proof and only touches anyone not already alongside.

### The Great Gates

A gate is a 9600-wide `isGovFortress` slab with a 600-wide door in it
(`GATE_DOOR_HALF`). It used to say so in a comment — *"gate visually stays closed
forever (collision remains solid)"* — so the road the objective announced as open was a
wall you could watch smoke come out of.

`gateIsOpen(b)` is the single predicate; `inOpenGateway(b, x)` is what
`Character.checkCol`, `updateBullets` and `hasLOS` all consult, so movement, rounds and
sight agree about where the hole is. The wings either side stay solid — the point of a
gate is that it is the only way through.

- **Sector 1:** the *south* gate opens once breached and the muster is beaten — or once
  the sector's transmission towers are down and that muster is beaten, since the grid
  holding the door shut is the thing that just went out. North is the NM-0 HQ approach —
  an interaction, not a walk-through.
- **Sector 2:** *both* gates open together once the towers are down and the ambush is
  clear, or on their own breach flag.

`recordSouthGateBreached(level)` writes the breach flag when the towers open a gate, so
`storyArcCleared()`, the travel menu and the objective line all read one state instead of
two. Without it a sector could be visibly open and still officially sealed.

`clearGateApproach()` is the other half and is not optional. Both gates have small walls
standing inside the doorway — the guard blocks, and Stick City's two gate-guard target
walls — which between them cover all but 25 units of a 600-unit door. Barrels are worse:
`getSafeSpawn()` scatters them 140–900 units from the player and knows nothing about the
gate, so one landed in the approach and sealed it in about one entry in six. The sweep
runs at level entry and again the moment the ambush clears, and is recorded per gate so
the second call is free.

---

## Resources and harvesting

Three materials — `WOOD`, `METAL`, `STONE` — held in `window.resources`, earned by taking
the world apart. The whole system sits in one block immediately above
`updateHealthPacks()` (~4728–4960), on purpose: pickups already had a working shape there
(`updateHealthPacks`, `updateWeaponDrops` — which does exist and is called from `draw()`
at ~3562, despite its stray leading tab) and resource drops are the same idea with a
different payload.

```
RESOURCE_KINDS / RESOURCE_DEF        // label + col/edge/lit per material
resourceCount(kind) / addResource(kind, qty)
spawnResourceDrop(x, y, kind, qty)   // splits into up to 4 stacks, scattered 18..54
updateResourceDrops()                // MAGNET 150 draw-in, TAKE 34 pickup, 3600f life
harvestProfile(b) / damageHarvestable(b, amount)
HARVEST_YIELD / HARVEST_SWING
meleeTool() / meleeToolOptions() / setMeleeTool(t) / cycleMeleeTool()
```

### What is harvestable

`harvestProfile(b)` is the single question — it answers `null` for anything that isn't,
and caches the answer on `b.__hv` so the melee sweep can ask it of every solid in range
without recomputing. Three sources:

- `isTreeTrunk` → **wood**, `3 + girth * 9`. `girth` is set by the woodland generator and
  is also the decor entry's scale, so **the tree you see is the tree you're paid for** —
  a fat oak is worth more than a snag because it is visibly bigger.
- `isRock` → **stone**, by area.
- `propType` in `HARVEST_YIELD` → `LOGPILE` wood; `BOULDER`/`MONOLITH`/`RUINWALL`/`SPOIL`
  stone; `MATERIALS`/`BARGE`/`WRECK` metal. Densities differ per prop because they are not
  all solid mass — a barge is a hull, a monolith is rock all the way through.
- Robots drop 5–15 metal from `processKill`, before anything else in that function runs.

Yield is clamped to 40 and **work scales with it** (`60 + amount * 9`), so a pick clears
anything in 1–5 swings and the payout, not a separate hp number, is what makes a monolith
a job.

`damageHarvestable(b, amount)` is the only way in, so a pick, a rifle round and a rocket
all take the same path and the drop can fire exactly once. On death it also removes the
canopy decor for a felled tree (otherwise the crown hangs in the air), and calls
`markPropDestroyed(currentBiome, b.chunkKey)` — **which is why `generateChunkContent()`
stamps `chunkKey` onto every solid before the destroyed-strip runs.** That ordering is
load-bearing: `hitsAuthored()` renumbers the array afterwards, so a key assigned later
would point at a different prop when the chunk reloads.

### The melee tool

`window.meleeToolSel` is `"NONE" | "SWORD" | "PICKAXE"`, cycled from the existing melee
button in the pause menu. `setMeleeTool()` keeps `window.swordEquipped` derived from it,
so every existing swing, animation and damage branch works unchanged — the pickaxe is a
third value of a flag that already existed, not a parallel system.

`HARVEST_SWING = { PICKAXE: 100, SWORD: 26, NONE: 7 }` against harvestables; against
people the pick does 120 to the sword's 200. It is a tool that can be used as a weapon,
which is the trade the player is choosing between.

`window.pickaxeOwned` defaults true — set it false to gate the pick behind a pickup. The
harvest sweep runs at the `meleeTimer === 10` frame, guarded by `this.isPlayer`, and walks
`activeBuildings` **backwards** because `damageHarvestable` splices out of it.

### Holding it — the melee arm rig

See **The arm rig** below: the tool is carried by the same two-pass rig as everyone
else's arms, and always rides the front pass.

`pickHead(len)` is one bar through an eye, pointed at **both** ends, with both tips
sweeping back toward the user. Two prongs curving forward is a clamp rather than a tool;
a single flat poll has to face some fixed direction all the time, which reads as a
mistake in a view that has no side to it. It is shared by the carry pose and both swing
branches, so the head only has to be right once.

`check-resources.js` counts the geometry an equipped tool adds at nine points of the walk
cycle including rest; any point returning zero means the weapon has vanished again.

### Inventory

Dad's Tablet is now five buttons (`height/2 - 100` through `+100`, hitboxes to match) and
`pauseMenuState === "INVENTORY"` draws a swatch, label and count per material. Resources,
`pickaxeOwned` and `meleeToolSel` all round-trip through `saveGame`/`loadGame`.

`node tools/check-resources.js` asserts the world is worth something (harvestable solids
by kind), that a swing takes a prop apart in the expected number of hits, that the drop is
collected, that a fist and a pick differ, that robots are salvage, that a destroyed prop
stays destroyed across a reload, and that the drop art draws. It needs `leftStick` /
`rightStick` stubbed before `player.show()` — a harness gap, not a game bug.

---

## Ballistics

Two constants at the top of the file, read by `Bullet.init()`:

```
ENEMY_BULLET_SPEED  = 12.5   // every hostile round, whatever the weapon
PLAYER_BULLET_SPEED = 35     // the player's and their allies' small arms
```

**A hostile round is always slower than the player's**, whatever it came out of — the
player has to be able to read an incoming shot and step out of it, and that only works if
every incoming round travels at one known speed.

The rule is written as **"not on the player's side"**, not as a list of weapons. It used
to be a special case for the enemy `PISTOL` alone, so every hostile carrying anything else
fell through to the 25 default and out-ran it: NM-0's grey and tan riflemen at 25 with
assault rifles, and Dry Gulch's bandit, cowboy and town cop at 25 with revolver and coach
gun. Written by side, a hostile added later inherits the rule instead of needing to be
remembered.

`iP` is `isPlayer || isFriendly`, so an ally and a recruited townsperson keep the fast
rounds — they are shooting *for* you. A neutral has `isFriendly` cleared by
`turnBandGroup()` and the wake-up cascade in `takeDamage()`, so their fire slows at the
same moment they become a threat, not before.

Outside the rule on purpose: beams (`RED_LASER`/`PINK_LASER`/`ORANGE_BEAM`/`ALIEN_LASER`)
at 9.8 — slower still, because the robot's beam is a tell; the rocket at 16 both ways; and
the taser at 20. `tools/check-ballistics.js` sweeps every type that can shoot at you.

---

## Construction

The architecture department made visible. `BUILD` in the pause menu (gated on
`buildCrew() > 0` — no architects, nobody to raise anything) opens a blueprint list;
picking one drops a ghost footprint that rides in front of the player on `aimAngle`, so
the left stick carries it and the right stick swings it around. Blue outline where it
fits, red where it does not, `PLACE`/`CANCEL` on screen.

Four blueprints to start: `WAREHOUSE · LABORATORY · RANGE · FARM` in `BLUEPRINTS`
(~14170). Footprint `w`/`h` is one number doing three jobs — the ghost, the ground the
crew clears and the collision box — so what the player lines up is what they get.
Adding one is a `BLUEPRINTS` entry, a name in `BUILD_ORDER`, and a branch in
`drawBuiltStructure()`. `FARM` is the model for a blueprint that emits more than one
solid: a barn plus an `isCropField` ground lot beside it, from `buildSiteSolids()`.

**Footprints are authored at 1× and multiplied by `BUILD_SCALE` (2.25).** At the 20 units
to the metre a parked car sets, that puts the warehouse at 26×17 m — a shed you walk the
length of, rather than the garden hut 1× was or the airfield 9× was. `BUILD_SCALE` is the only number to touch to
re-proportion the whole set, because **all the structure art is written in fractions of
its own footprint** rather than in absolute units: a `u = min(w, h) * 0.018` trim unit,
and every repeated element (roof ribs, lane dividers, scaffold standards, hoarding
dashes, cupolas) is a `span(n, lo, hi)` count rather than a fixed pitch. Author new art
the same way or it will either vanish or turn to hatching at a different scale.

Three things a 9× footprint broke, all fixed and all worth knowing before changing the
scale again:

- **The ghost stopped fitting on screen.** `buildPlacementZoom()` pulls the camera back
  while placing so the whole outline is visible, and `updateBuildPlacement()` caps the
  reach at 300 — a small footprint still sits in front of the player, a large one closes
  over them, which is the only thing that works once it is wider than the view.
- **There was nowhere to put it.** Measured over the woodland, a 2070×1350 warehouse
  found **0 clear spots in 81 sampled**. `buildClearable()` is the answer: a build site is
  a *cleared lot*, and ground scatter is the first day's work, not an obstruction.
  `clearBuildLot()` removes it on placement and banks what it was worth. Judged on **area**
  (`BUILD_CLEAR_AREA` 9000, `BUILD_CLEAR_MAX` 520) rather than on a list of flags — a
  fence bay is 470×10 and a hedge run longer, and the scatter set is different in every
  biome, so a flag list goes stale the next time one gets dressed. A river, a bridge deck,
  a pond, authored ground, a travel anchor and any building over about a ten-metre square
  still refuse the site. Measured at the current 2.25×: woodland 46–60%, Dry Gulch 73–77%.
  (At 9× the same measurement was woodland 3–11% — worth knowing before scaling up again,
  because the woodland is genuinely threaded with water and a footprint cannot cross a
  river.)
- **The crew's numbers were relative to a shed.** `nearestBuildSite()` measures its reach
  against the site's own size, and `buildSlotFor()`'s perimeter pad scales, or an
  architect leaning on one end of a hundred-metre slab decides the job is too far to walk
  to.

```
BUILD_DAY_PER_UNIT = 0.01   // 1% of a structure per in-game day per assigned architect
buildCrew()                 // popArchitectureM + popArchitectureF
buildSpeedMult()            // archLvl — the "Build Speed" the Directive already advertises
buildSpotClear(x, y, w, h)  // solids, hitsAuthored, waterDepthAt, other sites
buildSites[]                // every site in EVERY sector; the save's record
playerStructures[]          // this sector's solids, republished on every chunk rebuild
```

Three things this has to get right, and the third is the one that bites:

1. **Rate is a function of the assigned department, not of the sprites.** `townCitizens`
   is the visualisation and is rebuilt from the same counts whenever the Directive is
   confirmed; tying progress to the sprites would stall every site each time the roster
   was repopulated.
2. **Progress accrues against `worldClockDtMs`** — the same millisecond delta the sun and
   `updateProductionMeters()` run on — so a day of building is a day of building at any
   frame rate. `updateBuildSites()` walks **every** site in every sector and only the ones
   in `currentLevel` are ever drawn, which is what "it remains being built while you are
   away" means.
3. **`buildings[]` is replaced wholesale by `ChunkManager.rebuildWorldArrays()`**, and in
   a streamed biome that runs every time the player crosses a chunk edge. Anything the
   player puts in the world has to live in its own list the rebuild republishes, exactly
   the way the travel anchors do. `buildBarrier()` had pushed straight into `buildings[]`
   since it was written and had always been quietly swept away a few strides later; it
   goes through `playerStructures` now too.

**`MY BUILDINGS`** shares the `BUILD` row in the pause menu and lists every site in every
sector — this one's first, unfinished first — with the same progress bar that floats over
the site itself. Tapping a row in the current sector toggles `site.marked`, which puts a
screen-edge arrow on the HUD using the same rig the transmission towers use
(`drawUI()`, just after the tower block): **orange and pulsing while it is going up, blue
once it is built**, with the percentage under the distance. Sites in other sectors are
listed but cannot be marked — an arrow pointing two biomes away points at nothing.

**The world clock does not stop for the overworld.** `updateWorldClock()` holds only for
the pause menu, the Directive and the travel menu. The overworld is the world with a
different camera on it, so the day, the weather rolls, the production meters and the build
sites all keep running while the player is in it.

`republishPlayerStructures()` is the one way structures reach the world — called on
placement, on completion, on level entry (last in `startAtLevel`, after everything that
regenerates `buildings[]`) and on load. It also rebuilds the `site` back-pointer that
`drawBuildSite()` reads progress from; that pointer is a cycle and is deliberately not
saved.

**The crew: two trades running one loop.** A `Citizen` with `role === "ARCHITECTURE"`
takes a build site over its wander timer entirely — `nearestBuildSite()`, then
`updateBuildWork()` drives everything.

`updateBuildCrews()` runs **once a frame for the whole sector**, not per citizen, because
the trade split and the pairing are properties of the crew as a group; a citizen deciding
on its own would flip roles every time somebody walked in or out of range.

- **Roles alternate down a roster sorted by `slotSeed`**, so it is half and half and the
  split is stable. Haulers take the odd one (`i % 2 === 0` is `HAUL`), which is what makes
  the doubling-up case below reachable at all.
- **Pairing is round-robin**: hauler *k* works with mason *k % masons*. That is the
  round-robin form of "find the next unpaired mason" — with equal numbers every mason gets
  exactly one hauler, and a mason only ever sees a second one when there are more haulers
  than masons, i.e. when the crew is odd. It is also stable frame to frame, which a search
  is not.
- A crew of one hammers rather than fetching for nobody.

The loop: `TO_TRUCK` → `LOADING` (reaching into the container) → `TO_MASON` (carrying a
`RESOURCE_KINDS` block) → `HANDOFF`, which calls `mason.takeMaterial()` and puts the mason
into `PLACING` for `BUILD_PLACE` frames; the mason sets it in the wall and returns to
`BUILDING`, the hauler walks back. Haulers stop a pace short of their mason — walking to
the same point makes the two of them shove each other apart through `resolveCollisions()`
forever.

`buildTruckAt(s)` parks the lorry broadside south of the site, clear of the hoarding, and
`truckSlot(t, 0..2)` is the three unloading faces — both flanks of the container and the
tailgate. Which one a hauler uses is fixed at birth from `slotSeed`, so the approaches
stay evenly used. The truck is a solid (so the player walks round it) but citizens do not
collide with buildings, so it never blocks the crew.

Top-down a hammer swing has no rise to show, so it reads as **reach** — the arm drives
forward and the head rolls over the wrist on the down-stroke. Carrying, handing over and
placing are all one rig (two arms out front with the load between them, only the reach
changes) so the block never jumps between poses. `TO_SITE`/`TO_TRUCK`/`TO_MASON` count as
moving for the walk cycle; `BUILDING`, `LOADING`, `HANDOFF` and `PLACING` each suppress
the normal hands and draw their own.

**No material cost.** Not asked for, and deliberately not invented — but `confirmBuildPlacement()`
is the single funnel if you want `window.resources` to be the gate.

`node tools/check-build.js` covers the ghost refusing bad ground, the exact rate at
several crew sizes and architecture levels, a site advancing while the player is in
another level, the barn's field being walkable while the barn is not, survival across
`rebuildWorldArrays()` and across a save/load, the crew finding and ringing the job, and
that all four kinds plus both site states draw through both shadow passes.

---

## How a body comes to rest

Every corpse used to land in one pose. The legs were two rects at fixed offsets, the arms
two ellipses lerped between two constants, and the whole figure was rotated to face the
way it died — so twenty bodies in a room were twenty copies of one drawing at twenty
angles.

`ragBuild` / `ragStep` / `ragLimb` (~7614) replace that with a five-piece pseudo-ragdoll:
a torso spin plus **eight damped springs** — a shoulder and an elbow, a hip and a knee,
one pair per limb — shoved by the round that did the killing and left to settle.

**It is deliberately not a physics engine.** Eight scalars integrated per body for
`RAG_FRAMES` (34) and then **frozen**: `rg.done` stops the integration for good, so a
corpse costs nothing once it is down, which is nearly all of the time it exists. A hundred
bodies mid-fall is 800 multiply-adds; a hundred bodies on the floor is zero.

**The joints have limits, and that is what makes it a body rather than a rag.** A shoulder
swings the arm from roughly along the head-end round to along the foot-end and cannot take
it *through* the chest; a hip, lying down, splays about thirty degrees. Elbows and knees
are hinges that bend **one way** — the fold is stored as a magnitude and given its sign at
draw time, because letting it take either sign had half the bodies bending backwards at the
knee. `ragStep()` clamps the state, not just the target: a hard enough shove would
otherwise carry a limb straight through a limit on its way to a legal rest pose.

### The measurements

**`ragRig(bW, bH)` is the one place a body's proportions live** — both draw sites and
`check-corpse.js` read it, so there is no second copy to drift. A body seen from directly
above is the only view in this game that shows a person at full height, so the numbers
have nowhere to hide, and they are the standing-height fractions the anthropometry tables
give (Drillis & Contini): hip joint at 0.53 of height, knee at 0.285, shoulder at 0.818,
elbow at 0.630. Every one of them says the same thing — **the leg is the long part.**

`H` is recovered from the torso plate (`TL * 0.78` *is* the shoulder-to-hip span, and that
span is 0.288 H), so re-proportioning the plate carries every limb with it and one number
stays in charge. Two knobs sit on top of the anatomy — a length factor on the plate and a
width factor — set stocky on purpose, because a figure drawn at this size reads better a
little heavy than a little spindly. For the standard 21 × 27 body that gives a 29 × 20
plate, a 19.4 thigh and a 19.4 shank — the knee halving the leg, as it does — a 14.2 upper
arm against a 12.6 forearm, hips at the *base* of the torso rather than a third of the way
up it, and a whole body just under seven heads long.

**The drawn arm is not the bone split**, and assuming it was is what made the forearm read
short against an abnormally long shoulder-to-elbow. Two errors push the same way: the
shoulder joint sits ~1.5 units *inboard* of the real acromion (it has to, or the sleeve
hangs off the side of the chest), so part of the upper arm is buried in the torso and the
rest reads longer than it is; and the hand adds another 0.108 H below the elbow that a
bone ratio leaves out entirely. So the upper arm is trimmed below its 0.188 H, the forearm
grown above its 0.145 H, and `ragLimb` puts the hand and the boot *past* the joint rather
than centred on it — a circle centred on the wrist buries half of itself in the forearm.
Elbow-to-fingertip now comes out at about 1.5× the visible upper arm, which is what an arm
looks like.

Two failures worth knowing, because the second is not fixed by fixing the first:

- **Torso doing the legs' job.** 36 long and 27 wide with 33 of leg hung off it is a body
  that is nearly all ribcage. That is what a wrong leg-and-hip ratio looks like from above.
- **The taper running backwards.** *Widths* carry the read as much as lengths. Two 11-wide
  thighs spread across a 16-wide chest are wider at the hip than at the shoulder, and the
  legs and the torso merge into a single tube with feet on the end — long legs and all.
  The rule `ragRig` is sized against, and `check-corpse.js` asserts, is **the chest is the
  widest thing on the body and the legs narrow from the hip down**: chest 21.4, waist 20.2,
  hips 20.5, knees 17.7. Note the hips coming out a shade wider than the waist — that is
  correct and deliberate, because a real body is too; the step that must never come back is
  thighs wider than the shoulders. An earlier strict chest > waist > hips > knees ordering
  read fine but fought every attempt to thicken the legs, since widening a thigh pushes the
  hip span straight out.

The variation comes from four places and none of them is a simulation:

- **How square the hit was.** `Math.sin(bA - aA)` is exactly "how far across the body the
  round arrived" — 0 up the spine, ±1 through the ribs — and it costs one call. It sets
  the torso spin and leans every limb's rest pose downwind of the shot.
- **A rest pose drawn once at death** per limb, so the arms fling wide at a different
  angle on every body.
- **A pose archetype, picked before the jitter.** `RAG_ARM_POSES` (sprawled · thrown back
  overhead · down along the body · forearm folded across the chest · half raised) and
  `RAG_LEG_POSES` (together · splayed · one hip rolled out) are windows, not values, and
  the per-limb random draws happen *inside* the chosen window. Four independent uniforms
  give you variety that all looks the same — most of a uniform's mass sits in the middle of
  its range, so every body ends up with its arms at half mast. About half of bodies take a
  **different archetype per arm**, which is where the lopsided ones come from: an arm
  overhead and the other folded under reads as a person, two arms at the same angle reads
  as a doll.
- **Each limb's own `lag`** behind the torso, which is what makes an arm trail a body
  that is still turning instead of arriving already folded.

Frame zero is the pose they were shot standing in — arms hanging at the sides, legs
together — so everything after it is the fall.

### The legs do not cross

The arms are where the variety lives; the legs are where the realism is, and they have two
hard rules that the arms do not.

**A hip's relaxed position is rolled outward, so a body on the ground splays.** Legs
scissored over one another read as a rag. `a` is splay measured from straight down the
body and is floored just above zero, so the torso spin can never drag a foot over the
midline however hard the round hit. The sign of that angle was inverted when the archetypes
went in — positive `a` swung the left foot from −4.3 clean across to +11.8 — so *every*
body crossed its legs, and the archetype labelled "crossed" was the only one splaying them.
`check-corpse.js` now reconstructs the foot position the way the draw does and asserts no
foot ever reaches the centreline at any impact angle.

**A knee bends in one plane, and lying on your back that plane stands perpendicular to the
ground.** So from directly above a bent knee shows as a *shorter* shin, not a full-length
shin swung out sideways — drawing the full length at an angle is exactly what makes a leg
noodle. `ragShin(rig, bend)` foreshortens by the fold, and the knee is capped at 54° rather
than the arm's 115°, because past that a leg lying down is mostly pointing at the camera.

**And the knee only ever closes *toward* the body's axis.** `ragKnee(L)` caps the fold at
the splay plus the pose's own `room`, which says: hip rolled out, knee the outermost point
of the leg, heel coming back in under it. Letting the shin swing *further* out than the
thigh is what makes a body bow-legged — knees pointing at each other, feet turned out — and
it is not a shape a relaxed leg makes. The cap also floors at zero, so the hinge can never
come back through straight into a hyperextension.

`room` is the fifth column of `RAG_LEG_POSES`: how far the shin may come back *past* the
thigh, which is the only fold that reads as a knee rather than as a slightly angled
straight leg. It is **zero on both straight poses and 0.13 on the bent one**, and
`ragLegPose()` is weighted rather than uniform so the bent one lands on roughly a leg in
six. A body shot standing lands with its legs mostly extended; a visible knee on every
corpse reads as a crowd of broken toys. The room is small enough that a heel coming inward
still cannot reach the midline — `check-corpse.js` proves that bound by reconstructing the
foot at every impact angle rather than trusting it, and separately asserts the *frequency*
stays between 4% and 30% of legs.

`RAG_SCALE` (0.80) is one scale over the whole body, applied inside the corpse's own
transform. Every proportion above survives it — a smaller person, not a differently shaped
one. It puts a body at about 2.2× the standing body length, or ~1.5× the standing figure's
drawn extent.

### What a headshot leaves on the body

Every death that takes the head off already throws a pool onto the *ground* around it, and
none of it landed on the person it came out of — so a body with no head above the collar
had a clean shirt. `bloodSpray(rig, lean)` is the part that falls back on them: a fan over
the collar and chest, heaviest at the neck and thinning down the ribs, leaning the way the
round left. Two random draws multiplied together pile the mass at the collar; one uniform
would spread it evenly down a torso that should be soaked at the top and flecked at the
bottom. It is drawn **once in the constructor and then frozen**, like the rest pose — a
corpse must not develop new blood while you stand looking at it — and it goes down over the
shirt but *under* the sleeves, so an arm laid across the chest still passes in front of it.
`CORPSE_HEADSHOT_DEATHS` is the gate (`1, 4, 6, 8, 9`), and it is additionally gated on
`this.rag`, so a machine never bleeds.

Applied to the death types that leave a body lying down — `0, 1, 2, 4, 6, 7, 8, 9`, which
is every headshot and body-shot outcome. The gib deaths (`3, 5, 10, 11, 12, 13, 14, 15`)
come apart into their own pieces and are untouched. `ragHumanoid()` gates it on being
shaped like a person: the beasts, the vehicles, the machine and ARMORED's 105-wide slab
keep the old art.

`dT 7` — face down — used to draw two leg rects and a pool of blood with **no body between
them**, a pair of trousers lying in the street. It gets the same rig with the arms folded
under the chest and the back of the head showing, which is the difference between landing
on your face and landing on your back.

### A body is only a drawing for a moment

The point of the whole system is that a corpse stops being an object. Once nothing
about it is still moving, `stampCorpse()` paints it into the permanent blood layer
(`bloodChunks`, 1 texel per world unit, 96 MB LRU backstop that a normal session never
reaches) and the live object is spliced away. Sixty bodies go from **~1,180 ellipses a
frame to four `image()` blits**, and they stay on the ground for the rest of the level —
walking a biome away and back does not lose them.

None of that was happening. Three separate faults, all of the same shape — a clock that
could never reach zero:

- **`smokeTimer` was only ever assigned by the fire code** and left `undefined` on every
  other body. The retirement test read `c.smokeTimer <= 0`, and `undefined <= 0` is
  **false**, so *no corpse in the game had ever stamped itself*. Every body stayed live
  for the rest of the level.
- **`stopMotionTimer` was decremented inside three death-type branches** (10/15, the bits
  deaths, 14) and nowhere else, so an ordinary body — the common case, and every
  headshot — held it at 156 forever.
- **dT 13's bleed was nested inside its parting**, so once the two halves reached their
  50-unit gap the timer stopped counting and stayed above zero for good.

The clock is ticked in **one place** at the top of `Corpse.update()` now, and
`corpseSettled(c)` asks per death type what is actually still moving — spurt (`bT`, only
1/2/3/4/6), sliding pieces (`stopMotionTimer`, only 5/9/10/11/13/14/15), separation
(`corpseSepMax`), the fall, the settle, bleed and smoke. An ordinary body retires in ~35
frames instead of 156, because its pose froze at `RAG_FRAMES` and there was nothing left
to draw.

**The ground remembers, per biome.** `legacyStartAtLevel()` used to call `clearAllBlood()`
on entry, so the ground you soaked in Stick City was spotless again the moment you came
back from the Undercity. Surfaces are **banked per sector** (`bloodBanks`, `useBloodBank`)
and swapped in on arrival instead. Nothing is serialised, which is the whole reason it is
cheap: chunk generation is a pure function of `(biome, cx, cy)`, so world coordinates mean
the same thing on every visit and a mark laid down an hour ago is still under the same
tree. `bloodChunks` / `bloodChunkUse` stay exactly what they were — the *active* bank — so
every painter and the draw loop are untouched.

**Two layers per ground chunk, and the order is the point.** A splatter thrown *after* a
body has been pressed in must not land on top of it — blood goes on the floor. The layer is
a suffix on the chunk key (`bloodKey`, `isBodyLayer`) and nothing else, so the bank swap,
the budget and the wipe are all untouched; `drawBloodChunks()` just lays every floor
surface down before every body surface. A separate pair of dictionaries would have meant
touching all three for a two-line ordering problem.

`retireCorpsesToBloodBank()` runs first, before the swap: `corpses[]` does not survive a
level change, so anything still falling is fast-forwarded and pressed in rather than
dropped.

Two ceilings, not one. `BLOOD_BUDGET_BYTES` (96 MB) is now the total across **all** banks
and `trimBloodBudget()` evicts globally by least-recently-painted — so the memory ceiling
is the one it always was, and what gives first is the oldest blood in the biome you have
not been back to. `BLOOD_MAX_SURFACES` (256) is the second: every surface is its own
canvas element and a browser refuses those long before it runs out of bytes, since a
soaked session is hundreds of 256×256 buffers rather than a few big ones. `clearAllBlood()`
now empties only the active bank; `wipeAllBloodBanks()` is the genuine reset and only
`restartGame()` calls it.

**A body that dies off screen retires too.** `updateCorpses()` only ran `update()` within
`inView(…, 800)`, so anything killed and walked away from sat in the live list until the
player happened to wander back past it — over a long biome run, every body they ever left
behind. Off screen it now runs the clock and nothing else: no particles, no smoke, no
per-piece motion, with the pose fast-forwarded to where it would have ended up (the settle
is deterministic and freezes anyway). dT 12 is the exception — it is a body still flying at
something with a charge on it, so it runs wherever it is.

`tools/check-corpse.js` asserts who gets a settle and who does not, that the impact
direction is read (and read the right way round), that eight identical kills produce eight
different poses, that all four elbows and knees actually bend, that across forty bodies the
arms use the whole arc and a good share land lopsided, every proportion above including the
taper, and — the cost argument for the whole feature — that it freezes and does not drift
by a hair over the next 300 frames, that every death type retires into the ground layer,
that a body dying off screen retires as well, that a biome's ground keeps its dead across a
trip to another biome and back while a restart wipes every bank, and — the cost argument
stated as a number — that sixty bodies mid-fall are expensive and sixty bodies on the floor
draw nothing at all.

---

## Getting round things

`steerAvoid(ent, ang, speed, blocked)` (~7960) is how everything that walks and is not
the player deals with an obstacle. The player is steered by the player.

**What it replaced was a wall slide.** Movement was applied per axis, so a runner meeting
a wall head-on had one axis blocked and the other free and smeared along the face — and a
second block of code then added *extra* sideways travel on top, so hitting a wall square
sped them up along it. A real turn only happened when both axes were blocked at once, and
it was a blind 45-frame commitment to a heading nobody had checked was clear.

It turns now. When the heading ahead is blocked it fans out from it and takes the first
heading that is actually open. Three things about the search are load-bearing:

- **Side-first, not offset-first.** The preferred hand is exhausted across *every* offset
  before the other hand is tried at all. Sweeping offset-first — narrowest gap wins,
  whichever side it is on — ping-pongs: turn left, drift, find the narrowest gap is now on
  the right, turn back. Traced against a 400-long wall it never got more than 27 units off
  the centreline in 500 frames. Side-first is "keep turning the way you already turned",
  which is what actually rounds things.
- **Progress is measured along the heading they wanted**, not as distance travelled. A
  runner pacing the back wall of a courtyard covers plenty of ground and gets nowhere, so
  an odometer never fires; the projection onto the wanted heading is zero for exactly that
  motion. No progress in `AVOID_MARK` (240 frames) → sweep from the **widest** offset
  instead of the narrowest, which turns "hug the obstacle" into "back out of it".
  The window is four seconds because going round a long wall is a legitimate detour that
  scores zero while it lasts — at 90 frames, honest wall-following read as stuck.
- **The panic does not re-arm while it is running.** Backing out means heading away from
  the goal, which scores as no progress, which re-arms it — a runner that escaped its
  courtyard then kept running west for the rest of the level.

A reactive steerer cannot *solve* a concave trap whose goal lies beyond the closed end —
that wants a real path. What it must do is find the mouth and not be pinned to the back
wall, and `tools/check-pathing.js` asserts exactly that much.

**Citizens have collision at all now** — they used to walk straight through houses.
`Citizen.citizenBlocked()` gates on `inView`, which is correctness before it is an
optimisation: `activeBuildings` is a ring around the camera, so a citizen outside it would
be answering from missing data. A build site and its lorry are exempt, because a hauler
has to reach into the container and a mason has to stand against the hoarding; a
*finished* structure blocks them like anything else.

### The collision index

Giving 130 citizens collision took the game to **118,000 AABB comparisons a frame** —
499 tests over a 235-solid `activeBuildings`. `colNear(x, y)` is a uniform grid
(`COL_CELL` 220) rebuilt at the end of every `updateActiveWorld()`; solids are inserted
into every cell they overlap **padded by the largest body radius**, so a point query only
ever reads one cell. Anything longer than a few cells (the Great Gates are 9600 across)
goes in `colBig` and is always scanned. Measured after: **1.3 solids per query, 755
comparisons a frame.**

Anything that splices `activeBuildings` directly must call `invalidateColIndex()`, which
drops back to the full scan until the next rebuild. `check-pathing.js` compares 3000
indexed queries against the brute-force scan on a real streamed world — the index is only
worth having if it can never *miss*.

---

## The arm rig

`Character.show()` draws the torso, then the attire, then the arms, then the head. That
order is right for a character holding a **gun** — the arm reaches forward and belongs on
top — and wrong for every other pose, because a sleeve is a 15-unit ellipse centred on a
shoulder that is only 13 units from the middle of a 21×27 body. Drawn over the torso, its
whole inner half sits *on* the body: that is the bulged-shoulder read. Half of a sleeve is
meant to be inside the torso.

`Citizen.show()` (~11700) has always done it correctly and is the reference: sleeves and
the **trailing** hand go down before the body, the body covers their inner halves, and the
**leading** hand goes on top afterwards. The occlusion *is* the stride — nothing is hidden,
things pass behind.

So `show()` now builds an `armPass(front)` closure immediately before the torso ellipse and
calls it twice — `armPass(false)` there, `armPass(true)` from the arm block further down.
It covers everyone who is not holding a gun: the player empty-handed or with a melee tool,
and every neutral in `TOWNSFOLK` (hoisted to module scope; it was being rebuilt per
character per frame).

- Each arm is one tapering limb — upper arm plus forearm — from the shoulder to a hand
  that leads slightly outboard as it swings forward, rather than a blob at each end.
- `rest = sin(frameCount * 0.045 + this.x * 0.01)` when `!isMoving`, so a standing figure
  breathes and a crowd does not do it in unison.
- **A held melee tool always takes the front pass**, whatever the swing is doing — half a
  pickaxe swallowed by a torso is worse than one drawn a layer too high.

**The failure mode this replaced is worth knowing, because the obvious fix is wrong in the
other direction.** The original code hid a hand whenever the swing sat between a
`frontThreshold` and a `backThreshold`, as a stand-in for depth. Top-down there is no depth
to stand in for, so that only deleted the sword twice a stride and — since `swing` is
exactly 0 when `isMoving` is false — left an idle player holding nothing. Removing the test
and drawing every arm on top fixes the disappearing and *causes* the bulge. Only the draw
order fixes both.

`tools/check-character.js` watches the order of `ellipse()` calls (a hand is 8×8, the torso
is `bodyW × bodyH`) and asserts both hands exist at all 16 points of the cycle, that both
sit behind the body at rest, that the trailing one passes behind mid-stride, and that a
tool hand never falls behind.

Armed poses are deliberately untouched: the muzzle offsets (`bLX/bLY`) are tuned against
those arm positions.

---

## How a robot dies

`ROBOT` is the only non-organic hostile that fights on foot, and every death site in the
file reached straight for the human gore table — so a machine burst into red mist and
bone, and the shotgun and lightning overkill rotations tore it into a torso and two arms
it does not have. `robotDeathBurst(e, a, sourceIsPlayer, knockback)` (~7390) is the one
way a robot dies: sparks, oil, swarf, smoke, an oil splatter, a `"ROBOT"` corpse, and a
secondary detonation.

Six places kill one and all six now route through it — `triggerExplosion`,
`triggerRocketExplosion`, the melee sweep in `updatePlayer`, the jetpack dash blast, the
chemist cannon's tesla chain, and `Shockwave.update`. The bullet path in `updateBullets`
had its own branch already and keeps it (it needs the impact point, not the body's).

Three things to know before touching it:

- **The detonation is deferred.** `setTimeout` rather than a direct call, because every
  caller is standing inside a loop over `enemiesList` and `triggerExplosion` splices out
  of it. The beat between the body landing and the charge going off is also the tell —
  the same reason the car chain in `triggerExplosion` staggers itself.
- **A melee kill throws the body first.** `ROBOT_MELEE_KB = 100` — 5 m, taking a parked
  car (90 units, ~4.5 m) as the scale — stepped through `checkCol` so a wall stops it.
  The blast is then raised with `sourceIsPlayer = true`, so it damages whatever the
  machine was knocked *into*; and because the throw is longer than `ROBOT_BLAST_R = 110`,
  it clears whoever swung. Shorten the knockback or widen the radius and the player
  starts killing themselves on their own melee finishers.
- **The hit markers matter as much as the death.** A robot that *survives* a hit used to
  spray blood from five separate hit-marker branches. They all fork on `ROBOT` now and
  throw `FLECK` in `SPARK_COL`.

The `Corpse` constructor coerces any `CORPSE_GIB_DEATHS` value to 0 for `eT === "ROBOT"`.
That is belt-and-braces on the six branches: a seventh death site added later cannot gib
a machine even if it asks to. `tools/check-robot.js` walks all six paths and asserts no
meat, an un-gibbed chassis, one armed charge, and — for melee — the throw distance, its
direction, and that the blast clears the player.

---

## Working rules for this repo

1. **Read the surrounding comments first.** This file documents its own performance
   history in prose. Almost every non-obvious construct has a comment explaining the
   frame rate or visual artefact that motivated it. Do not "clean up" against those.
2. **Match the local idiom.** Terse one-line dispatch branches in `drawBuildings()`,
   long explanatory block comments above systems. Follow whichever is local.
3. **Bake if it doesn't move.** Static art goes in `decorBake` / `bakeBiomeDetail`.
   Live drawing is reserved for animation or for shapes that can't survive 3.125
   units/texel.
4. **Cull before you draw.** `inView(x, y, pad)` on anything per-entity; clamp loops to
   the visible span on anything long (see the `isGiantBarrier` segment loop).
5. **Determinism.** Chunk content is a pure function of `(biome, cx, cy)`. No frame
   count, no player state, no cross-chunk ordering.
6. **Seams.** Anything crossing a chunk boundary must be a function of column and world
   y only.
7. **Shadow everything.** A new prop without a contact shadow or a
   `drawBuildingShadows()` branch will look pasted on.
8. **Palettes at midday.** Night is subtractive.
9. **Never place blind.** Use the lattice, `solidsClearAt`, `nearAnchor`, and let
   `hitsAuthored` have the last word.

## Verifying changes

There is no test harness. Verification is visual: load `game.js` in a p5 page and walk
the world. Useful debug affordances already present:

- Numbered level shortcuts launch story mode (`levelSelectStory`, `pendingDebugStory`).
- `seedDebugStoryProgress(level)` fast-forwards story flags.
- `chunkMgr.stats` tracks `loaded / baked / evicted / forced`.
- `drawClimateReadout()` shows the world clock and weather state.

When changing chunk generation, check the **seams** specifically: walk across a chunk
boundary in both axes, and walk out of an authored core into the streamed world.

### Headless checks

`tools/` runs the parts of the world that are pure arithmetic without a canvas. It is not
a substitute for looking at the game — nothing there can tell you whether a river reads
as water — but it catches the class of bug that is invisible until you are standing on it.

```
node tools/check-generation.js     # determinism, seams, crossings, overlaps, bakes
node tools/check-render.js         # live draw path at four times of day, hybrid core
node tools/check-population.js     # the Sector 1/2 story roster and what it converts to
node tools/check-saveload.js       # save/load round trip
node tools/check-cutscene.js       # scripted placement stays inside the sector
node tools/check-resources.js      # harvestables, drops, the melee tool, persistence
node tools/check-robot.js          # a machine dies like a machine, on all six paths
node tools/check-character.js      # the arm rig: hands present, and behind the body
node tools/check-build.js          # blueprints, placement, build rate, the crew
node tools/check-ballistics.js     # hostile rounds are always slower than the player's
node tools/check-menu.js           # travel lives in the pause menu, and nowhere else
node tools/check-pathing.js        # walkers turn round obstacles; the collision index
node tools/check-corpse.js         # the settle: variation, impact direction, and it freezes
node tools/check-depth.js          # depth order, and how a mass projects
node tools/check-lighting.js       # the deferred rig: uniforms resolve, nothing allocates per frame
GAME_JS=/path/to/other.js node tools/check-generation.js    # compare against a baseline
```

**`check-lighting.js` cannot compile the GLSL** — the harness has no GPU, and the rig
detects the stubbed `getContext()` and stands down, which is the first thing that file
asserts. What it *can* catch is the class of bug that is otherwise silent:
`gl.getUniformLocation` returns null for a name the shader does not declare and
`gl.uniform*(null, v)` is a **no-op**, so a mistyped uniform does not throw, does not
warn and does not draw wrong — the term just stays at zero. It cross-checks every
uniform the JS writes against every uniform the seven shaders declare, in both
directions, and additionally asserts that nothing allocates a GPU object inside
`glRigFrame()`. Anything about how the rig actually *looks* needs a browser.

`check-population.js` overrides the harness's `random()` with a seeded generator, because
`legacyStartAtLevel()` runs against p5's global RNG rather than the chunk hashes — the
constant stub is fine for world generation and useless for a spawn ladder.

`tools/harness.js` loads `game.js` into a `vm` context with p5's global-mode API stubbed
and a deterministic stand-in for `noise()`. Because the file's top-level `const`/`let`
land in the context's global lexical scope rather than on the context object, reach them
with the exported `probe('expression')` rather than by property access.

What is asserted: chunks regenerate bit-for-bit; roads and rivers meet at seams and stay
inside their own row; a solved crossing lands on both curves and inside its chunk; the
gap left for a deck actually clears it; no two solids in a chunk intersect; every chunk
bakes without throwing; every clutter type has art; every emitted `propType` has a branch
in `drawBiomeProps` or `drawBiomeDecks`; and water collision never survives where the
core taper has closed the channel.

`tools/harness.js` stands in for `noise()` with **four octaves at halving amplitude**,
because p5's is octave-summed and therefore bell-shaped around 0.5 where a single lattice
is close to uniform. Every threshold in the world generation is a percentile of that
distribution, so a flat stand-in reports region coverage and feature frequencies the real
game never produces. Do not tune a threshold against a flat-noise measurement.

## Files

- `game.js` — the entire game. Uploaded as `game_1_14_26.js` (2026-01-14 snapshot).
- `CLAUDE.md` — this file.
- `tools/` — optional headless checks. Not loaded by the game, not part of the
  OpenProcessing upload.
