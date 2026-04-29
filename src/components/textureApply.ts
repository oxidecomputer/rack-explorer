import * as THREE from 'three'

const textureLoader = new THREE.TextureLoader()

// Material names matching this regex receive the texture as an alphaMap
// (with alphaTest cutoff) instead of a base-color map. Lets the same
// `textures` map handle both color textures (e.g. PCB silkscreen) and
// perforation/cutout masks (e.g. Void) without a schema change.
const ALPHA_MATERIAL = /perf|alpha/i

type TexturableMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial

function isTexturable(mat: THREE.Material): mat is TexturableMaterial {
  return (
    mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshLambertMaterial
  )
}

/**
 * Loads each texture and applies it to materials whose `name` matches the key.
 * `collectMaterials` is called fresh after each load to handle the case where
 * scene/material refs change between effect runs.
 *
 * Returns a disposer for the loaded textures.
 */
export function applyExternalTextures(
  textures: Record<string, string>,
  collectMaterials: () => THREE.Material[],
): () => void {
  const loaded: THREE.Texture[] = []

  for (const [materialName, texturePath] of Object.entries(textures)) {
    const isAlpha = ALPHA_MATERIAL.test(materialName)
    textureLoader.load(texturePath, (tex) => {
      tex.flipY = false
      tex.colorSpace = isAlpha ? THREE.NoColorSpace : THREE.SRGBColorSpace
      loaded.push(tex)

      for (const mat of collectMaterials()) {
        if (mat.name !== materialName || !isTexturable(mat)) continue
        if (isAlpha) {
          mat.alphaMap = tex
          mat.alphaTest = 0.5
          mat.side = THREE.DoubleSide
        } else {
          mat.map = tex
        }
        mat.needsUpdate = true
      }
    })
  }

  return () => {
    for (const tex of loaded) tex.dispose()
  }
}
