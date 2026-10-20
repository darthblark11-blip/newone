# Impact blood and arrow wounds

Human projectile impacts now share the small wildlife floor splatter. The
shared painter deposits exactly three directional droplets using the animal
ink (`111, 9, 16`), 3–8-unit diameters and a short forward spread. These marks
use the existing floor blood bank, beneath bodies, and remain fixed on the
ground when the victim moves. Existing impact particles and body wound decals
keep their own rendering paths.

## Human impact eligibility

Blood is added only when a projectile actually lowers a human target's HP.
This includes damage that overflows the player's shield when it breaks.
Shield-only damage, immunity, taser contact and hits on an active armored
helmet do not produce this flesh splatter. Machines, vehicles, alien bodies
and livestock do not receive the new human red-blood effect. NM0 armored body
hits use the same red droplets while retaining their existing armor impact
particles; hard helmet impacts retain their material effects.

Armored NM0 body impacts retain ten compact red `BLOOD_SMOKE` mist puffs
and add four tiny orange `ARMOR_IMPACT` bursts, with no grey smoke or debris
chips. The orange burst uses a separate 1.5–3-unit, 3–7-frame particle so
helmet streaks and other shared impact effects keep their original appearance.
Helmet impacts retain their nine metal streaks and five chips; exposed-flesh
thresholds are unchanged. Effects keep their shovel owner/depth projection
and use the existing particle order and pool.

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
