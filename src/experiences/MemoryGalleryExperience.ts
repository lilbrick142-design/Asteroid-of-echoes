import * as THREE from 'three';
import { MemoryPhotoItem, SongItem } from '../types';
import { loadMemoryGalleryItems } from '../data/memories';
import {
  CameraOverrideTarget,
  ExperienceFrameState,
  ExperienceSceneHandles,
  ISongExperience,
} from './types';
import {
  createMemoryPlaceholderTexture,
  disposeObject3DTree,
} from './utils/proceduralShapes';

// Pre-allocated math helpers
const _galleryFog = new THREE.Color(0x181020);
const _galleryAmbient = new THREE.Color(0x4c374b);
const _galleryHemiSky = new THREE.Color(0xffcdb2);
const _galleryHemiGround = new THREE.Color(0x2a1b2d);
const _gallerySun = new THREE.Color(0xffe5d9);
const _galleryCyan = new THREE.Color(0xffcdb2);
const _galleryPink = new THREE.Color(0xe5989b);
const _galleryIsland = new THREE.Color(0x3a283e);
const _galleryPath = new THREE.Color(0xe5989b);

const _camGoalPos = new THREE.Vector3();
const _camGoalLook = new THREE.Vector3();
const _frameForward = new THREE.Vector3();
const _frameWorldPos = new THREE.Vector3();

interface GalleryFrameNode {
  memory: MemoryPhotoItem;
  group: THREE.Group;
  frameHitMesh: THREE.Mesh;
  photoMesh: THREE.Mesh;
  borderMeshes: THREE.Mesh[];
  glowMesh: THREE.Mesh;
  pointLight: THREE.PointLight;
  baseAngle: number;
  baseRadius: number;
  baseHeight: number;
  bobPhase: number;
  currentScale: number;
  currentLift: number;
  aspectRatio: number;
}

export class MemoryGalleryExperience implements ISongExperience {
  public readonly song: SongItem;
  public readonly rootGroup = new THREE.Group();

  private frames: GalleryFrameNode[] = [];
  private memoryParticles: THREE.Points | null = null;
  private isDisposed = false;
  private nearbyFrame: GalleryFrameNode | null = null;
  private selectedFrame: GalleryFrameNode | null = null;
  private lastReportedNearbyId: string | null = null;

  constructor(song: SongItem) {
    this.song = song;
    this.rootGroup.name = 'experience_memory_gallery';
  }

  public enter(handles: ExperienceSceneHandles): void {
    // Soft ambient gallery stardust
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 19;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.8 + Math.random() * 8.5;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.memoryParticles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        color: 0xffcdb2,
        size: 0.2,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rootGroup.add(this.memoryParticles);
    handles.scene.add(this.rootGroup);

    // Lazy-load memory manifest on demand when experience activates
    const manifestPath = this.song.assetRefs?.memoryManifestPath || '/images/memories/manifest.json';
    loadMemoryGalleryItems(manifestPath).then((items) => {
      if (this.isDisposed) return;
      this.spawnGalleryFrames(items);
    });
  }

