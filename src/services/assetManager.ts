import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface PbrTextureSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

class AssetManager {
  private gltfLoader = new GLTFLoader();
  private textureLoader = new THREE.TextureLoader();

  private modelCache = new Map<string, Promise<THREE.Group | null>>();
  private textureSetCache = new Map<string, Promise<PbrTextureSet | null>>();

  /**
   * Loads and caches a local CC0 GLTF model, normalizes its scale so its max dimension equals
   * targetMaxDim, and shifts it so its bottom rests cleanly at y = 0.
   * Returns a lightweight cloned Group sharing cached geometries & textures.
   */
  public async loadModelClone(url: string, targetMaxDim = 1.0): Promise<THREE.Group | null> {
    if (!this.modelCache.has(url)) {
      const promise = new Promise<THREE.Group | null>((resolve) => {
        this.gltfLoader.load(
          url,
          (gltf) => {
            const root = gltf.scene;
            const box = new THREE.Box3().setFromObject(root);
            const size = new THREE.Vector3();
            const center = new THREE.Vector3();
            box.getSize(size);
            box.getCenter(center);

            const maxDim = Math.max(size.x, size.y, size.z, 0.001);
            const normScale = targetMaxDim / maxDim;

            const wrapper = new THREE.Group();
            root.scale.setScalar(normScale);
            root.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);
            root.traverse((obj) => {
              if ((obj as THREE.Mesh).isMesh) {
                const m = obj as THREE.Mesh;
                m.castShadow = false;
                m.receiveShadow = true;
                if (m.geometry) m.geometry.userData.sharedAsset = true;
                const mats = Array.isArray(m.material) ? m.material : [m.material];
                mats.forEach((mat) => {
                  if (!mat) return;
                  mat.userData.sharedAsset = true;
                  const anyMat = mat as unknown as Record<string, unknown>;
                  ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap'].forEach(
                    (k) => {
                      const t = anyMat[k];
                      if (t instanceof THREE.Texture) {
                        t.userData.sharedAsset = true;
                      }
                    }
                  );
                });
              }
            });
            wrapper.add(root);
            resolve(wrapper);
          },
          undefined,
          () => resolve(null)
        );
      });
      this.modelCache.set(url, promise);
    }

    const template = await this.modelCache.get(url)!;
    return template ? template.clone(true) : null;
  }

  /**
   * Extracts the first Mesh's geometry & material from a cached GLTF model for InstancedMesh usage.
   */
  public async loadFirstMeshData(
    url: string,
    targetMaxDim = 1.0
  ): Promise<{ geometry: THREE.BufferGeometry; material: THREE.Material } | null> {
    const clone = await this.loadModelClone(url, targetMaxDim);
    if (!clone) return null;

    clone.updateMatrixWorld(true);
    let foundMesh: THREE.Mesh | null = null;
    clone.traverse((obj) => {
      if (!foundMesh && (obj as THREE.Mesh).isMesh) {
        foundMesh = obj as THREE.Mesh;
      }
    });
    if (!foundMesh) return null;

    const mesh = foundMesh as THREE.Mesh;
    const bakedGeo = mesh.geometry.clone();
    bakedGeo.userData = { ...bakedGeo.userData, sharedAsset: false };
    bakedGeo.applyMatrix4(mesh.matrixWorld);
    bakedGeo.computeBoundingSphere();

    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    return { geometry: bakedGeo, material: mat };
  }

  /**
   * Loads and caches a local 1K PBR texture set (diffuse in sRGB, normal & roughness in linear space).
   */
  public loadPbrTextureSet(
    basePath: string,
    prefix: string,
    repeat = 1,
    anisotropy = 4
  ): Promise<PbrTextureSet | null> {
    const key = `${basePath}/${prefix}:${repeat}`;
    if (!this.textureSetCache.has(key)) {
      const loadTex = (path: string, isColor: boolean) =>
        new Promise<THREE.Texture>((resolve, reject) => {
          this.textureLoader.load(
            path,
            (tex) => {
              tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
              tex.wrapS = THREE.RepeatWrapping;
              tex.wrapT = THREE.RepeatWrapping;
              tex.repeat.set(repeat, repeat);
              tex.anisotropy = anisotropy;
              tex.userData.sharedAsset = true;
              tex.needsUpdate = true;
              resolve(tex);
            },
            undefined,
            reject
          );
        });

      const promise = Promise.all([
        loadTex(`${basePath}/${prefix}_diff_1k.jpg`, true),
        loadTex(`${basePath}/${prefix}_nor_gl_1k.jpg`, false),
        loadTex(`${basePath}/${prefix}_rough_1k.jpg`, false),
      ])
        .then(([map, normalMap, roughnessMap]) => ({ map, normalMap, roughnessMap }))
        .catch(() => null);

      this.textureSetCache.set(key, promise);
    }

    return this.textureSetCache.get(key)!;
  }
}

export const assetManager = new AssetManager();
