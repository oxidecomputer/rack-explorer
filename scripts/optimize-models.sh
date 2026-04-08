#!/bin/bash
# Optimizes GLB models to minimize draw calls, vertex count, and file size.
# Requires: npx @gltf-transform/cli
#
# Pipeline:
#   1. dedup    — merge duplicate accessors, materials, meshes
#   2. flatten  — bake node transforms, remove hierarchy
#   3. join     — merge primitives sharing a material into single meshes
#   4. weld     — merge duplicate vertices, improve index sharing
#   5. reorder  — optimize vertex order for GPU cache
#   6. quantize — reduce vertex precision (32-bit → 16-bit)
#   7. draco    — re-apply DRACO compression
#
# Originals are saved as *.original.glb

set -euo pipefail
cd "$(dirname "$0")/.."

TMP=/tmp/glb-optimize
MODELS=(
  public/models/patch-panel/patch-panel.glb
  public/models/power-shelf/power-shelf.glb
  public/models/cosmo/cosmo-lod1.glb
  public/models/sidecar/sidecar-lod1.glb
  public/models/rack-frame/rack-frame-lod1.glb
)

for glb in "${MODELS[@]}"; do
  echo "=== Processing $glb ==="
  original="${glb%.glb}.original.glb"

  # Back up original if not already backed up
  if [ ! -f "$original" ]; then
    cp "$glb" "$original"
  fi

  before=$(npx @gltf-transform/cli inspect "$original" 2>/dev/null | grep "TRIANGLES" | wc -l | tr -d ' ')
  before_size=$(ls -lh "$original" | awk '{print $5}')

  npx @gltf-transform/cli dedup    "$original"    "${TMP}-1.glb" 2>&1
  npx @gltf-transform/cli flatten  "${TMP}-1.glb" "${TMP}-2.glb" 2>&1
  npx @gltf-transform/cli join     "${TMP}-2.glb" "${TMP}-3.glb" 2>&1
  npx @gltf-transform/cli weld     "${TMP}-3.glb" "${TMP}-4.glb" 2>&1
  npx @gltf-transform/cli reorder  "${TMP}-4.glb" "${TMP}-5.glb" --target performance 2>&1
  npx @gltf-transform/cli quantize "${TMP}-5.glb" "${TMP}-6.glb" 2>&1
  npx @gltf-transform/cli draco    "${TMP}-6.glb" "$glb" 2>&1

  after=$(npx @gltf-transform/cli inspect "$glb" 2>/dev/null | grep "TRIANGLES" | wc -l | tr -d ' ')
  after_size=$(ls -lh "$glb" | awk '{print $5}')
  echo "  Meshes: $before → $after | Size: $before_size → $after_size"
  echo ""
done

rm -f ${TMP}-*.glb
echo "Done!"
