# Shovel and passive route

For debugging, the player starts with **SHOVEL** in inventory, available through
the existing melee cycle in the pause menu and on gamepad D-pad Up. It starts
unequipped. `SHOVEL_DEBUG_OWNED` controls this temporary inventory grant.

A separate shovel still appears at a pseudo-random grass location **inside
Stick City's Great Gates**. Walk over it to discover and equip it. The location
persists across saves, and collecting it does not duplicate the inventory entry
or respawn the ground item. Combat upgrades are not required. Its cel shaded
model has a wooden shaft, D-grip and a raised, ridged steel spade.

![The separate discoverable shovel remains on the ground](previews/shovel-ground-discovery.png)

The shovel has four actions:

| Action | Touch | Keyboard | Gamepad |
| --- | --- | --- | --- |
| Nonlethal swing | SWING | E | R1 or Y |
| Dig beneath your feet | DIG DOWN | C | L2 |
| Dig the adjacent square ahead | DIG AHEAD | F | R2 |
| Climb the shaft | CLIMB UP | V | B |

The movement stick/WASD moves normally. The right stick or mouse sets the
direction of a forward dig. While the shovel is equipped, aiming and digging
cannot fire a gun or release a suit's throwable. Hold a dig/climb control to
repeat the action; each action waits for the previous scoop and descent.
Controller players keep the compact tool/depth status without touch buttons.

A swing uses the existing nonlethal punch knockout and recovery. It does not
remove HP, harvest materials, charge a lethal finisher or create a shockwave.
Civilian falls remain separate from the saloon's boxing knockout physics.

## Excavation

Excavation works throughout the mapped outdoor levels, including existing
courtyard grass, dirt, streets and paths. Ground does not need a special grass
record or belong to a marked route. Actual building foundations block the whole
excavation square, at every depth. Furniture, landscaping, gates and boundary
walls do not count as building foundations. The added home and gate lawns
remain as optional discovery and entry points.

![Existing west-side courtyard grass accepts digging](previews/shovel-west-courtyard.png)

The first downward scoop makes a waist-deep square. Further scoops deepen the
shaft, lowering and shrinking the player smoothly. At full underground depth,
the renderer shows the earth's strata and a local cutaway with ceiling hatching.
The surrounding surface and any gate remain above the player. Very deep shafts
eventually reduce the figure to a pin-sized silhouette; depth is capped at 4096
world units to keep numeric behavior bounded.

At ground level, a forward scoop opens only one adjacent waist-deep square.
Repeated digging from outside cannot deepen it: enter the hole first. Below
ground, forward digging opens adjacent earth at the player's current height
and retains the roof above it, allowing player-chosen tunnels beneath paved
surfaces, gates and boundary walls. Walls still block waist-deep movement:
dig fully underground before passing underneath. Movement checks the whole
player footprint and intervening excavated space, so unmined soil and
disconnected holes remain solid.

Climbing raises the player within the shaft without deleting its lower floor.
Emerging works on open ground, including paved ground; move beyond a solid
wall before climbing out. Building foundations remain protected underground.
Surface attacks cannot hit a fully underground player, and the shovel cannot
hit opponents on a different level.

## Passive route

Dig and walk your own fully underground passage out of Stick City's enclosure.
Any north/south Great Gate or east/west curtain wall can be crossed, and the
passage can start anywhere inside and turn freely. There is no prescribed
entry lawn, tunnel corridor or exit patch. Once the player clears the outer
wall, **PASSIVE ROUTE** unlocks the pause menu's overworld and normal southward
travel. The unmapped Sector 09 remains unavailable.

This check leaves gate health, transmission towers, enemy forces and population
rewards unchanged. Stick City remains unliberated until its ordinary story is
completed. Loading outside, teleporting, standing in a shallow pit or crossing
undug soil cannot award the route. A legitimate save partway through any tunnel
can resume the continuous city-origin crossing, including saves made with the
older Great Gate tracker. Pickup location, ownership, tool selection,
excavations, player depth, climbing height and passive-route progress survive
saving and travel.

## Checks

```sh
node tools/check-shovel-tool.js
node tools/check-shovel-terrain.js
node tools/check-shovel-foundations.js
node tools/check-shovel-render.js
node tools/check-shovel-passive-route.js
node tools/check-shovel-integration.js
```

These checks exercise native melee, dig actions, movement, input dispatch and
the complete campaign save/load path. Browser review additionally uses real
p5/WebGL at portrait and landscape phone sizes, including touch digging on the
existing west-side courtyard lawn, a player-created westward tunnel, intact
gates, save/load, and actual passive travel to Level 2.

![Waist-deep grass excavation with shovel controls](previews/shovel-waist-pit.png)

![Roofed tunnel beneath an intact Great Gate](previews/shovel-gate-tunnel.png)
