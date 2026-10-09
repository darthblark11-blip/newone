# Level 2: Pacific Northwest forest overhaul

Phase 1 (prop conversion) and Phase 2 (clustered generation) are implemented in
`game.js`. Wildlife, foliage reactions, fishing, hunting, crops and new atmospheric
passes are the next stages described below; they are not enabled by this change.
The Undercity's authored story streets, curtain wall, fortresses and story beats
remain the sector's core. This art pipeline applies to the **forest overworld**.

The corrective art pass follows the established city projection: fixed world
geometry, anchored ground contact and raised faces that translate with the
camera. Trees never turn their silhouettes toward the camera's lean vector.
Ground materials and forest props are authored specifically for this pass.

## 1. Architectural overview and data structures

The game uses p5 Canvas 2D with a deferred WebGL lighting rig, not a polygon-mesh
engine. Pseudo-3D is built from layered vector faces projected by the existing
`massLean()` camera model. Ground contact remains fixed while elevated layers
shift with the camera; light direction controls shading independently.

`FOREST_PROPS` defines each species' visible dimensions, rise, ink width, tier and
collision specification. `FOREST_REGIONS` supplies habitat names, density weights
and midday color ramps. A generated tree record carries:

```js
{
  t: "PINE", x: worldX, y: worldY, s: girth, r: seededAngle, c: seededVariant,
  forestSpecies: "DOUGLAS_FIR",
  forestRegion: "TIMBER",       // Ancient Canopy
  forestTier: "canopy",         // or midstory
  forestTrunkKey: "cx,cy,forest:slot",
  forestCrownScale: 1           // narrows older roadside crowns when necessary
}
```

Coordinates are always the **root on the ground**. Standing trees remain
`TREE`, `PINE` or `SNAG`, so depth sorting, tools, collision and wood harvesting
use the existing lifecycle. The collision trunk is separate from the large
visible crown: established/mature stems use 34×34, new midstory stems use 24×24,
and bushes/ground plants add no collider. `forestCanopyMass()`, `forestPropRadius()` and
`forestPropCullPad()` share dimensions between art, placement, visibility and
the lighting height field. Renderers do not change generation metadata.

### Prop audit and conversion

| Existing prop | Conversion | Collision / anchor |
| --- | --- | --- |
| `TREE`, `PINE` | Douglas fir, western redcedar, Sitka spruce, red alder and lodgepole pine; fixed asymmetric branch masses, connected canopy sides and rooted bark | Fixed root; established 34×34 trunks and harvest girth retained |
| `SNAG` | Bent charred trunks with broken limbs and warm exposed timber | Root; existing tree lifecycle |
| `BOULDER` | Fractured granite with strong side/top facets, lichen and moss | Existing solid AABB; no rotated collision mismatch |
| `WEED` / bush | Layered salal-like shrub clumps | Ground anchored; decorative, no army obstruction |
| `FERN`, `REED`, `GRASS` | Bowed sword-fern fronds, curved wetland stems and grouped grass blades | Ground anchored; static terrain bake |
| `LOG`, `STUMP` | Bark sides, exposed end grain, moss crowns, root flares | Small decorative pieces baked; existing large deadfall/wood piles retain solids |
| `MUSHROOM`, `PEBBLE`, `ASH` | Raised caps, faceted chips and graphic char debris | Baked ground detail |

The four primary habitats are world-space clusters, not one roll per chunk:

| Habitat | Structure | Palette |
| --- | --- | --- |
| Ancient Canopy (`TIMBER`) | Douglas fir / cedar canopy, young conifers, bushes, sword ferns and mushrooms | Emerald / warm needle litter / teal shade / ochre bark |
| Mossy Riverbed (`MARSH`) | Spruce / alder, lush ferns, reeds, mossy logs; follows real streams and wetland pools | Jade / turquoise shallows / mineral banks / sage |
| Burnt / Dead (`BURN`) | Broken char snags, exposed ground, sparse regrowth | Charcoal / warm ash / ochre / muted regrowth |
| Alpine Ridge (`HEATH`) | Slender lodgepole pines, granite, sparse low plants | Granite grey / silver / sage / pale gold |

**Save compatibility:** `woodLegacyRegion()` retains the historical six-region
placement template and random stream. Existing solids keep their numeric
`cx,cy,idx` destruction keys. `woodRegion()` is the new four-habitat art/ecology
query. New forest placements use a separate deterministic random stream and
namespaced keys, so adding underbrush cannot change a saved building or tree's
identity. Existing worked clearings, settlements, pools, crossings and logging
destinations stay functional within the four forest habitats.

The woodland base uses a dedicated soil/moss material lattice. Small torn
material beds and needle clusters live on an independent 420-unit world grid;
every overlapping texture paints the same features in world order. Riverbanks
and stones likewise use world-space samples. All ground work happens during
baking, without changing saved solids or adding actor updates.
Baked small props reserve their complete silhouette inside the owner texture,
so enlarged shrubs and logs cannot be cut off at a chunk edge.

