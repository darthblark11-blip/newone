# Gate breaches and surviving allies

Destroying Stick City's south Great Gate or either Undercity main gate opens
the doorway in the blast that destroys it. The delayed garrison still arrives
and fights; the door stays open throughout the ambush. Small approach walls,
parked cars and barrels are removed from the opening, including their cached
collision entries. The wall wings still block movement and rounds. Stick
City's north wall retains its NM-0 HQ interaction.

Tower collapse changes the surviving sector roster to friendly recruits.
Those recruits join the army only when the NM-0 liberation ambush clears:

`allies gained = captured at tower collapse − captured allies killed before the clear`

For example, 20 deaths before the towers leave 60 captured from the original
80. Seven further deaths during the ambush award 53 allies. Losses are recorded
for both hostile and friendly members of that original roster; unrelated
visitors and the existing military escort are accounted for separately.

The seed, casualty count, sector's ambush-clear record and one-time award are
saved together. Loading restores the remaining recruits with their roster
identity, so subsequent deaths still count. A premature Directive, another
sector's completion or an overworld fort's muster cannot award a pending city
roster. Zero survivors is a completed zero award; reopening or loading never
duplicates it. Existing army assignments and already-awarded saves are retained.

At 20% or less of an NM-0 ambush's forces remaining, a red arrow beside the
player points to the nearest living combatant that counts toward that ambush.
The threshold uses that fight's total, including merged ambushes and fortress
reinforcements. Civilians, allies, neutral units, unrelated enemies and bodies
that cannot drain the counter are excluded. The arrow follows camera movement
and stays the same size across zoom levels; it disappears during menus,
cutscenes, death and after the fight ends.

Run from the repository root:

```sh
node tools/check-gate-survivors.js
node tools/check-ambush-cleanup-arrow.js
node tools/check-population.js
node tools/check-fortress.js
node tools/check-saveload.js
node tools/check-cutscene.js
```

The focused check runs real gate explosions, cached collision and projectile
tests, tower cutscene transitions, lethal hostile/friendly bullets, both
ambush-clear paths, overlapping victims, mid-fight saves and completed/empty
save round trips. Timers are queued so destruction is checked before the
delayed garrison callback runs.
