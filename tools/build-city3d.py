#!/usr/bin/env python3
"""Embed the Blender city roof kit and its Canvas render/terrain helpers."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BEGIN = '// BEGIN GENERATED CITY3D — tools/build-city3d.py'
END = '// END GENERATED CITY3D'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    asset = json.loads((ROOT / 'assets/buildings/city-buildings.json').read_text())
    if asset.get('schemaVersion') != 1 or len(asset.get('models', {})) != 3:
        raise SystemExit('Expected the three exported Blender city roof families')
    block = '\n'.join([
        BEGIN,
        '// Edit tools/building3d/projected-faces.js, city-buildings.js, city-quay-props.js, city-ground.js and the Blender source.',
        'const CITY3D_ASSET = ' + json.dumps(asset, separators=(',', ':'), ensure_ascii=True) + ';',
        (ROOT / 'tools/building3d/projected-faces.js').read_text().rstrip(),
        (ROOT / 'tools/building3d/city-buildings.js').read_text().rstrip(),
        (ROOT / 'tools/building3d/city-quay-props.js').read_text().rstrip(),
        (ROOT / 'tools/building3d/city-ground.js').read_text().rstrip(),
        END,
    ]) + '\n'
    game = ROOT / 'game.js'
    current = game.read_text()
    if BEGIN in current:
        start = current.index(BEGIN)
        end = current.index(END, start) + len(END)
        updated = current[:start] + block + current[end:].lstrip('\n')
    else:
        updated = current.rstrip() + '\n' + block
    if args.check:
        if updated != current:
            raise SystemExit('City Blender runtime is stale; run python3 tools/build-city3d.py')
        print('Blender city runtime is up to date')
    else:
        game.write_text(updated)
        print('Embedded', len(asset['models']), 'Blender city roof families')


if __name__ == '__main__':
    main()
