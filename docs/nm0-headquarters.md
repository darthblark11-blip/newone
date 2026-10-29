# NM-0 headquarters laboratory

Level 8 is a closed authored interior entered from Stick City's north gate.
The main laboratory preserves its entrance, twenty armored pistol guards,
archive door at `(0,-800)`, armor blueprint at `(0,-2000)`, and surface exit.
The north wall now reserves three branch doors. The center `DESCENT` door
opens a yes/no prompt for the downward-only lift to Level 9; the northwest and
northeast wings remain sealed. See [NM-0 descent and underground chamber](underground-occult.md).

The laboratory has inset composite floor panels, service grates, cyan aisle
guides, containment markings and paneled cutaway walls. Computer banks,
eight green specimen cylinders, stocked science benches and equipment cabinets
use the game's shared camera lean and native depth sorting. Props have local
contact shade; indoor fixtures never receive outdoor building pads.

The middle combat aisle and both side service aisles remain clear. Guard arrival
stations are authored so nobody starts inside the new equipment. The existing
archive unlock counts only surviving main-room guards; office kills cannot
unlock it early. Six additional low worktops provide cover in the first room.

## West and east offices

New side-wall doors at `(-1000,800)` and `(1000,800)` open into horizontal
hallway entrances and two office wings. These are separate from the sealed
northwest/northeast branches. Each wing has eight finite NM-0 armored guards,
including two riflemen, and office corridors, open-front cubicles, computer
desks, lab benches and cabinets that use the normal physical cover system.
Opening a wing activates its guard and scientist roster once; generic enemy
maintenance cannot refill it. Both sides remain connected to the main room
by walkable passages, with no teleport or level transition.

Approach a side door and tap **OPEN OFFICE**, press **F** or **Enter**, or press
controller **A**. Open doors stay open. Three scientists in each office flee
along collision-checked routes and hide crouched behind office furniture.

The east office contains one **Light Key** card on the records desk at
`(2670,-340)`. Its symbol is a circle with a dot in the center. Approach the
desk and use **TAKE LIGHT KEY** with the same controls. Acquisition shows the
name and symbol on the HQ HUD and persists through saves and level travel.
The card is retained for later use; it does not open the sealed north branches.
HQ saves preserve open side doors, surviving guards and their health, hiding
scientists and the original archive unlock. Older saves remain compatible.

Three ambient scientists start within the phone's entrance view, startle, run
along collision-checked routes and crouch in the south corners. They use native
cel figure primitives with coats, badges and safety goggles. Their separate list
does not add hostiles, kills, reinforcements or government population. They freeze
with the simulation and reset when leaving or replacing the run.

Floor detail is baked lazily into at most twenty-four 500×500 canvases. Repeated frames
reuse them, and level entry or a hard reset releases them. Surface detail and
prop art are deterministic; no per-frame random texture work is required.

Focused checks:

```sh
node tools/check-nm0-lab.js
node tools/check-nm0-scientists.js
node tools/check-nm0-hq-spawning.js
node tools/check-nm0-offices.js
VIS_DEPS=/workspace/newone-dev VIS_CHROME=/usr/bin/chromium node tools/visual-nm0-lab.js
```

The native p5 replay renders arrival, hallway, clone laboratory, archive,
both office wings, the Light Key and crouching-staff views. It checks for frame
faults and verifies floor-cache reuse.
