# Impact blood and arrow wounds

Human projectile impacts now share the small wildlife floor splatter. The
shared painter deposits exactly three directional droplets using the animal
ink (`111, 9, 16`), 3–8-unit diameters and a short forward spread. These marks
use the existing floor blood bank, beneath bodies, and remain fixed on the
ground when the victim moves. Body wound decals keep their own rendering path.
Airborne projectile contact now adds a brief ink-rimmed comic burst with a
strong yellow core and angular rays. The contact pop is about 45% larger than
the first comic version. Non-head human hits throw denser, farther-reaching blood
ribbons, pointed spray fans and smaller streaks instead of a cluster of ovals.
The effect is cosmetic; hit resolution, damage and knockback do not change.

## Human impact eligibility

Blood is added only when a projectile actually lowers a human target's HP.
This includes damage that overflows the player's shield when it breaks.
Shield-only damage, immunity, taser contact and hits on an active armored
helmet do not produce this flesh splatter. Machines, vehicles, alien bodies
and livestock do not receive the new human red-blood effect. NM0 armored body
hits use the same red floor droplets alongside the new airborne spray. Hard
helmet impacts retain their metal streaks and do not produce flesh blood.

NM0 body and leg contacts replace the old orange `ARMOR_IMPACT` blobs and
`BLOOD_SMOKE` puffs with one `COMIC_IMPACT` burst and twelve `HIT_BLOOD`
particles. The comic burst reflects whether the projectile struck intact plate
or exposed flesh. Gray debris, smoke and the old orange sparks are absent from
these hits. Helmet impacts retain nine metal streaks and add a comic burst;
their gray chips are removed. Robot chassis/head effects, oil, alien armor and
shield feedback retain their existing materials.

Ordinary exposed human body/leg impacts use the same new burst and directional
spray. Existing bare-head blood effects remain, with the comic contact layered
underneath them. The old death pools and small floor drops keep their oval
shapes. Continuous corpse bleeding and fatal wound jets retain their existing
emitters, timing and particles: the experiment is scoped to projectile impact.
Blood remains above the bright contact burst. Effects keep their shovel
owner/depth projection and reuse the bounded particle pool; drawing never rolls
gameplay randomness or changes the effect's pose.

The standard soldier still starts with 300 HP and has armor while its health
before a hit is above 50 HP. The shot that crosses that boundary still hits
plate; subsequent hits at or below 50 HP use the exposed-flesh burst and spray.
The orb's separate 600-HP / 300-HP armor rule is unchanged.

## Directional kill stains

Oval death pools now hold for 45 active ticks (about 0.75 seconds), then spread
gradually until 360 ticks (about six seconds). Center droplets begin first and
each oval takes 90 ticks to reach its final size. This gives the immediate
directional stain time to show before the round pool covers it. Surface, pit
and built-in face-down pools use the same hold and finish time; the corpse's
settled pose stays frozen while its pool grows. The final oval pattern, size,
color and random sequence are unchanged. Small impact/trail drops and scorch
still appear immediately. Pause freezes growth, and biome travel retains the
pending floor deposition in its own blood bank.

Explosion deaths are the exception: their oval pools hold for only six active
ticks (about 0.1 seconds) and complete at 54 ticks (about 0.9 seconds). The
center ovals grow first over 20 ticks while the outer ovals follow. The same
short schedule applies to built-in face-down and below-ground blast pools.
This changes timing only; the rolled final oval shapes, colors and random
sequence remain identical to the ordinary pool.

Each actual human death adds a ragged vector floor splatter alongside the
existing oval pool. The finishing projectile's direction controls the heavy
forward fan, tapered satellite streaks and smaller entry-side tears. Other
finishing attacks use the killer-to-victim direction, then recent motion or
facing when no attack origin is available. A previous nonfatal shot cannot
override the finishing attack, even if both happen in the same frame.

The seventeen polygon marks bake once into the existing floor blood bank,
below corpses, using the same surface limits and seam clipping as the oval
pools. Moving or removing the victim leaves the stain fixed. Duplicate death
dispatches cannot add it twice; nonfatal hits, machines, alien bodies and
wildlife do not create human kill stains. A separate budget accepts at most
24 kill stains in one frame without using gameplay randomness.

Below the surface, vector stains reuse the bounded depth-mark list. They
follow a falling victim's depth, detach on reaching the shaft floor and stay
on that floor when the victim moves. Travel banks the marks with the sector;
a genuine restart clears them along with the other blood surfaces.

A positive-damage arrow that leaves a human alive starts a cosmetic wound
trail. It drops one small 2.5–5-unit droplet every 250 active milliseconds,
following the wound's body-local position as the person moves and turns.
Previously deposited marks stay where they landed. The trail itself does not
apply human HP damage or introduce human bleed-out deaths.