  private spawnGalleryFrames(items: MemoryPhotoItem[]) {
    const texLoader = new THREE.TextureLoader();

    const frameOuterMat = new THREE.MeshStandardMaterial({
      color: 0xe9d8c8,
      metalness: 0.55,
      roughness: 0.35,
    });
    const matBoardMat = new THREE.MeshStandardMaterial({
      color: 0xf8f4f0,
      roughness: 0.88,
      metalness: 0.02,
    });

    items.forEach((item, idx) => {
      const group = new THREE.Group();
      const baseAspect = item.aspectRatio || 4 / 3;
      const baseHeight = 2.0;
      const baseWidth = baseHeight * baseAspect;

      // Placeholder or real photograph texture
      const initialTex = createMemoryPlaceholderTexture(
        item.caption,
        item.isPlaceholder ? item.date : 'Loading memory...'
      );
      const photoMat = new THREE.MeshStandardMaterial({
        map: initialTex,
        roughness: 0.45,
        metalness: 0.05,
        emissive: 0x221720,
        emissiveIntensity: 0.15,
      });

      const photoGeo = new THREE.PlaneGeometry(baseWidth, baseHeight);
      const photoMesh = new THREE.Mesh(photoGeo, photoMat);
      photoMesh.position.z = 0.07;
      photoMesh.userData.memoryId = item.id;
      group.add(photoMesh);

      // Mat board backing
      const matGeo = new THREE.BoxGeometry(baseWidth + 0.28, baseHeight + 0.28, 0.08);
      const matMesh = new THREE.Mesh(matGeo, matBoardMat);
      matMesh.position.z = 0.02;
      group.add(matMesh);

      // 4 Beveled frame rails (top, bottom, left, right)
      const railThick = 0.11;
      const topRail = new THREE.Mesh(
        new THREE.BoxGeometry(baseWidth + 0.48, railThick, 0.16),
        frameOuterMat
      );
      topRail.position.set(0, baseHeight / 2 + 0.18, 0.03);

      const bottomRail = new THREE.Mesh(
        new THREE.BoxGeometry(baseWidth + 0.48, railThick, 0.16),
        frameOuterMat
      );
      bottomRail.position.set(0, -baseHeight / 2 - 0.18, 0.03);

      const leftRail = new THREE.Mesh(
        new THREE.BoxGeometry(railThick, baseHeight + 0.3, 0.16),
        frameOuterMat
      );
      leftRail.position.set(-baseWidth / 2 - 0.18, 0, 0.03);

      const rightRail = new THREE.Mesh(
        new THREE.BoxGeometry(railThick, baseHeight + 0.3, 0.16),
        frameOuterMat
      );
      rightRail.position.set(baseWidth / 2 + 0.18, 0, 0.03);

      group.add(topRail, bottomRail, leftRail, rightRail);

      // Subtle glowing halo behind frame
      const glowGeo = new THREE.PlaneGeometry(baseWidth + 1.1, baseHeight + 1.1);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xffcdb2,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.z = -0.08;
      group.add(glowMesh);

      const pLight = new THREE.PointLight(0xffcdb2, 0.85, 6);
      pLight.position.set(0, 0, 1.2);
      group.add(pLight);

      const total = items.length;
      const baseAngle = (idx / total) * Math.PI * 2;
      const baseRadius = 7.2 + (idx % 3) * 2.8;
      const heightY = 2.0 + (idx % 3) * 0.85;

      group.position.set(
        Math.cos(baseAngle) * baseRadius,
        heightY,
        Math.sin(baseAngle) * baseRadius
      );
      group.scale.setScalar(0.001);
      this.rootGroup.add(group);

      const node: GalleryFrameNode = {
        memory: { ...item, aspectRatio: baseAspect },
        group,
        frameHitMesh: photoMesh,
        photoMesh,
        borderMeshes: [matMesh, topRail, bottomRail, leftRail, rightRail],
        glowMesh,
        pointLight: pLight,
        baseAngle,
        baseRadius,
        baseHeight: heightY,
        bobPhase: idx * 1.1,
        currentScale: 1,
        currentLift: 0,
        aspectRatio: baseAspect,
      };
      this.frames.push(node);

      // Load real user photo if configured, preserving exact natural aspect ratio
      if (!item.isPlaceholder && item.src) {
        texLoader.load(
          item.src,
          (loadedTex) => {
            if (this.isDisposed) {
              loadedTex.dispose();
              return;
            }
            loadedTex.colorSpace = THREE.SRGBColorSpace;
            const img = loadedTex.image as { width?: number; height?: number } | undefined;
            const natW = img?.width || 4;
            const natH = img?.height || 3;
            const naturalAspect = THREE.MathUtils.clamp(natW / Math.max(1, natH), 0.45, 2.3);

            // Replace placeholder texture cleanly
            const oldMap = photoMat.map;
            photoMat.map = loadedTex;
            photoMat.needsUpdate = true;
            if (oldMap) oldMap.dispose();

            this.applyAspectRatio(node, naturalAspect);
          },
          undefined,
          () => {
            // Keep placeholder gracefully if user's image file isn't found
            const fallbackTex = createMemoryPlaceholderTexture(
              item.caption,
              'Photo not found in public/images/memories/'
            );
            const oldMap = photoMat.map;
            photoMat.map = fallbackTex;
            photoMat.needsUpdate = true;
            if (oldMap) oldMap.dispose();
          }
        );
      }
    });
  }

