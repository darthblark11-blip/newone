# Level 1 city districts

Stick City's streamed neighbourhoods have twenty-three deterministic block plans.
All expansion remains beyond the starting-gate enclosure and curtain walls. The
opening area's existing ten identities and all 235 ordinary building footprints
and architectures remain unchanged.

| Plan | Buildings and open space |
| --- | --- |
| Brownstone mews | Copper/terracotta roofs, dormers and a central carriage lane. |
| Office campus | Offset glass atria, service cores and broad cross routes. |
| Courtyard housing | Four separated residential wings around lawn and stone paths. |
| Market streets | Small pitched shops, striped produce stalls and pedestrian lanes. |
| Workshop yards | Sawtooth roofs, north-light glazing and loading lanes. |
| Garden apartments | Staggered planted terraces, pergolas and asymmetric passages. |
| Transit exchange | Ribbed station halls, amber fascia, bus shelter and paved public court. |
| Civic library | Stepped limestone roofs, bronze-framed skylights, reading wings and benches. |
| Conservatory | Planted glasshouses with visible beds, glazing ribs and garden walks. |
| Municipal depot | Solar-panel roofs, vents, loading shutters and marked service bays. |
| Exterior medical campus | White/teal clinic wings, raised equipment podiums and glazed lightwells. |
| Exterior Art Deco hotel | Stepped stone/copper roof crowns and a public arrival court. |
| Exterior freight terminal | Pitched corrugated sheds, ventilators and solid shipping containers. |
| Exterior recreation club | Timber/glass pavilions, an open sports court and upright basketball hoops. |
| Downtown business towers | Six-storey glass facades, connected setbacks and metal plant crowns. |
| Downtown retail arcades | Shopfront glazing, projecting canopies, office wings and raised clerestories. |
| Downtown terraced parks | Planted lawns, live trees, benches, a pavilion, stone steps and side ramps. |
| Restaurant terraces | Glazed dining rooms, kitchen stacks, striped awnings and recessed outdoor tables. |
| Neighbourhood bars | Brick pubs, raised bar signs, timber trim and courtyard seating. |
| Gentlemen’s clubs | Burgundy/black lounge fronts, projecting marquees and a formal arrival court. |
| Tennis clubs | A low clubhouse, blue/green marked courts, upright nets and gated mesh fencing. |
| Fitness gyms | Broad glazed training halls, metal roof lights and open entrance forecourts. |
| Boxing gyms | Brick training halls, raised boxing signage and a clear door approach reserved for a later interior. |

## Downtown and hills

Exit the south Great Gate and continue toward the canal. Downtown occupies
chunk columns -3..2 and rows 5..9 (world x -3600..3600, y 6000..12000). The
existing canal in row 6 remains continuous with its bridge crossings. Eight
business blocks, seven arcade blocks and nine parks form a connected district
around that waterfront. Other city districts continue beyond it.

The business quarter rises on a smooth ridge after the canal, then descends
through the southern parks toward the lower city. The shared positive ground
height reaches about 80 units; park terraces add up to 28. Height and first
slope remain continuous across chunk borders and at the outer hill envelope.
The starting enclosure, gate approaches, canal water and relay fortress remain
at their previous heights. Other biomes retain their existing elevation.

Native character movement uses this field for uphill slowdown and downhill
pace; figure scale also follows ground height. Trees have small visible-stem
colliders, and cardinal park paths remain clear. Park stairs, retaining faces
and ramp lips are projected from the same local height profile used underfoot.
Business towers rise 52–64 units with six facade storeys; other district masses
retain their existing height limits.

Slope tone is baked once into the existing terrain textures with a fixed sun
and world-aligned samples. The advanced lighting height buffer uses a bounded,
continuous mesh of the same hill field (at most 1,080 triangles), culled entirely
outside the relief area. Lamps, decks, water, canopies and civic terraces use
the same ground base; civic emitters avoid adding their base twice.

## Dining, nightlife and sports

Twelve destination blocks flank downtown. Restaurants, bars and gentlemen’s
clubs run along row 5 at columns -6..-4 and 3..5. Tennis clubs, fitness gyms and
boxing gyms follow the park edges at columns -4 and 3, rows 7, 8 and 9. Each
venue has a different name on each side of town. Both branches remain outside
the starting walls and clear of the relay fortress and its approaches.

The six building families have distinct projected facades, connected canopies,
roof equipment and raised signs. Restaurant and bar tables have visible
pedestals, cups and four grounded chairs within their collision footprint.
Freestanding menu and venue boards have thick raised faces and grounded feet.
The central pedestrian approach stays open through the venue forecourts.

Tennis courts have actual ground-painted singles/doubles lines, service boxes,
a sagging raised net and mesh fences with corner posts. Both side gates have
120-unit openings, and players can walk around the net ends. The whole court
is reserved from later obstacle scatter; only the intended net and perimeter
fences occupy that area. Nets and fences project every point at its actual
height and retain thin, visible ground collision footprints.

Primary venue buildings expose a deterministic `cityEntrance` position and
courtyard-facing normal. Boxing gyms additionally identify the future
`BOXING_GYM` interior and mark it pending. Their facade door and open approach
are built now; entering the building and its interior scene are deferred.

