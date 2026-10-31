# NM-0 batches reduced by 40%

The initial ambush groups are smaller, with counted enemies held back in
reserve. Mission kill targets, spawn locations, per-enemy behavior and the
existing reinforcement delays remain unchanged. The p5 1.9.0 rendering fix
and hostile firing coordinator remain active; allied firing is unrestricted.

| Spawn | Before | After | Counted reserves after opening |
| --- | ---: | ---: | ---: |
| Tower ambush, both flanks combined | 100 | 60 | 240 toward the same 300-kill target |
| Each gate flank group | 25 | 15 | 120 toward the same 150-kill target |
| Grey Fatigue opening | 50 | 30 | 120 toward the same 150-kill target |
| Generated fort opening | 50 | 30 | At least 120 toward the same 150 generated enemies |
| Scripted ambush reload cap | 100 | 60 | Remaining kills minus the exact restored count |
| Fort refill floor | 10 | 6 | Existing reserve pool |

Individual kill-triggered reinforcements still arrive one at a time after
the existing 200–800 ms delay. Fort refill checks still run every 24 frames.
Their former four-enemy batches now alternate between two and three:
`2, 2, 3, 2, 3` over five phases gives 12 arrivals instead of 20, exactly
40% less across five fully requested batches. A refill stops at the six-body
floor or the remaining reserve, whichever comes first.

Existing gate structure is preserved: it has three flank groups, with the
last two counted toward the ambush. Actual opening bodies change 75 → 45;
the counted contingent changes 50 → 30. The existing uncounted group also
shrinks 25 → 15. Mission counters still close at 150. This does not rewrite
the gate encounter or change which pre-existing actors count as ambushers.

All original opening unit types remain. Whole-unit rounding determines their
mix inside the smaller groups. Fort conscripts/garrison remain untouched;
blocked fort stations are added to reserves as before.

Reload composition now allocates the exact restored count: independently
rounding every category upward would otherwise spawn 61 enemies for a cap
of 60, or exceed the remaining kill count near the end of a fight.

Validation passed:

- 56 native batch checks: openings, merges, ally tagging, reserve conservation,
  complete kill/reserve drains, blocked fort stations, refill timing and
  reload counts for 0, 1, 2, 7, 59, 60, 61, 150 and 300 remaining kills.
- All 91 fortress checks and 63 hostile-coordinator checks.
- Mechanics source guard, permitting only the precise authorized batch edits
  in addition to the existing hostile firing gates; syntax/whitespace checks.
- Browser smoke using the uploaded p5 1.9.0: 60 initial tower ambushers,
  240 reserves, 15 measured frames, no browser errors or frame faults.

The battle profiler accepts the new 60-enemy opening and retains compatibility
with older baseline sources that spawned 100. No new FPS result is claimed
for this gameplay tuning change.