Army roads, river volumes, crossings, fortresses, authored solids and travel
aprons take precedence over vegetation. Newly placed crowns reserve their full
horizontal reach, while collision uses their trunk. Existing roadside trees can
narrow their crown without moving the saved root. Dense undergrowth stays out of
the actor list and collision index. Removal reconciles both the resident chunk
and regenerated crowns, so felled trees do not reappear.

## 2. Shader and art guidelines

### Cel shading

Use three opaque value bands rather than smooth gradients:

```text
d = clamp(dot(faceNormal, -sunDirection), 0, 1)
band(d) = shadow if d < 0.28
          base   if d < 0.72
          light  otherwise
```

This describes the artistic ramp; the Canvas implementation paints silhouette,
base face and sun-facing highlight as separate polygons. Teal/umber recesses
retain color rather than multiplying every surface down to black. Small
highlights use sage, cream or warm timber. They mark edges, not the entire
canopy. Each habitat palette is authored at midday; the existing day/night pass
then darkens it normally.

### Geometry and ink

- Evergreen foliage uses irregular branch masses with unequal placement and
  height; the outline belongs to a continuous canopy volume.
- Trunks taper and bend; roots flare at the actual collision anchor.
- Rocks connect a ground rim to a lifted top through shaded planes. Visible solids keep their
  existing footprint, so the outline does not promise walkable ground inside a
  rock.
- Thick exterior ink and lighter interior facet boundaries establish scale.
  Fine bark hatches and mushroom marks are deliberately sparse. Baked marks
  must span roughly 3–6 world units to survive the 384px / 1200-unit chunk bake.
- Crown geometry stays fixed in world axes. Branch masses use partial
  `massLean()` at increasing heights; ground-contact
  depth sorting still uses the root. Canopy height/material stamps use the same
  species dimensions. Visibility bounds include the projected crown.
- Tree rise is proportioned to the game's city projection (28–36 units before
  girth scaling), avoiding long exposed stems and excessive edge displacement.
- Contact shadows start on the ground before the canopy is translated. The
  fallback sun pass fades them normally; the advanced rig owns canopy shadows
  when enabled. Never paint two sun shadows for one tree.

No shader compilation or lighting-quality tier is added by Phases 1–2. The
existing shadow and normal/material passes receive larger species-specific
canopy dimensions. Small plants are drawn once into chunk albedo. The current
automatic lighting reduction and optimized combat paths remain in use.

For verified p5 1.9.4 and 1.11.11 Canvas renderers, closed forest polygons use a
cached native path emitter instead of allocating p5 vertex records. The
closing edges, fill and stroke calls are pixel-identical to p5. Fixed crown and
bough coordinates and closed `Path2D` objects use weak caches, so retiring a
chunk releases its plans. Side colors share a species/sun ramp; verified RGB
renderers use the existing native quad and fill cache, plus scoped Canvas
styles for boughs and vein lines. Other color modes retain p5 color handling.
Unsupported versions/renderers, clipping and accessible output retain the
normal p5 path. Cross-source RGBA comparisons check that these optimizations
preserve the reviewed artwork.

## 3. Step-by-step execution plan

1. **Phase 1 — implemented:** inventory the old props; add shared species profiles;
   replace forest-only prop art with bold layered PNW forms; align collision,
   harvest anchors, depth sorting and lighting silhouettes.
2. **Phase 2 — implemented:** establish four continuous habitat queries; enrich
   the compatible legacy layout; append bounded deterministic midstory and
   underbrush clusters; clear roads, crossings, fortresses and arrival aprons.
3. **Validate the foundation:** regenerate chunks in different orders, compare
   historical destruction keys and unaffected sectors, check harvesting across
   chunk reload, inspect daytime/nighttime habitat renders, and measure warmed
   forest frames and sustained battles in real Chromium.
4. **Phase 3 — next:** add a separate bounded wildlife manager. Begin with deer
   and Roosevelt elk; then black bears, gray wolves, ravens and bald eagles.
   Introduce foliage displacement only around nearby actors, using a spatial
   interaction field and a small active-object budget. Baked foliage needs a
   targeted live overlay to react; it should not all become animated.
5. **Phase 4 — next:** extend the existing clock and weather inputs with canopy
   light masks, restrained sunrise shafts, golden-hour warmth, purple twilight,
   moonlight silhouettes, low ground fog and pooled pollen/spores. Wetness should
   reuse the rig's current material gloss channel for rocks/leaves. Preserve
   its automatic quality reductions; do not add full-screen effects per tree.
6. **Calmer activities — later:** attach fishing to actual river/pool habitat
   points, hunting to wildlife records and crops to player-owned clearings.
   These use the same habitat query without becoming conditions of chunk
   generation. Harvesting and ownership remain explicit saved state.

PNW species selection is region-specific: western redcedar, Douglas fir and
Sitka spruce suit coastal temperate rainforest; lodgepole pine belongs on
drier/high ridges. Roosevelt elk, black bears and native deer are the starting
mammals. Bald eagles favor water; ravens cover all habitats. Redwoods are not a
default Washington/Idaho/BC species in this pipeline.