Industrial blocks select workshop, garden-apartment, depot or freight plans alongside
existing parking lots. A shared address selector keeps industrial parking and
depot ground treatments aligned with their buildings. Parks, canal quays,
construction sites and civic terraces retain their specialized layouts.
The protagonist's house block, five original
entertainment landmarks, Great Gates, curtain walls and two story transmission
towers retain their original positions and footprints.

District-specific street furniture includes produce stalls, wayfinding plaques,
planters, postboxes and benches. The exterior freight containers have projected
walls, door hardware, roof ribs and corner castings. Recreation hoops project
their post, thick backboard, rim and hanging net at individual heights; their
18-by-18 collision footprint matches the visible ground footplate. The painted
playing field is reserved from all later obstacle scatter. New exterior plans
also omit the older generic wreck prop.

Bicycle racks have grounded tyre contacts and independent-height wheels,
frames, saddles, handlebars and upright supports, all using the shared camera
projection. Their 74-by-28 base stays fixed as the camera moves; their lean is
bounded for a small object. Racks are placed only in recessed exterior court
space, inside the usable block and clear of both central pedestrian strips.
They are omitted where no such space exists, including recreation courts and
the starting enclosure. Bikes no longer occupy pavements or carriageways.

Mirrored addresses and material tones vary deterministically. Facade windows
follow the actual ground-to-roof quadrilateral. Rooftop equipment, stepped hotel
crowns, freight gables and pavilion ridges have their own projected height and
connected faces. Rooftop additions remain visual masses.

Court paths, service bays, paving joints, storm drains, utility covers, asphalt
repairs and kerb litter are baked once into chunk terrain. The paths use the
same district selection and mirroring as the buildings, including inside the
authored opening area. Paved rectangles also register their shovel surface
metadata. Selected windows warm after dusk; existing lamps continue to provide
night illumination. The new streets do not add a per-frame ground-detail pass.

## Persistence and scope

The twelve new destination land blocks use `leisure:v1:` keys. Junctions
touching them remain open. Only neighboring chunks whose checkpoint is newly
removed use `leisure-edge:v1:`; existing downtown checkpoint suppression and
keys take precedence. Old destruction indices cannot remove a new venue prop.

Only the 24 downtown land blocks use `downtown:v1:` keys, including their
street furniture and park stems. Checkpoint junctions touching downtown stay
open; only edge chunks whose former checkpoint is removed use
`downtown-edge:v1:` keys. Old grid, civic and `district:v3:` indices
cannot erase unrelated downtown replacements. Current destruction persists on
its intended object; unchanged districts keep their prior keys. Canal geometry
and bridge crossings stay continuous.

Existing streamed districts retain the `district:v3:` destruction-key namespace for
an entire block, including furniture and industrial parking replacements. Old
numeric-grid, `district:` and `district:v2:` indexes cannot erase unrelated
replacement structures. Destruction from those previous
layouts does not map onto replacement buildings. Current destruction still
removes only its intended solid and survives revisiting. Civic and untouched
block keys retain their previous behavior.

Collision and depth sorting continue to use ground footprints. Courtyards and
lanes remain navigable, rooftop details add no accessible interiors, and the
existing civic terraces retain their local elevation above the shared city
ground. No combat values or objectives change.

## Validation

`node tools/check-city-districts.js` checks 1,000 deterministic chunks, twenty-three
streamed plans and twenty-two roof families, ten unchanged authored identities and a frozen
signature of all 235 starting buildings. It also checks exclusion of the new
plans from the protected enclosure, clear 24-unit pedestrian crossings,
recessed bicycle placement, empty playing fields with two footplate-sized hoop
bases, old/current destruction-key isolation, 92 mirrored ground bakes with
paint/metadata parity, and 276 time/weather/view renders with finite drawing
coordinates.

`node tools/check-city-downtown.js` checks native downtown generation, protected
areas and old-city persistence, clear cardinal routes through parks, continuous
hill/park heights, native uphill/downhill travel, lighting-height parity, a
bounded visible mesh and open shared junctions.
`node tools/check-city-venues.js` checks the twelve real destination blocks,
entrance approaches, court gates and net-end travel, collision footprints,
fortress clearance, destruction-key isolation and finite native rendering.
See the test output for current assertion counts.

Render individual streamed plans with real p5/Chromium:

```sh
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=14
VIS_DEPS=/path/to/deps VIS_CHROME=/path/to/chrome VW_W=1100 VW_H=1000 node tools/visual-world.js 1 0 0 0.85 district=16 night rain
```

Generation, city placement, shovel terrain, projection/depth, rendering and
real-browser frame/control checks pass. Exterior day/night/rain and phone
captures were inspected with native terrain, shadows and depth sorting.
The civic-terrace check currently fails its other-biome elevation assertion on
both this version and the preceding commit; its Level 1 assertions pass before
that failure. No manual combat playthrough or physical-phone performance
measurement was performed. The software-browser frame check exercised the
existing light-rig frame-budget fallback while keeping controls responsive.
