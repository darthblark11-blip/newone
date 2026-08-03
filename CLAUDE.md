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

---

## The seven biomes

`BIOMES` table at ~13169. Each entry carries `sky`, a `pal` palette
(`base/alt/dark/accent/road/mark/walk/grass`), `weather`, `layout`, `climate`
(`clear`, `wet`, `rain` chance/hour, `cloud`, `dayF`, `nightF`), `fog` RGBA,
`clutterDensity`, and `lore`.

| # | Name | Layout | Weather | Character |
|---|---|---|---|---|
| 1 | Stick City | `CITY` | ACID_RAIN | Grid megablock, always authored core |
| 2 | The Undercity | `WOODLAND` | ACID_RAIN | Dark; `CITY_DENSE` inside the curtain wall, open country outside |
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
centre function down the chunk), `bakeStreet` (straight street with optional open ends).

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

`PEBBLE · TRASH · PAPER · PUDDLE · WEED · CRACK · TUMBLEWEED · BONE · SAGE · VINE · FERN · LOG · ICE · DRIFT · SPOREPOD · GLOWMOSS · SHARD · TREE`

`CLUTTER_ANIMATED` (~14467) decides baked vs live. A type goes in the live list only
if it animates (`TUMBLEWEED`, `SPOREPOD`, `GLOWMOSS`, `SHARD`) **or** it is too large
and too round to survive rasterising at 3.125 world units per texel (`TREE` — a 30-unit
canopy lobe is 9 texels and comes back as hard squares).

**Adding a clutter type = three edits:** a `case` in `paintClutter`, a return in
`pickClutterType`, and a `CLUTTER_ANIMATED` entry if it animates.

### 5. `drawBiomeProps()` — ~16675 and `drawBuildings()` — ~2004

`drawBiomeProps()` draws everything flagged `isBiomeProp` (anchors and set pieces):
`HELIPAD · CHECKPOINT · OUTPOST · BORDERWALL · GUARDBOX · BLASTWALL · SANDBAG ·
BOULDER · BUNKER · WRECK`.

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
drawBloodChunks()
updateCorpses()
drawBuildingShadows()      → drawBiomeShadows() in biomes
drawBiomeProps()           (BIOME_ACTIVE only)
updateEntities()
drawParkingCars()
drawBuildings()
projectiles / particles / orbs / shockwaves
drawNightLights() + weather.drawWorld()   (BIOME_ACTIVE only)
drawLightPass() + drawBiomeScreenLayer()  (BIOME_ACTIVE only)
drawUI() / drawBiomeHud() / updateExtraction()
```

Anything new must be inserted at the layer that matches its physical height, or it will
read as floating.

---

## Population and settlements

`resetPopulation`, `popRelease`, `popReleasable`, `popPlace`, `settlementRoster`,
`refreshPopulation` (~15553–15806). Settlements get a roster of citizens placed against
their chunk's solids; `Citizen` (~10751) is the wandering NPC class. `nearSettlement()`,
`maintainBanditPosse()`, `sweepForeignHostiles()`, `nativeToOverworld()` keep hostiles
and neutrals in the right places — a settlement whose story arc is still running is a
neutral scene, the country past it is not.

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

## Files

- `game.js` — the entire game. Uploaded as `game_1_14_26.js` (2026-01-14 snapshot).
- `CLAUDE.md` — this file.
