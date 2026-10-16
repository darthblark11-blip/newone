# Owned fortresses and active military

Capturing a fortress reserves its enclosed grounds for the player's people.
This includes Stick City's large starting enclosure when its towers fall and
each overworld fortress after capture. Enemy spawn routes place their arrivals
outside those boundaries; hostile fort garrisons and reinforcement ticks cannot
refill a captured yard. The existing fights and their completion conditions still
run, with the hostile arrivals assembling outside the gates.

Confirming the Government Directive deploys the assigned population at the
nearest owned fortress in the current sector. Departments retain their assigned
men and women; deployment only rebuilds their visible residents. Idle residents
remain inside that fortress's usable interior. Loading a deployed population
uses the same fortress placement, including captured outposts in sectors whose
story towers are still standing. Opening a town icon returns to the pooled
Directive without copying its people into that sector's ledger. Without an
owned fortress, deployment does not create residents around the player.

Both the story Directive and the paused Directive have a **MILITARY TO BRING**
button. Its submenu selects men and women from the military department using
the same held plus/minus controls as travel selection. **DEPLOY** creates active
combat troops at the nearest owned fortress, resumes the world, and tells the
troops to follow the player. **BACK** returns to the originating Directive
without dispatching the selection. Department edits made before opening this
submenu are committed so its available military counts use the new assignments.

Active troops are a detachment from their existing department, rather than new
population. Active and pending travel troops reduce the number still available
to deploy and are excluded from the idle military residents. Deployment leaves
the military ledger and global population unchanged. Assignment controls and
sector transfers cannot remove military members who are already active or
reserved for travel. A casualty debits the
victim's exact home department and gender once. Save/load preserves active
detachments, and travel carries existing active troops together with newly
selected escorts without conjuring a second copy.

FOLLOW, HOLD, SEARCH and SPREAD share a base movement speed of 4.0 world units
per update, including pursuit during those commands and return to a held post.
Existing type, mount and terrain multipliers still apply. Allies stop at their
usual formation/combat distance, and HOLD remains stationary at its post.
Neutral and unarmed civilians retain their existing walking speeds.

Travel back to a previously visited sector prefers the nearest usable captured
fortress or completed player construction area. Without usable owned ground,
arrival searches for a collision-safe point at least 100 HUD metres (1,000
world units) from every live hostile. It tries the story enclosure first and
can use exterior ground when that enclosure has no safe point. Enemy rosters,
gates and battle counters are preserved. The camera and arriving escorts use
the final landing point. First visits retain their authored story arrivals;
loading retains saved player coordinates. Visit memory persists in saves and
resets when starting a new campaign.

Run the focused interaction and accounting checks from the repository root:

```sh
node tools/check-directive-military-menu.js
node tools/check-owned-fortress.js
node tools/check-military-deployment.js
node tools/check-ally-command-speed.js
node tools/check-return-travel.js
node tools/check-fortress.js
node tools/check-population.js
node tools/check-saveload.js
```

The submenu check uses actual drawing and touch dispatch for both Directive
routes. It checks assignment edits, held mouse and touch selection, selection
limits, repeated deployment, cancellation, fortress placement and confinement,
population save/load, deployment followed by the town-icon return route, and
the ownership prerequisite. The military check covers
live/pending reserve accounting, troop persistence, travel, and casualties; the
owned-fortress check covers the different hostile spawn routes and capture states.
