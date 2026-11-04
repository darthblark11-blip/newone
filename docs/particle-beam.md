# Particle Beam

The upgrade shop sells the player-only **PARTICLE BEAM** for **50** during
debugging. It is intended as a rare late-game weapon. Purchases refill and equip
the rifle; enemies never select it from their loadout tables.

| Setting | Value |
| --- | --- |
| Firing cooldown | 5 simulation ticks, matching the weapon table's fire-rate convention |
| Body / head damage | 100 / 400 |
| Enemy cooldown placeholder | 48 |
| Spread / projectiles per shot | 0 / 1 |
| Loaded magazine | 100 shots |
| Spare magazines | 9, giving 1,000 rounds including the loaded magazine |
| Debug shop price | 50 |

The military magazine upgrade does not enlarge the energy magazine. Reloads
consume a spare magazine through the normal weapon lifecycle. Spent ammunition,
reload progress and equipped identity survive saving, loading, and sector travel;
old saves do not unlock the weapon. The rifle participates in all existing weapon
cycling inputs and the tablet inventory.

The model shares the existing rifle grip, support-hand and muzzle projection in
standing, walking, crouched, prone and cover poses. Light-grey upper planes,
dark side faces, orange chambers and black contours match the comic gun art.
Chamber hatches open after the 51st shot of an uninterrupted burst, with bounded
vapour puffs while firing continues. Releasing even a short burst vents the
chambers briefly. Heat and exhaust are transient and pause with simulation.

Blue, black-outlined beam segments use swept collision. Their visible endpoint
is resolved after contact, so a beam stops at the nearest body, barrel or cover
instead of painting through it. Energy leg shots remain linear rather than
inheriting the ordinary firearm's downward leg-shot range.

Human flesh impacts leave a slightly larger thermal wound: orange for 60 active
simulation ticks, then cooling over 18 ticks into a dark blood-red stain. Shielded
hits retain the native shield rules. An unblocked humanoid leg hit immediately
severs the struck anatomical leg and collapses the victim. Fatal off-centre body
hits remove the corresponding shoulder/arm and a diagonal torso section.

Fatal centre-body hits cycle independently through:

1. A through-body bore with gibs and a hot rim. An actual clipped aperture leaves
   the floor visible through both the body and its shadow.
2. A backward fall with a brief knee/foot recoil when the back lands, followed by
   the legs settling flat. The body wound follows the same thermal palette.
3. A vertical chest opening with two hinged upper flaps attached to the pelvis;
   the body remains connected and emits a bounded number of gibs.

The centre-body cycle survives saving; leg, side and head impacts do not advance
it. Hot wounds keep moving corpses live until they cool. Forced terrain banking
finishes their palette before stamping, preventing permanently orange marks.
Existing weapons retain their original damage, art and death selection.

Focused verification:

```sh
node tools/check-particle-beam.js
node tools/check-particle-model.js
node tools/check-particle-decals.js
node tools/check-particle-beam-deaths.js
```