## 4. Code and technical logic

### Procedural placement

Production functions are `woodRegion()`, `appendWoodlandForest()` and the shared
profile helpers in `game.js`. `bakeSharedWoodlandPatches()` handles continuous
ground shading across chunk edges. The placement structure is:

```js
// Independent seed: forest additions cannot consume the legacy layout RNG.
const forestRng = makeRng(chunkHash(biome, cx, cy, forestSalt));
for (const candidate of boundedClusterCandidates(forestRng)) {
  const habitat = woodRegion(biome, candidate.x, candidate.y);
  const prop = chooseSpeciesAndTier(habitat, candidate);
  const reach = forestPropRadius(prop);
  if (groundReserved(biome, cx, cy, prop.x, prop.y, reach * 2, reach * 2, pad)) continue;
  if (nearTravelOrFortress(prop) || hitsAuthored(prop.x, prop.y, reach * 2, reach * 2, pad)) continue;
  if (!solidsClearAt(solids, prop.x, prop.y, trunkWidth, trunkDepth, armyClearance)) continue;
  // Root/crown share one stable identity; small foliage has no solid.
  placeTrunkAndStandingCrownOrBakeSmallProp(prop);
}
```

The pseudocode summarizes actual generation gates; the named candidate/species
helpers above describe the stages and are not additional runtime APIs.

### Wildlife data contract (Phase 3 design, not active gameplay)

```js
// Keep wildlife separate from military rosters, ambush totals and commands.
const animal = {
  id: "biome:chunk:species:slot", species: "ROOSEVELT_ELK",
  x: 0, y: 0, homeX: 0, homeY: 0,
  state: "GRAZE", stateUntil: 0, threatX: 0, threatY: 0,
  temperament: "FLIGHT", herdId: 0, habitat: "TIMBER", hp: 100
};
```

Spawn off screen into a compatible habitat with a bounded per-region/per-herd
population. Use existing local collision queries and sample decisions at a
staggered 5–10Hz while nearby movement interpolates each frame. Persist removals
and meaningful interactions, not a constantly expanding record of every visual
animal. Never scan every projectile for every animal: publish nearby combat
events through the existing spatial buckets.

```js
// Future state machine; thresholds come from species profiles.
switch (animal.state) {
  case "GRAZE":
    if (nearbyShot || nearbyThreat) enter("ALARM", shortAlarmDelay);
    else wanderWithinHomeHabitat();
    break;
  case "ALARM":
    signalNearbyHerdOnce();
    if (corneredOrWounded && territorialSpecies) enter("DEFEND");
    else if (alarmElapsed) enter("FLEE");
    break;
  case "FLEE":
    steerAwayFromThreatTowardClearHabitat();
    if (safeForSeveralSeconds) enter("RECOVER");
    break;
  case "DEFEND":
    defendOnlyWithinTerritoryAndDisengageAtBoundary();
    if (threatGone) enter("RECOVER");
    break;
  case "RECOVER":
    if (newThreat) enter("ALARM");
    else if (calmElapsed) enter("GRAZE");
    break;
}
```

Deer/elk primarily flee. Black bear/wolf defensive aggression requires a
concrete threat, injury or being cornered; combat noise alone should not turn
every animal into another hostile army. Ravens/eagles lift off and relocate
without entering the ground collision or military targeting systems.

### Verification

The foundation has dedicated generation, rendering and harvesting checks:

```bash
node --check game.js
node tools/check-forest-generation.js
node tools/check-forest-render.js
node tools/check-forest-lifecycle.js
node tools/check-forest-camera.js
node tools/check-generation.js
node tools/check-lighting.js
node tools/check-depth.js
```

`tools/check-forest-seams.js` compares neighboring material beds and river/ford
detail to a continuous real Canvas reference, including closed-channel taper. Set
`VIS_DEPS`, `VIS_CHROME` and optionally `VIS_P5` to your external Playwright,
Chromium and p5 locations; no browser package is added to the game repository.
`tools/check-forest-polygons.js` verifies exact RGBA equality between the native
emitter and p5 across species, targets, zooms, camera/sun angles and shadow
owners, plus renderer/version/accessibility fallback behavior.
`tools/check-forest-art-parity.js` accepts `FOREST_REFERENCE_JS` and compares
the current painter with a reviewed source, including cold/warm caches,
same-object geometry edits, alternate color modes and missing `Path2D`.
`tools/check-forest-camera.js` compares actual layer-local crown vertices across
camera positions while checking continuous height translation. The previous
camera-oriented tree painter fails this regression. `tools/visual-forest-pan.js`
captures the real p5 world with a player for scale and saves a video, frame
viewer and exact source snapshot outside the checkout.

Browser review includes dense canopy, all four habitats, river crossings,
night and rainy golden-hour scenes. Paired sustained battles exercise both
lighting modes. Cloud software-renderer measurements cannot establish a
device's 60 FPS; the denser canopy has a rendering cost, and the existing
automatic lighting reduction remains essential.
