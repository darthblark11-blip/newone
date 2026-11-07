# Rifle and shotgun refinement

Characters keep the softer curved cel shading of the 3D model update. Dark
detail belongs on army helmet shells and brows. See the current
[player animation previews](player-animation.md) for sword grips, running arms
and aimed two-handed poses.

Rifles and shotguns use the same projected solid model when carried, aimed or
fired. Stocks, receivers, barrels, sights and magazines have distinct cel
planes and material edges. Rifle recoil moves the charging handle; shotgun
firing cycles the pump with the support hand attached. Both hands follow their
grips. The muzzle, flash and aim line stay aligned with the existing projectile
origin while moving. Combat timers, ammunition and ballistics are unchanged.

## Browser previews

[Native firing, recoil and pump animation](previews/comic-refinement-actions.mp4)
shows the shared solid gun models at half speed for inspection. The player
animation gallery above shows the current body shading and refined arm poses.

## Validation

The soft surface and helmet suite compares female pistol and corpse painter
traces against the previous model update. The long-gun suite checks
for shared geometry, both grip positions, recoil, pump timing and visual muzzle
registration with native shots. Character, handgun, left action, figure volume,
render, depth, city people, corpse, fall and bow control checks also pass.

The shared gun geometry was reviewed in 416 browser pose cards and a 31-frame
native firing sequence across four headings. Mobile touch movement, aim and
fire passed in levels 1 and 2 on a 390 × 844 canvas. The current player animation
report records validation of the latest poses and softer contours.
