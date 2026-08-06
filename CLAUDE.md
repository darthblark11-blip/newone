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
player.show() / updateEntities()      ← the player and every character
drawBuildingShadows()      → drawBiomeShadows() in biomes
drawBuildings()
drawBiomeProps()           (BIOME_ACTIVE only)
drawParkingCars()
projectiles / particles / orbs / shockwaves
drawNightLights() + weather.drawWorld()   (BIOME_ACTIVE only)
drawLightPass() + drawBiomeScreenLayer()  (BIOME_ACTIVE only)
drawUI() / drawBiomeHud() / updateExtraction()
```

**The characters are drawn in the middle of this list, not at the end.**
`drawBuildings()` and `drawBiomeProps()` run *after* them on purpose: a roof has to
occlude anyone standing inside its footprint, which is what tells you they are behind
it. That makes the ordering question for any new art "is this a mass or a surface?":

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

**Footprints are authored at 1× and multiplied by `BUILD_SCALE` (9).** At the 20 units
to the metre a parked car sets, that puts them at real sizes — the warehouse is 104×68 m,
the range's lanes are a hundred metres. `BUILD_SCALE` is the only number to touch to
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
  still refuse the site. Measured after: woodland 3–11%, Dry Gulch 23–40%, jungle ~50%,
  tundra ~60%. The woodland is low because it is genuinely threaded with water — you
  cannot put a hundred-metre warehouse across a river, and the outline says so.
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

`republishPlayerStructures()` is the one way structures reach the world — called on
placement, on completion, on level entry (last in `startAtLevel`, after everything that
regenerates `buildings[]`) and on load. It also rebuilds the `site` back-pointer that
`drawBuildSite()` reads progress from; that pointer is a cycle and is deliberately not
saved.

**The crew.** A `Citizen` with `role === "ARCHITECTURE"` takes a build site over its
wander timer entirely: `nearestBuildSite()` within 1100 units, `buildSlotFor()` gives it
its own patch of the perimeter from a `slotSeed` fixed at birth (so twenty architects ring
the job instead of piling onto its centre), and it stands there swinging. Top-down a hammer
swing has no rise to show, so it reads as **reach** — the arm drives forward and the head
rolls over the wrist on the down-stroke. States `TO_SITE` and `BUILDING` both count as
moving for the walk cycle; only `BUILDING` suppresses the normal front hand.

**No material cost.** Not asked for, and deliberately not invented — but `confirmBuildPlacement()`
is the single funnel if you want `window.resources` to be the gate.

`node tools/check-build.js` covers the ghost refusing bad ground, the exact rate at
several crew sizes and architecture levels, a site advancing while the player is in
another level, the barn's field being walkable while the barn is not, survival across
`rebuildWorldArrays()` and across a save/load, the crew finding and ringing the job, and
that all four kinds plus both site states draw through both shadow passes.

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
GAME_JS=/path/to/other.js node tools/check-generation.js    # compare against a baseline
```

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
