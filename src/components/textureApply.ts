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

// Path-keyed cache so a texture referenced by multiple components (e.g.
// perforations.jpg used by sled, switch, and power shelf) yields a single
// Texture and one GPU upload. Refcounted so VRAM is freed when every
// consumer unmounts. Assumes a given URL is always used the same way
// (alpha vs color) — true for this project's textures.
type CacheEntry = { promise: Promise<THREE.Texture>; refCount: number }
const textureCache = new Map<string, CacheEntry>()

function acquireTexture(path: string, isAlpha: boolean): Promise<THREE.Texture> {
  const existing = textureCache.get(path)
  if (existing) {
    existing.refCount++
    return existing.promise
  }
  const promise = new Promise<THREE.Texture>((resolve, reject) => {
    textureLoader.load(
      path,
      (tex) => {
        tex.flipY = false
        tex.colorSpace = isAlpha ? THREE.NoColorSpace : THREE.SRGBColorSpace
        resolve(tex)
      },
      undefined,
      reject,
    )
  })
  textureCache.set(path, { promise, refCount: 1 })
  return promise
}

function releaseTexture(path: string) {
  const entry = textureCache.get(path)
  if (!entry) return
  entry.refCount--
  if (entry.refCount === 0) {
    textureCache.delete(path)
    entry.promise.then((tex) => tex.dispose()).catch(() => {})
  }
}

/**
 * Loads each texture and applies it to materials whose `name` matches the key.
 * `collectMaterials` is called fresh after each load to handle the case where
 * scene/material refs change between effect runs.
 *
 * Returns a disposer that releases the shared texture refs.
 */
export function applyExternalTextures(
  textures: Record<string, string>,
  collectMaterials: () => THREE.Material[],
): () => void {
  const acquired: string[] = []

  for (const [materialName, texturePath] of Object.entries(textures)) {
    const isAlpha = ALPHA_MATERIAL.test(materialName)
    acquired.push(texturePath)
    acquireTexture(texturePath, isAlpha).then((tex) => {
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
    for (const path of acquired) releaseTexture(path)
  }
}
