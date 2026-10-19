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

Surface excavation requires a whole square of grass. Roads, sidewalks,
car parks, water, bridges and foundations reject it. Maintained lawns near the
home and gate approaches provide clear entry points; lawns beyond the gates
provide exits. Existing genuine grass lots in other streamed sectors also work.

The first downward scoop makes a waist-deep square. Further scoops deepen the
shaft, lowering and shrinking the player smoothly. At full underground depth,
the renderer shows the earth's strata and a local cutaway with ceiling hatching.
The surrounding surface and any gate remain above the player. Very deep shafts
eventually reduce the figure to a pin-sized silhouette; depth is capped at 4096
world units to keep numeric behavior bounded.

At ground level, a forward scoop opens only one adjacent waist-deep square.
Repeated digging from outside cannot deepen it: enter the hole first. Below
ground, forward digging opens adjacent soft earth at the player's current
height and retains the roof above it, allowing tunnels beneath paved surfaces
and gates. Movement checks the whole player footprint and the intervening
excavated space, so unmined soil and disconnected holes remain solid.

Climbing raises the player within the shaft without deleting its lower floor.
Emerging requires grass overhead; climbing cannot pass through a gate or a
concrete roof. Surface attacks cannot hit a fully underground player, and the
shovel cannot hit opponents on a different level.

## Passive route

Walk a continuous, fully underground passage from the city side through an
entire intact Great Gate and clear its outside edge. This records **PASSIVE
ROUTE** and unlocks the pause menu's overworld and normal southward travel.
The north gate can also reveal this route; the unmapped Sector 09 remains
unavailable.

This route leaves gate health, transmission towers, enemy forces and population
rewards unchanged. Stick City remains unliberated until its ordinary story is
completed. Loading outside, teleporting, or standing in a shallow pit cannot
award the route. A legitimate save partway beneath the gate can resume the
crossing. Pickup location, ownership, tool selection, excavations, player depth,
climbing height and passive-route progress survive saving and travel.

## Checks

```sh
node tools/check-shovel-tool.js
node tools/check-shovel-terrain.js
node tools/check-shovel-render.js
node tools/check-shovel-passive-route.js
node tools/check-shovel-integration.js
```

These checks exercise native melee, dig actions, movement, input dispatch and
the complete campaign save/load path. Browser review additionally uses real
p5/WebGL at portrait and landscape phone sizes.

![Waist-deep grass excavation with shovel controls](previews/shovel-waist-pit.png)

![Roofed tunnel beneath an intact Great Gate](previews/shovel-gate-tunnel.png)
