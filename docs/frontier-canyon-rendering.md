# Frontier canyon rendering

`FRONTIER_CANYON_STYLE` contains the Level 3 material and raised-timber parameters.
The existing `frontierCanyonProfile`, `frontierCanyonSample`,
`frontierCanyonHeight` and `frontierCanyonBlocksMove` remain the authority for
elevation and passability. Crossing positions, floor heights, slope rejection,
and the 152-unit flat bridge corridor are unchanged.

```js
{
  floor: [157, 111, 75],
  toe: [39, 33, 30],
  rim: [250, 207, 143],
  railOffset: 90,
  railRise: 22,
  postRise: 27,
  railSlice: 72.5
}
```

The terrain bake retains all ground decking, timber grain, edge stringers,
and sandstone detail. Darker lower beds, alternating shelves, an undercut,
two separated rim tiers, and toe shade give the wall a readable height hierarchy.
The same ramp ease suppresses cliff treatment at real walking routes.

`frontierCanyonRails()` returns deterministic render-only records for the
current view's chunk window. Its one cached array is replaced after travel;
no rail is added to the collision, cover, destruction or population arrays.
Vertical rails are split into short records so they interleave with actors.
The ground pass paints their sunlight shadows, the mass pass projects actual
two-height beams and capped posts, and `glRigFrontierCanyonRailsHeight` stamps
the same raised geometry into the lighting buffer.

The Level 3 lighting origin is -192, covering Redrock's deepest native height
below -160 without clipping. Other biome origins and their existing ranges
remain unchanged. Terrain texture dimensions, bake scheduling and lighting
target sizes are unchanged.

Focused validation:

```sh
node tools/check-frontier-raised-rails.js
node tools/check-frontier-lighting.js
node tools/check-frontier-canyons.js
node tools/check-frontier-canyon-expansion.js
node tools/check-frontier-canyon-materials.js
node tools/check-frontier-bridge-materials.js
node tools/check-frontier-occlusion.js
```

These checks cover every finite crossing, negative-coordinate regeneration,
cache replacement, art/height-mask finite geometry, passability and material
seams. Physical Galaxy S25 frame timing requires the device benchmark.