  private applyAspectRatio(node: GalleryFrameNode, aspect: number) {
    node.aspectRatio = aspect;
    node.memory = { ...node.memory, aspectRatio: aspect };
    const h = 2.0;
    const w = h * aspect;

    node.photoMesh.geometry.dispose();
    node.photoMesh.geometry = new THREE.PlaneGeometry(w, h);

    const [matMesh, topRail, bottomRail, leftRail, rightRail] = node.borderMeshes;
    matMesh.geometry.dispose();
    matMesh.geometry = new THREE.BoxGeometry(w + 0.28, h + 0.28, 0.08);

    const railThick = 0.11;
    topRail.geometry.dispose();
    topRail.geometry = new THREE.BoxGeometry(w + 0.48, railThick, 0.16);
    topRail.position.set(0, h / 2 + 0.18, 0.03);

    bottomRail.geometry.dispose();
    bottomRail.geometry = new THREE.BoxGeometry(w + 0.48, railThick, 0.16);
    bottomRail.position.set(0, -h / 2 - 0.18, 0.03);

    leftRail.geometry.dispose();
    leftRail.geometry = new THREE.BoxGeometry(railThick, h + 0.3, 0.16);
    leftRail.position.set(-w / 2 - 0.18, 0, 0.03);

    rightRail.geometry.dispose();
    rightRail.geometry = new THREE.BoxGeometry(railThick, h + 0.3, 0.16);
    rightRail.position.set(w / 2 + 0.18, 0, 0.03);

    node.glowMesh.geometry.dispose();
    node.glowMesh.geometry = new THREE.PlaneGeometry(w + 1.1, h + 1.1);
  }

  public update(frame: ExperienceFrameState, handles: ExperienceSceneHandles): void {
    const { delta, elapsed, transitionAlpha, experienceState } = frame;
    const { baseline, fog, ambientLight, hemiLight, sunLight, cyanLight, pinkLight, islandMesh, pathMesh, playerPosRef } = handles;

    fog.color.copy(baseline.fogColor).lerp(_galleryFog, transitionAlpha);
    ambientLight.color.copy(baseline.ambientColor).lerp(_galleryAmbient, transitionAlpha);
    ambientLight.intensity = THREE.MathUtils.lerp(baseline.ambientIntensity, 1.15, transitionAlpha);
    hemiLight.color.copy(baseline.hemiSkyColor).lerp(_galleryHemiSky, transitionAlpha);
    hemiLight.groundColor.copy(baseline.hemiGroundColor).lerp(_galleryHemiGround, transitionAlpha);
    sunLight.color.copy(baseline.sunColor).lerp(_gallerySun, transitionAlpha);
    cyanLight.color.copy(baseline.cyanLightColor).lerp(_galleryCyan, transitionAlpha);
    pinkLight.color.copy(baseline.pinkLightColor).lerp(_galleryPink, transitionAlpha);

    const islandMat = islandMesh.material as THREE.MeshStandardMaterial;
    islandMat.color.copy(baseline.islandColor).lerp(_galleryIsland, transitionAlpha);
    const pathMat = pathMesh.material as THREE.MeshStandardMaterial;
    pathMat.color.copy(baseline.pathColor).lerp(_galleryPath, transitionAlpha);

    // Sync selection state if closed via HUD button
    if (!experienceState.selectedMemory && this.selectedFrame) {
      this.selectedFrame = null;
    } else if (experienceState.selectedMemory && this.selectedFrame?.memory.id !== experienceState.selectedMemory.id) {
      const match = this.frames.find((f) => f.memory.id === experienceState.selectedMemory?.id) || null;
      this.selectedFrame = match;
    }

    const orbitSpeed = this.selectedFrame ? 0.0 : Number(this.song.experienceParams.orbitSpeed) || 0.06;
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;

    let closestNode: GalleryFrameNode | null = null;
    let closestDist = 4.6;

    for (let i = 0; i < this.frames.length; i++) {
      const f = this.frames[i];
      const angle = f.baseAngle + elapsed * orbitSpeed;
      const isSelected = this.selectedFrame?.memory.id === f.memory.id;

      const x = Math.cos(angle) * f.baseRadius;
      const z = Math.sin(angle) * f.baseRadius;
      const dist = Math.hypot(x - px, z - pz);

      if (dist < closestDist) {
        closestDist = dist;
        closestNode = f;
      }

      const isNear = dist < 4.6;
      const targetScale = isSelected ? 1.32 : isNear ? 1.2 : 1.0;
      const targetLift = isSelected ? 0.5 : isNear ? 0.2 : 0;

      f.currentScale = THREE.MathUtils.damp(f.currentScale, targetScale, 6, delta);
      f.currentLift = THREE.MathUtils.damp(f.currentLift, targetLift, 6, delta);

      const bobY = f.baseHeight + Math.sin(elapsed * 0.9 + f.bobPhase) * 0.25 + f.currentLift;
      f.group.position.set(x, bobY, z);
      f.group.scale.setScalar(Math.max(0.001, f.currentScale * transitionAlpha));

      // Gently face toward the player/center so photographs stay readable as you walk
      f.group.lookAt(px * 0.55, bobY * 0.9, pz * 0.55);

      (f.glowMesh.material as THREE.MeshBasicMaterial).opacity =
        (isSelected ? 0.45 : isNear ? 0.36 : 0.18) * transitionAlpha;
      f.pointLight.intensity = (isSelected ? 1.8 : isNear ? 1.4 : 0.7) * transitionAlpha;
    }

    this.nearbyFrame = closestNode;
    const nextNearbyId = closestNode ? closestNode.memory.id : null;
    if (nextNearbyId !== this.lastReportedNearbyId) {
      this.lastReportedNearbyId = nextNearbyId;
      handles.onNearbyMemoryChange(closestNode ? closestNode.memory : null);
    }

    if (this.memoryParticles) {
      this.memoryParticles.rotation.y = elapsed * 0.03;
      (this.memoryParticles.material as THREE.PointsMaterial).opacity = 0.72 * transitionAlpha;
    }
  }

