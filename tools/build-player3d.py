#!/usr/bin/env python3
"""Embed the Blender asset and runtime sources in the standalone game.

Run after editing tools/player3d/*.js or regenerating the Blender export.
--check is a read-only freshness check suitable for CI.
"""
import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BEGIN = '// BEGIN GENERATED PLAYER3D — tools/build-player3d.py'
END = '// END GENERATED PLAYER3D'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    asset = json.loads((ROOT / 'assets/player/player-mesh.json').read_text())
    if asset.get('schemaVersion') != 1 or not asset.get('meshes'):
        raise SystemExit('Unsupported or empty player asset')
    sources = ['pose.js', 'renderer.js', 'corpse.js']
    chunks = [BEGIN, '// Generated source; edit the Blender model/exporter and tools/player3d modules.',
              'const PLAYER3D_ASSET = ' + json.dumps(asset, separators=(',', ':'), ensure_ascii=True) + ';']
    for source in sources:
        path = ROOT / 'tools/player3d' / source
        if path.exists():
            chunks.extend(['// Source: tools/player3d/' + source, path.read_text().rstrip()])
        elif source != 'corpse.js':
            raise SystemExit('Missing runtime source: ' + str(path))
    chunks.append(END)
    block = '\n'.join(chunks) + '\n'
    game = ROOT / 'game.js'
    current = game.read_text()
    if BEGIN in current:
        start = current.index(BEGIN)
        end = current.index(END, start) + len(END)
        updated = current[:start] + block + current[end:].lstrip('\n')
    else:
        updated = current.rstrip() + '\n\n' + block
    if args.check:
        if updated != current:
            raise SystemExit('Player 3D runtime is stale; run python3 tools/build-player3d.py')
        print('Player 3D embedded runtime is up to date')
    else:
        game.write_text(updated)
        print('Embedded', len(asset['meshes']), 'meshes and', len(sources), 'runtime modules')


if __name__ == '__main__':
    main()
