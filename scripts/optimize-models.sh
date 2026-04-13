#!/bin/bash
# Optimizes all GLB models in models/ and exports to public/models/.
# Non-GLB assets (textures, etc.) are copied as-is.
# Requires: npx @gltf-transform/cli
#
# Pipeline per GLB:
#   1. dedup    — merge duplicate accessors, materials, meshes
#   2. flatten  — bake node transforms, remove hierarchy
#   3. join     — merge primitives sharing a material into single meshes
#   4. weld     — merge duplicate vertices, improve index sharing
#   5. reorder  — optimize vertex order for GPU cache
#   6. quantize — reduce vertex precision (32-bit → 16-bit)
#   7. draco    — DRACO compression

set -euo pipefail
cd "$(dirname "$0")/.."

SRC=models
OUT=public/models
TMP=/tmp/glb-optimize

# Clean output directory
rm -rf "$OUT"

# Optimize all GLB files
find "$SRC" -name '*.glb' | sort | while read -r glb; do
  rel="${glb#$SRC/}"
  out="$OUT/$rel"
  mkdir -p "$(dirname "$out")"

  echo "=== Processing $rel ==="
  before_size=$(ls -lh "$glb" | awk '{print $5}')

  npx @gltf-transform/cli dedup    "$glb"          "${TMP}-1.glb" 2>&1
  npx @gltf-transform/cli flatten  "${TMP}-1.glb"  "${TMP}-2.glb" 2>&1
  npx @gltf-transform/cli join     "${TMP}-2.glb"  "${TMP}-3.glb" 2>&1
  npx @gltf-transform/cli weld     "${TMP}-3.glb"  "${TMP}-4.glb" 2>&1
  npx @gltf-transform/cli reorder  "${TMP}-4.glb"  "${TMP}-5.glb" --target performance 2>&1
  npx @gltf-transform/cli quantize "${TMP}-5.glb"  "${TMP}-6.glb" 2>&1
  npx @gltf-transform/cli draco    "${TMP}-6.glb"  "$out" 2>&1

  after_size=$(ls -lh "$out" | awk '{print $5}')
  echo "  Size: $before_size → $after_size"
  echo ""
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
