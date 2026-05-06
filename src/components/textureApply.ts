import * as THREE from 'three'

const textureLoader = new THREE.TextureLoader()

// Material names matching this regex are treated as perforation/cutout masks
// (alpha-tested). Lets the same `textures` map handle both color textures
// (e.g. PCB silkscreen) and perforations without a schema change.
const ALPHA_MATERIAL = /perf|alpha/i

type TexturableMaterial = THREE.MeshStandardMaterial | THREE.MeshLambertMaterial

function isTexturable(mat: THREE.Material): mat is TexturableMaterial {
  return (
    mat instanceof THREE.MeshStandardMaterial || mat instanceof THREE.MeshLambertMaterial
  )
}

// Path-keyed cache so a texture referenced by multiple components yields a
// single Texture and one GPU upload. Refcounted so VRAM is freed when every
// consumer unmounts. Assumes a given URL is always used the same way (alpha
// vs color) — true for this project's textures.
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

// Single shared material used by every perforation mesh in the rack. Replaces
// each GLB's per-mesh perforation material so we get:
//   - one shader program across all perforation GLBs (vs ~4 before)
//   - the GLB's baked color/normal/orm maps freed (the surface is just black
//     with an alpha cutout — those maps contributed nothing visually)
// Lambert (not Standard) because the surface is fully diffuse black: PBR's
// IBL/specular contribution to a roughness=1, metalness=0, color=black surface
// is negligible, and Lambert skips the GGX path on every alpha-test fragment.
export const SHARED_PERF_MATERIAL = new THREE.MeshLambertMaterial({
  color: 0x000000,
  side: THREE.BackSide,
  alphaTest: 0.7,
})
SHARED_PERF_MATERIAL.name = 'SharedPerforations'

let perfAlphaPath: string | null = null

function ensurePerfAlpha(path: string, gl: THREE.WebGLRenderer | null): void {
  if (perfAlphaPath !== null) return
  perfAlphaPath = path
  acquireTexture(path, true).then((tex) => {
    if (gl) tex.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy())
    SHARED_PERF_MATERIAL.alphaMap = tex
    SHARED_PERF_MATERIAL.needsUpdate = true
  })
}

const rewrittenScenes = new WeakSet<THREE.Object3D>()

const PBR_TEX_SLOTS = [
  'map',
  'normalMap',
  'aoMap',
  'roughnessMap',
  'metalnessMap',
  'emissiveMap',
] as const

/**
 * Walks `scene`, replaces materials matching the alpha-mask name with
 * SHARED_PERF_MATERIAL, and disposes the GLB's baked PBR textures for those
 * materials. Idempotent per scene (WeakSet-guarded) so repeat calls from
 * multiple consumers of the same loaded GLB are free.
 *
 * Mutates the source `scene` directly — for cached gltf-loader scenes that
 * means subsequent clones inherit the rewrite for free.
 */
export function rewritePerforations(
  scene: THREE.Object3D,
  textures: Record<string, string> | undefined,
  gl: THREE.WebGLRenderer | null,
): void {
  if (!textures || rewrittenScenes.has(scene)) return
  let alphaPath: string | null = null
  for (const [name, path] of Object.entries(textures)) {
    if (ALPHA_MATERIAL.test(name)) {
      alphaPath = path
      break
    }
  }
  if (!alphaPath) return
  rewrittenScenes.add(scene)
  ensurePerfAlpha(alphaPath, gl)

  const disposed = new Set<THREE.Texture>()
  const disposeMaps = (m: THREE.Material) => {
    for (const slot of PBR_TEX_SLOTS) {
      const tex = (m as unknown as Record<string, unknown>)[slot]
      if (tex instanceof THREE.Texture && !disposed.has(tex)) {
        disposed.add(tex)
        tex.dispose()
      }
    }
  }

  scene.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const mats = Array.isArray(child.material) ? child.material : [child.material]
    let changed = false
    const next = mats.map((m) => {
      if (!ALPHA_MATERIAL.test(m.name)) return m
      disposeMaps(m)
      changed = true
      return SHARED_PERF_MATERIAL as THREE.Material
    })
    if (changed) {
      child.material = next.length === 1 ? next[0] : next
    }
  })
}

/**
 * Loads each non-alpha texture and applies it to materials whose `name`
 * matches the key. Alpha entries are owned by SHARED_PERF_MATERIAL and
 * skipped here — call `rewritePerforations` to set those up.
 *
 * Returns a disposer that releases the shared texture refs.
 */
export function applyExternalTextures(
  textures: Record<string, string>,
  collectMaterials: () => THREE.Material[],
): () => void {
  const acquired: string[] = []

  for (const [materialName, texturePath] of Object.entries(textures)) {
    if (ALPHA_MATERIAL.test(materialName)) continue

    acquired.push(texturePath)
    acquireTexture(texturePath, false).then((tex) => {
      for (const mat of collectMaterials()) {
        if (mat.name !== materialName || !isTexturable(mat)) continue
        mat.map = tex
        mat.needsUpdate = true
      }
    })
  }

  return () => {
    for (const path of acquired) releaseTexture(path)
  }
}
