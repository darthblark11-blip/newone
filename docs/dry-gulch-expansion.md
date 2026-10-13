# Dry Gulch expansion

Level 3 keeps its authored farm and western town in story mode, arcade mode and
after settlement. Streamed farmland and desert continue beyond the town, with
world-space canyon bends, layered rock faces, descending ramps and timber
crossings. Terrain height, movement and the signed lighting heightfield use the
same canyon geometry. Rock and wash planes join into continuous cached
contours, and lighting interpolates shared corner heights, keeping the terrain
free of repeated paint or shadow seams.

The town has 69 named premises across Main Street, Front Street, Market Street,
the mesa district and the railway avenue. The Copper Spur is a larger saloon
with its own walkable interior, counter, patrons, tables, piano and gallery.
Town doors, street signs and the sheriff's wanted board remain on return trips.

## Activities and rewards

| Activity | How to start | Reward |
| --- | --- | --- |
| Barroom Peacemaker | Enter the Copper Spur and talk to Mae at the counter | 75 score on first level-14 clear; saved survival record |
| Quick draw | Ask Mae or challenge Quickhand at the Front Street plaza | 120 score and immediate cowboy costume ownership on first victory |
| Red Mesa Raiders | Accept the sheriff's first wanted poster | 125 score after clearing Red Mesa Redoubt and returning |
| Dust Rail Gang | Accept the next wanted poster | 175 score after clearing the abandoned depot and returning |
| Coyote Creek Outlaws | Accept the final wanted poster | 225 score after clearing the mine camp and returning |

Each defeated contract outlaw also awards 5 score. Bounties keep a numbered gang
roster and surviving enemies' wounds; streaming, saving or travelling cannot
recreate a defeated outlaw or pay a completed contract twice.

The upgrade shop sells the revolver for **100 score**, including six rounds and
three speed loaders. The same price refills and equips it. Winning quick draw
immediately unlocks the cowboy costume; select **COWBOY COSTUME → EQUIP (FREE)**
in the shop to wear its curved cel shaded hat, vest and bandana. The costume is
exclusive with the ninja, explosive and chemist suits.

## Controls

Outside, approach a saloon door, Quickhand or the wanted board and use the
displayed touch button, **F**, or gamepad **A**. A finger held on an interaction
button is consumed until release so it cannot become gunfire.

Inside, use the left touch stick or **WASD** to move. Talk to Mae to choose the
brawl or duel; desktop **1/2** selects the activity. Fistfights use shared
southpaw boxing with four head/body punches, directional guards, timed parries
and four-way slips. GRIT and directional knockouts remain nonlethal. The
1400 × 980 room retains its close camera and has a clear fighting floor.
Target changes ease the camera instead of snapping it. Tap and release for
head punches; hold to lower the stance, then release for the body. Well-timed
alternating attacks after a landed hit earn quicker combos, with distinct
yellow hit bursts, block sparks and larger parry flashes.

Peacemaker is a survival gauntlet: the first six levels teach single opponents,
blocking/two-punch brawlers, small groups and a great fighter with head movement
and three-punch chains. Level 7 tackles the player through the Copper Spur's
door onto Main Street. Attacker counts and skill increase until level 14 moves
combat onto a canyon bridge, then survival continues there. GRIT carries between
waves with a small breather recovery. Best completed level is saved; local
fighters, cinematic debris and nonlethal falls stay separate from campaign AI.

GRIT sits inside the fading header's upper-left corner. Outdoors, the sheriff
heading fades after three seconds while its compact direction arrow and
distance remain visible.

For quick draw, the right stick aims below roughly 70% travel and fires when
pushed farther. Wait for the green **DRAW** cue and hit the opponent. Aiming
early is safe; an early shot loses and a badly aimed round can miss. Victories
advance saved challenges with farther, quicker opponents. Native death effects
stay inside the duel; rematches preserve the first-victory reward.

See [Boxing and quick draw](boxing-and-duels.md) for the complete control map,
guard sectors, contact geometry and progression rules.

The saloon's pause controls provide resume, save and leave-to-shop actions.
Saving inside preserves quest progress and exterior equipment and resumes at
the exterior position. Travelling closes the local scene before building the
next sector. Outdoor AI, projectiles, town population and campaign objectives
remain separate from the saloon scene.

## Validation

Focused checks exercise native input, combat, reward, save/load, travel,
placement and terrain/light geometry:

```sh
node tools/check-frontier-town.js
node tools/check-frontier-canyons.js
node tools/check-frontier-equipment.js
node tools/check-frontier-lighting.js
node tools/check-frontier-bounties.js
node tools/check-frontier-saloon.js
node tools/check-frontier-gauntlet.js
node tools/check-frontier-gauntlet-arenas.js
node tools/check-boxing-gauntlet-ai.js
node tools/check-frontier-hud-refinements.js
node tools/check-frontier-routes.js
node tools/check-frontier-integration.js
node tools/check-boxing-combat.js
node tools/check-boxing-render.js
node tools/check-boxing-world.js
```

The existing forest mission, save/load, return travel, population, render,
depth and lighting suites also cover the shared engine seams.

Chromium checks at 390 × 844 and 940 × 390 with device pixel ratio 3 verify
native-input opening-wave combat, brawler blocking/two-punch chains and ace
three-punch chains/head movement. Later-wave progression fixtures exercise the
door-tackle transition, bridge reveal, continuing survival, rail collision and
pause/save/shop isolation. The final street framing also runs 240 native frames
with actual AI contacts and a faded HUD. All captured frames balance their drawing
state and report no game errors. Separate duel/equipment checks cover early and
successful shots, costume equipment, revolver purchase and bounty acceptance.
Native walking checks reached all three outposts
through generated solids and canyon collision. The lighting check sampled the
actual canyon height buffer across floor pixels, with no false rim-height gaps;
day and night WebGL passes also verified floor, rim and roof light occlusion.

## Captured previews

![Peacemaker level 7 outside the saloon](previews/peacemaker-gauntlet-street.png)

![The tackle through the Copper Spur doors](previews/peacemaker-gauntlet-tackle.png)

![Peacemaker level 14 above the canyon](previews/peacemaker-gauntlet-bridge.png)

![Expanded western town](previews/dry-gulch-town.png)

![Layered canyon, rock faces and timber crossing](previews/dry-gulch-canyon.png)

![Copper Spur fistfight on a portrait mobile screen](previews/dry-gulch-saloon.png)

![Quick draw victory and immediate costume award](previews/dry-gulch-duel.png)
