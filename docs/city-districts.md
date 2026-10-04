# Level 1 city districts

The streamed residential and commercial city now selects six deterministic block plans: brownstone mews, offset office campus, open courtyard housing, market streets, workshop yards, and garden apartments. Industrial blocks select workshops or garden apartments alongside the existing parking lots. Parks, canal quays, construction sites, civic terraces and the authored story core retain their specialized layouts.

Buildings have six corresponding roof families: terracotta/copper pitches and dormers; glass atria; residential terraces; pitched shops; sawtooth workshop roofs; and planted apartments. Visible facade windows interpolate along the actual ground-to-roof quadrilateral. Chimneys, stair cores and planter beds use independent short mass projections with contact shadows. Mirrored block addresses and material tones vary deterministically.

Court paths and market lanes are baked into the ground; roofs and facade geometry remain live at screen resolution. Bus shelters stand on four projected posts instead of a solid rectangular skirt. Glazing reflections, thick roof edges, kiosk awning fascia and roof rain darkening retain the existing cel-shaded palette. Selected facade windows warm after dusk; existing lamps continue to provide night illumination.

## Persistence and scope

Changed districts use a `district:` destruction-key namespace for the entire block. Old grid destruction indexes cannot erase unrelated replacement buildings or street fixtures. This means old destroyed buildings in replaced districts do not map onto their replacements. Civic and untouched block keys retain their previous behavior.

Building collision and depth sorting use ground footprints. Courtyards and lanes remain navigable; rooftop details are visual masses, not accessible interiors. Existing civic terrace elevation is preserved. This update adds procedural variety outside the authored story core.

## Validation

Run `node tools/check-city-districts.js` for 1,000 deterministic generated chunks, six plan/style coverage, footprint bounds, overlap checks, cross routes, destruction persistence, finite foliage geometry, exposed facade placement, and 72 time/weather/view combinations.

Render individual plans with real p5/Chromium:

```
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=2
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=5 night rain
```

Representative previews are in `docs/previews/city-*.png`. The existing generation, render, depth, lighting, save/load, civic-terrain and real-browser frame checks also pass. No manual combat playthrough or mobile performance measurement was performed; the software browser's light rig exercised its existing frame-budget fallback.
