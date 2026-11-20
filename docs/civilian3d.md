# City residents in Blender

The four Level 1 city residents use the shared human rig and posed model shadows for standing and walking. The city thug also uses the rig when drawing, firing and reloading his pistol. Boxing, injuries, low stances and corpses use their established painters.

| Game character | Clothing and animation |
| --- | --- |
| CITY_CITIZEN_M | Four seeded shirt outfits and seven hairstyles |
| CITY_CITIZEN_F | Blouse with a shoulder yoke and neckline trim, fitted to her native torso dimensions |
| CITY_NEUTRAL_M | Pocketed work vest, short or cut-off sleeves, phone, cigarette and bottle gestures |
| CITY_THUG_M | Purple tracksuit with gold tape, smoking and pistol poses |

The garments attach to the chest so the shoulders can turn independently of the hips. Each street gesture follows the existing activity clock and hand target. The prop follows the resulting wrist position as the character raises or lowers it. The cigarette wisp starts at the projected ember. [Watch the in-game poses](city-residents.webp).

City residents and living human enemies step from fixed hip sockets and plant the supporting foot. [Civilian walk and soldier backstep](standing-footwork.webp).

The player uses the planted-foot rig when leaning against high cover. On open ground the player uses the original run cycle, with long strides and a broad denim cuff over the trailing shoe. [Player run and backpedal](player-run.webp) · [High-cover lean](cover-pivot.webp).

## Editing and rebuilding

The editable models are in `assets/player/player.blend`, in **City civilian variants** and **City street wardrobe**. Each resident also has a portable rigged GLB listed in [the asset manifest](../assets/player/manifest.json).

After a factory rebuild of the player rig, export the two city collections in this order and embed the result for SPCK.

```sh
blender --background assets/player/player.blend --python-exit-code 1 --python tools/blender-city-citizen.py
blender --background assets/player/player.blend --python-exit-code 1 --python tools/blender-city-street.py
python3 tools/build-player3d.py
```

Run `node tools/check-npc3d-browser.cjs` to exercise the residents through the p5 and WebGL renderers. The check covers clothing visibility, reach/use/lower hand contact, armed thug dispatch, Level 1 model shadows and native fallbacks. [Browser check results](civilian3d-validation.json).
