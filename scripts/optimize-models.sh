#!/bin/bash
# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, you can obtain one at https://mozilla.org/MPL/2.0/.
#
# Copyright Oxide Computer Company

# Optimizes GLB models in models/ and exports to public/models/.
# Non-GLB assets (textures, etc.) are copied as-is.
# Requires: npx @gltf-transform/cli
#
# Usage:
#   ./optimize-models.sh                       # process all models (full rebuild)
#   ./optimize-models.sh path/to/model.glb     # process a single model
#   ./optimize-models.sh sleds/compute.glb     # path may be relative to models/
#
# Pipeline per GLB:
#   1. dedup    — merge duplicate accessors, materials, meshes
#   2. instance — convert repeated meshes to EXT_mesh_gpu_instancing
#   3. flatten  — bake node transforms (skips instanced nodes)
#   4. join     — merge primitives sharing a material (skips instanced)
#   5. weld     — merge duplicate vertices, improve index sharing
#   6. reorder  — optimize vertex order for GPU cache
#   7. quantize — reduce vertex precision (32-bit → 16-bit)
#   8. draco    — DRACO compression

set -euo pipefail
cd "$(dirname "$0")/.."

SRC=models
OUT=public/models
TMP=/tmp/glb-optimize

optimize_one() {
  local glb="$1"
  local rel="${glb#$SRC/}"
  local out="$OUT/$rel"
  mkdir -p "$(dirname "$out")"

  echo "=== Processing $rel ==="
  local before_size
  before_size=$(ls -lh "$glb" | awk '{print $5}')

  npx @gltf-transform/cli dedup    "$glb"          "${TMP}-1.glb" 2>&1
  npx @gltf-transform/cli instance "${TMP}-1.glb"  "${TMP}-2.glb" --min 5 2>&1
  npx @gltf-transform/cli flatten  "${TMP}-2.glb"  "${TMP}-3.glb" 2>&1
  npx @gltf-transform/cli join     "${TMP}-3.glb"  "${TMP}-4.glb" 2>&1
  npx @gltf-transform/cli weld     "${TMP}-4.glb"  "${TMP}-5.glb" 2>&1
  npx @gltf-transform/cli reorder  "${TMP}-5.glb"  "${TMP}-6.glb" --target performance 2>&1
  npx @gltf-transform/cli quantize "${TMP}-6.glb"  "${TMP}-7.glb" 2>&1
  npx @gltf-transform/cli draco    "${TMP}-7.glb"  "$out" 2>&1

  local after_size
  after_size=$(ls -lh "$out" | awk '{print $5}')
  echo "  Size: $before_size → $after_size"
  echo ""
}

# Single-file mode: accept either "models/foo.glb" or "foo.glb"
if [ $# -gt 0 ]; then
  target="$1"
  if [ ! -f "$target" ] && [ -f "$SRC/$target" ]; then
    target="$SRC/$target"
  fi
  if [ ! -f "$target" ]; then
    echo "Error: file not found: $1" >&2
    exit 1
  fi
  case "$target" in
    "$SRC"/*) ;;
    *) echo "Error: target must be inside $SRC/ (got: $target)" >&2; exit 1 ;;
  esac

  optimize_one "$target"
  rm -f ${TMP}-*.glb
  echo "Done!"
  exit 0
fi

# Full rebuild
rm -rf "$OUT"

find "$SRC" -name '*.glb' | sort | while read -r glb; do
  optimize_one "$glb"
done

rm -f ${TMP}-*.glb

# Copy non-GLB assets (textures, etc.)
find "$SRC" -type f ! -name '*.glb' ! -name '.DS_Store' | sort | while read -r asset; do
  rel="${asset#$SRC/}"
  out="$OUT/$rel"
  mkdir -p "$(dirname "$out")"
  cp "$asset" "$out"
  echo "Copied $rel"
done

echo "Done!"