  public getCameraOverride(): CameraOverrideTarget | null {
    if (!this.selectedFrame) return null;
    this.selectedFrame.group.getWorldPosition(_frameWorldPos);
    _frameForward.set(0, 0, 1).applyQuaternion(this.selectedFrame.group.quaternion).normalize();

    _camGoalPos.copy(_frameWorldPos).addScaledVector(_frameForward, 4.4);
    _camGoalPos.y += 0.15;
    _camGoalLook.copy(_frameWorldPos);

    return {
      position: _camGoalPos,
      lookAt: _camGoalLook,
      weight: 1.0,
    };
  }

  public onPointerClick(raycaster: THREE.Raycaster, handles: ExperienceSceneHandles): boolean {
    if (this.frames.length === 0) return false;
    const hitMeshes = this.frames.map((f) => f.frameHitMesh);
    const hits = raycaster.intersectObjects(hitMeshes, false);
    if (hits.length > 0) {
      const memId = hits[0].object.userData.memoryId as string;
      const found = this.frames.find((f) => f.memory.id === memId) || null;
      if (found) {
        this.selectedFrame = found;
        handles.onSelectMemory(found.memory);
        return true;
      }
    }
    return false;
  }

  public onInteract(handles: ExperienceSceneHandles): boolean {
    if (this.selectedFrame) {
      this.selectedFrame = null;
      handles.onSelectMemory(null);
      return true;
    }
    if (this.nearbyFrame) {
      this.selectedFrame = this.nearbyFrame;
      handles.onSelectMemory(this.nearbyFrame.memory);
      return true;
    }
    return false;
  }

  public dispose(handles: ExperienceSceneHandles): void {
    this.isDisposed = true;
    handles.onNearbyMemoryChange(null);
    handles.onSelectMemory(null);
    handles.scene.remove(this.rootGroup);
    disposeObject3DTree(this.rootGroup);
    this.frames = [];
    this.memoryParticles = null;
    this.nearbyFrame = null;
    this.selectedFrame = null;
  }
}