Each arrow wound can trail for 60,000 active milliseconds. Further arrow hits
refresh that visual wound. Restoring actual HP through `restoreHealth()`
closes a human arrow wound; armor/shield regeneration does not. Pause, menus
and cutscenes freeze its clock. Death, stun, harvest, a sector change or a
blood-bank change clears its transient actor state. Wound trails are not
serialized into campaign saves.

## Animal vital wounds

Animal headshots still depend on the first anatomical surface struck, with
the army HEAD/BODY toggle unable to change that result. For an arrow body
contact, `wildlifeVitalPath()` traces the forward path from the hide to the
torso exit against a smaller, facing-relative front-chest heart/lung ellipse.
A short projectile step that barely reaches the hide produces the same vital
classification as a longer step. Rump-only paths and outer torso grazes remain
nonvital. This additional geometry test runs only on the nearest arrow body
contact.

A positive-damage, non-dud vital body arrow with power at least `0.55` starts
gradual HP loss and a 60,000-active-millisecond mortal deadline. Additional
damage may kill sooner, but subsequent vital arrows cannot restart or extend
the original deadline. Bleeding uses uncapped elapsed frame milliseconds,
separately from capped locomotion steps, so slow rendering does not prolong
the wound. Pause, menus and cutscenes freeze progression. Nonvital, weak and
dud arrows can leave visual droplets without receiving a mortal override.

Bleed-out uses the existing directional body collapse, blood pool, live-grid
removal, corpse lifetime and harvest path. It does not create synthetic hits:
the original shot count and damage history determine specimen condition.
Body-arrow deaths are FAIR within three real shots; four or more shots remain
BAD scraps. A sufficiently powered clean arrow headshot still kills
immediately in PERFECT condition. Taser stun cancels the mortal wound and
retains the existing nonlethal collection behavior.

The first mortal wound sets ephemeral `arrowBleedTracked` state. This keeps
fleeing prey and its carcass available beyond ordinary off-screen culling,
through the normal corpse lifetime or harvest. Travel releases the actor.
The existing 48-animal population cap still bounds tracking work.

## Work and rendering budgets

- A shared frame budget permits 24 impact splashes and eight individual trail
  droplets across humans and wildlife. Each accepted impact has three drops.
- New airborne comic contacts accept at most 24 events in a frame and stop
  adding particles at the existing 900-particle ceiling. A full contact uses
  twelve small spray records plus one burst, with no backlog after a busy frame.
- A delayed frame emits at most one trail droplet per actor. It does not queue
  a backlog or dump missed droplets together. A budget-deferred wound remains
  due; actors that received a drop wait another 250 milliseconds, allowing
  pending wounds to use subsequent frame budgets.
- Human trails advance in the existing player/army update; wildlife trails
  advance in the existing bounded wildlife loop. There is no additional actor
  roster scan, timer callback or persistent per-frame decal list.
- Cosmetic xorshift seeds remain separate from combat, world and ecology RNG.
  Deposits reuse the existing budgeted and evictable floor bank.
- Below the surface, `depositSmallBlood()` uses the established shovel depth
  depositor. A mark follows the victim's falling depth, then detaches onto the
  reached floor. Its world position stays fixed when the victim later walks or
  climbs away; it does not stain an intact surface ceiling.

## Verification

```sh
node --check game.js
node tools/check-impact-blood.js
node tools/check-arrow-wildlife-bleed.js
node tools/check-impact-blood-scene.js
node tools/check-armored-impact-effects.js
node tools/check-standard-armor-break.js
node tools/check-comic-hit-feedback.js
node tools/check-kill-vector-blood.js
node tools/check-blast-blood-pools.js
VIS_DEPS=/workspace/newone-dev node tools/check-impact-particles.js
VIS_DEPS=/workspace/newone-dev node tools/visual-comic-impacts.js
VIS_DEPS=/workspace/newone-dev node tools/visual-kill-vector-splatter.js
```

The human suite covers 69 impact, material, shield, healing, trail, budget,
RNG and shovel-depth checks. The wildlife suite covers 317 geometry, timing,
pause, condition, death, harvest and tracking checks. The browser scene uses
real pooled projectiles and p5 painting to verify human impacts, moving arrow
trails, shield/material exclusions and the animal vital deadline. It writes
screenshots and `report.json` to `/tmp/newone-impact-blood` by default.

Browser dependencies come from `VIS_DEPS` (default
`/workspace/onboarding-newone`), the renderer from `VIS_P5` (default
`/tmp/p5-1.9.4.min.js`), and artifacts from `IMPACT_BLOOD_OUT`. `GAME_JS` can
select a frozen source snapshot. Run the scene with both the deployed p5
renderer and the current comparison renderer when checking compatibility.
