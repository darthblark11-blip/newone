#!/usr/bin/env python3
"""Embed Blender-preprocessed building lighting data and its small runtime."""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BEGIN = '// BEGIN GENERATED BUILDING3D — tools/build-building3d.py'
END = '// END GENERATED BUILDING3D'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    asset = json.loads((ROOT / 'assets/buildings/roof-lighting.json').read_text())
    if asset.get('schema') != 1 or asset.get('quantization') != 10000 or not asset.get('models'):
        raise SystemExit('Unsupported or empty Blender roof-lighting export')
    block = '\n'.join([
        BEGIN,
        '// Generated source; edit tools/building3d/roof-lighting.js and the Blender roof export.',
        'const BUILDING3D_ROOF_ASSET = ' + json.dumps(asset, separators=(',', ':'), ensure_ascii=True) + ';',
        (ROOT / 'tools/building3d/roof-lighting.js').read_text().rstrip(),
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
            raise SystemExit('Building lighting runtime is stale; run python3 tools/build-building3d.py')
        print('Blender building lighting runtime is up to date')
    else:
        game.write_text(updated)
        print('Embedded', len(asset['models']), 'Blender roof-lighting plans')


if __name__ == '__main__':
    main()
