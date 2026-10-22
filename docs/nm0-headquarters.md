# NM-0 headquarters laboratory

Level 8 is a closed authored interior entered from Stick City's north gate.
This first environment pass preserves its entrance, twenty armored pistol guards,
secret-room door at `(0,-800)`, armor blueprint at `(0,-2000)`, and surface exit.
The planned three underground dungeon routes are not connected yet.

The laboratory has inset composite floor panels, service grates, cyan aisle
guides, containment markings and paneled cutaway walls. Fourteen computer banks,
eight green specimen cylinders, stocked science benches and equipment cabinets
use the game's shared camera lean and native depth sorting. Props have local
contact shade; indoor fixtures never receive outdoor building pads.

The middle combat aisle and both side service aisles remain clear. Guard arrival
stations are authored so nobody starts inside the new equipment. The existing
twenty-kill room unlock still counts the guard roster alone.

Three ambient scientists start within the phone's entrance view, startle, run
along collision-checked routes and crouch in the south corners. They use native
cel figure primitives with coats, badges and safety goggles. Their separate list
does not add hostiles, kills, reinforcements or government population. They freeze
with the simulation and reset when leaving or replacing the run.

Floor detail is baked lazily into at most ten 500×500 canvases. Repeated frames
reuse them, and level entry or a hard reset releases them. Surface detail and
prop art are deterministic; no per-frame random texture work is required.

Focused checks:

```sh
node tools/check-nm0-lab.js
node tools/check-nm0-scientists.js
node tools/check-nm0-hq-spawning.js
VIS_DEPS=/workspace/newone-dev VIS_CHROME=/usr/bin/chromium node tools/visual-nm0-lab.js
```

The native p5 replay renders arrival, hallway, clone laboratory, archive and
crouching-staff views, checks for frame faults and verifies floor-cache reuse.
