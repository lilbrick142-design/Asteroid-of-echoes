import * as THREE from 'three';
import { SongItem } from '../types';
import { ExperienceFrameState, ExperienceSceneHandles, ISongExperience } from './types';
import { assetManager } from '../services/assetManager';
import { qualitySettings } from '../services/qualitySettings';
import {
  AnimatedRoseRig,
  createAnimatedRoseRig,
  createRoseSharedResources,
  createSculptedPetalGeometry,
  createSoftGlowTexture,
  disposeObject3DTree,
  disposeRoseSharedResources,
  RoseSharedResources,
} from './utils/proceduralShapes';

// Pre-allocated math helpers for zero-GC update loop
const _tmpMatrix = new THREE.Matrix4();
const _tmpPos = new THREE.Vector3();
const _tmpQuat = new THREE.Quaternion();
const _tmpEuler = new THREE.Euler();
const _tmpScale = new THREE.Vector3();

const _warmFog = new THREE.Color(0x210d28);
const _warmSun = new THREE.Color(0xffd7a8);
const _warmAmbient = new THREE.Color(0x572644);
const _warmHemiSky = new THREE.Color(0xffb5c2);
const _warmHemiGround = new THREE.Color(0x3a1c2e);
const _warmCyan = new THREE.Color(0xa2d2ff);
const _warmPink = new THREE.Color(0xffb703);
const _gardenIsland = new THREE.Color(0x4c2b3f);
const _gardenEmissive = new THREE.Color(0x2d1024);
const _gardenPath = new THREE.Color(0xd94e75);

interface GroundRoseEntry {
  rig: AnimatedRoseRig;
  x: number;
  z: number;
  baseY: number;
  targetScale: number;
  delay: number;
  bloomDuration: number;
  swayPhase: number;
  tiltX: number;
  tiltZ: number;
}

interface FloatingIslandEntry {
  group: THREE.Group;
  orbitAngle: number;
  orbitRadius: number;
  orbitSpeed: number;
  baseY: number;
  bobPhase: number;
  roses: AnimatedRoseRig[];
}

interface SkyRoseEntry {
  rig: AnimatedRoseRig;
  basePos: THREE.Vector3;
  orbitSpeed: number;
  bobSpeed: number;
  bobAmp: number;
  rotSpeedY: number;
  phase: number;
  baseScale: number;
}

interface PetalParticle {
  x: number;
  y: number;
  z: number;
  fallSpeed: number;
  spiralRadius: number;
  spiralSpeed: number;
  phase: number;
  rotSpeedX: number;
  rotSpeedY: number;
  rotSpeedZ: number;
  scaleX: number;
  scaleY: number;
}

interface WishingComet {
  headGroup: THREE.Group;
  trailMesh: THREE.Points;
  trailPositions: Float32Array;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  cycleOffset: number;
  cycleDuration: number;
  arcHeight: number;
}

export class CelestialGardenExperience implements ISongExperience {
  public readonly song: SongItem;
  public readonly rootGroup = new THREE.Group();

  private roseResources: RoseSharedResources | null = null;
  private sharedDriftPetalGeo: THREE.BufferGeometry | null = null;
  private glowSpriteTex: THREE.Texture | null = null;
  private isDisposed = false;

  private groundRoses: GroundRoseEntry[] = [];
  private floatingIslands: FloatingIslandEntry[] = [];
  private skyRoses: SkyRoseEntry[] = [];
  private smallGlowBlossoms: THREE.InstancedMesh | null = null;
  private glowBlossomData: { x: number; y: number; z: number; phase: number; scale: number; delay: number }[] = [];

  private petalInstanced: THREE.InstancedMesh | null = null;
  private petalsData: PetalParticle[] = [];
  private pollenPoints: THREE.Points | null = null;
  private pollenBasePos: Float32Array | null = null;
  private comets: WishingComet[] = [];

  constructor(song: SongItem) {
    this.song = song;
    this.rootGroup.name = 'experience_celestial_garden';
  }

  public enter(handles: ExperienceSceneHandles): void {
    this.roseResources = createRoseSharedResources();
    this.sharedDriftPetalGeo = createSculptedPetalGeometry(0.28, 0.34, 0.11, 0.08);
    this.glowSpriteTex = createSoftGlowTexture(96);

    const density = qualitySettings.getPreset().particleDensity;

    // 1. Staggered Organic Rose Garden across the Asteroid Surface (3 distinct botanical varieties)
    const groundCount = Math.round((Number(this.song.experienceParams.groundFlowersCount) || 44) * Math.max(0.7, density));
    for (let i = 0; i < groundCount; i++) {
      // Phyllotaxis spiral distribution with organic jitter so flowers bloom in natural waves
      const spiralAngle = i * 2.39996 + (Math.random() - 0.5) * 0.35;
      const radius = 2.8 + Math.sqrt((i + 0.5) / groundCount) * 14.2;
      const x = Math.cos(spiralAngle) * radius;
      const z = Math.sin(spiralAngle) * radius;
      const baseY = Math.sin(x * 0.35) * Math.cos(z * 0.35) * 0.14;

      const variety = i % 3;
      const stemHeight = 0.72 + (i % 5) * 0.12 + Math.random() * 0.18;
      const rig = createAnimatedRoseRig(this.roseResources, variety, stemHeight, i * 1.37);
      rig.root.position.set(x, baseY, z);
      rig.root.scale.setScalar(0.001);
      this.rootGroup.add(rig.root);

      // Organic blooming wave: inner flowers awaken early, outer rim & clusters continue blooming over 16s
      const delay = 0.25 + (radius / 17) * 9.0 + Math.random() * 4.5;
      this.groundRoses.push({
        rig,
        x,
        z,
        baseY,
        targetScale: 0.78 + Math.random() * 0.52,
        delay,
        bloomDuration: 3.6 + Math.random() * 2.2,
        swayPhase: Math.random() * Math.PI * 2,
        tiltX: 0,
        tiltZ: 0,
      });
    }

    // 2. Small Glowing Celestial Ground Blossoms (InstancedMesh)
    const glowBlossomCount = Math.round(75 * density);
    const starFlowerGeo = new THREE.OctahedronGeometry(0.14, 1);
    starFlowerGeo.scale(1.2, 0.6, 1.2);
    const starFlowerMat = new THREE.MeshStandardMaterial({
      color: 0xffe5ec,
      emissive: 0xffb5c2,
      emissiveIntensity: 1.3,
      roughness: 0.3,
    });
    const glowInstanced = new THREE.InstancedMesh(starFlowerGeo, starFlowerMat, glowBlossomCount);
    glowInstanced.frustumCulled = false;

    const blossomColors = [
      new THREE.Color(0xffcad4),
      new THREE.Color(0xffd166),
      new THREE.Color(0xe0aaff),
      new THREE.Color(0xa2d2ff),
    ];
    for (let i = 0; i < glowBlossomCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2.6 + Math.random() * 14.8;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.sin(x * 0.35) * Math.cos(z * 0.35) * 0.14 + 0.18;
      this.glowBlossomData.push({
        x,
        y,
        z,
        phase: Math.random() * Math.PI * 2,
        scale: 0.6 + Math.random() * 0.9,
        delay: 0.8 + Math.random() * 8.0,
      });
      glowInstanced.setColorAt(i, blossomColors[i % blossomColors.length]);
    }
    if (glowInstanced.instanceColor) glowInstanced.instanceColor.needsUpdate = true;
    this.smallGlowBlossoms = glowInstanced;
    this.rootGroup.add(glowInstanced);

    // 3. Floating Celestial Flower Islands with Hanging Vines & Rose Clusters
    const vineMat = new THREE.MeshStandardMaterial({
      color: 0x3b7a57,
      emissive: 0x1b4332,
      emissiveIntensity: 0.25,
      roughness: 0.7,
    });
    const vineBeadMat = new THREE.MeshBasicMaterial({ color: 0xffd6e0 });
    const fallbackIslandMat = new THREE.MeshStandardMaterial({
      color: 0x453052,
      roughness: 0.82,
      flatShading: true,
    });

    const islandSpecs = [
      { angle: 0.65, radius: 24, y: 4.5, speed: 0.035 },
      { angle: 2.65, radius: 27, y: 6.2, speed: -0.028 },
      { angle: 4.55, radius: 23, y: 5.0, speed: 0.032 },
    ];

    islandSpecs.forEach((spec, idx) => {
      const islandGroup = new THREE.Group();
      islandGroup.position.set(
        Math.cos(spec.angle) * spec.radius,
        spec.y,
        Math.sin(spec.angle) * spec.radius
      );

      // Base crag (augmented asynchronously by CC0 Poly Haven moon_rock_02!)
      const rockFallback = new THREE.Mesh(
        new THREE.DodecahedronGeometry(2.1, 1),
        fallbackIslandMat
      );
      rockFallback.scale.set(1.25, 0.6, 1.15);
      islandGroup.add(rockFallback);

      // Hanging glowing botanical vines beneath the floating island
      for (let v = 0; v < 5; v++) {
        const va = (v / 5) * Math.PI * 2 + idx;
        const vx = Math.cos(va) * 1.15;
        const vz = Math.sin(va) * 1.05;
        const vLen = 2.0 + (v % 3) * 0.9;
        const vineCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(vx, -0.35, vz),
          new THREE.Vector3(vx * 1.08, -vLen * 0.5, vz * 0.92),
          new THREE.Vector3(vx * 0.95, -vLen, vz * 1.08),
        ]);
        const vineMesh = new THREE.Mesh(
          new THREE.TubeGeometry(vineCurve, 8, 0.025, 5, false),
          vineMat
        );
        islandGroup.add(vineMesh);

        // Blossom bead at vine tip
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), vineBeadMat);
        bead.position.copy(vineCurve.getPoint(1));
        islandGroup.add(bead);
      }

      // Blooming rose cluster crowning the floating island
      const islandRoses: AnimatedRoseRig[] = [];
      for (let rIdx = 0; rIdx < 3; rIdx++) {
        const ra = (rIdx / 3) * Math.PI * 2;
        const rig = createAnimatedRoseRig(this.roseResources!, (idx + rIdx) % 3, 0.85, idx + rIdx);
        rig.root.position.set(Math.cos(ra) * 0.75, 0.62, Math.sin(ra) * 0.75);
        rig.root.scale.setScalar(1.05);
        islandGroup.add(rig.root);
        islandRoses.push(rig);
      }

      this.rootGroup.add(islandGroup);
      this.floatingIslands.push({
        group: islandGroup,
        orbitAngle: spec.angle,
        orbitRadius: spec.radius,
        orbitSpeed: spec.speed,
        baseY: spec.y,
        bobPhase: idx * 1.8,
        roses: islandRoses,
      });

      // Async enhance floating island with real CC0 Poly Haven boulder, Empodium flower & Fern
      Promise.all([
        assetManager.loadModelClone('/assets/models/moon_rock_02/moon_rock_02_1k.gltf', 4.2),
        assetManager.loadModelClone('/assets/models/flower_empodium/flower_empodium_1k.gltf', 1.3),
        assetManager.loadModelClone('/assets/models/fern_02/fern_02_1k.gltf', 1.5),
      ]).then(([rockClone, flowerClone, fernClone]) => {
        if (this.isDisposed) return;
        if (rockClone) {
          rockClone.position.set(0, -1.1, 0);
          rockClone.userData.sharedAsset = true;
          rockClone.traverse((o) => { o.userData.sharedAsset = true; });
          islandGroup.remove(rockFallback);
          islandGroup.add(rockClone);
        }
        if (flowerClone) {
          flowerClone.position.set(-0.5, 0.65, 0.45);
          flowerClone.userData.sharedAsset = true;
          flowerClone.traverse((o) => { o.userData.sharedAsset = true; });
          islandGroup.add(flowerClone);
        }
        if (fernClone) {
          fernClone.position.set(0.55, 0.55, -0.35);
          fernClone.userData.sharedAsset = true;
          fernClone.traverse((o) => { o.userData.sharedAsset = true; });
          islandGroup.add(fernClone);
        }
      });
    });

    // 4. Async CC0 Botanical Wildflowers & Ferns nestled around the asteroid perimeter boulders
    this.populatePerimeterBotanicals();

    // 5. Sky Full of Orbiting Sculpted 3D Roses (near & far celestial bloom clusters)
    const skyRoseCount = Math.round((Number(this.song.experienceParams.skyRosesCount) || 28) * Math.max(0.75, density));
    for (let i = 0; i < skyRoseCount; i++) {
      const angle = (i / skyRoseCount) * Math.PI * 2 + Math.random() * 0.35;
      const radius = 10 + Math.random() * 24;
      const y = 4.2 + Math.random() * 14.5;
      const rig = createAnimatedRoseRig(this.roseResources, (i + 1) % 3, 0.42, i * 2.1);
      rig.root.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
      rig.root.scale.setScalar(0.001);
      this.rootGroup.add(rig.root);

      this.skyRoses.push({
        rig,
        basePos: rig.root.position.clone(),
        orbitSpeed: 0.032 + Math.random() * 0.04,
        bobSpeed: 0.65 + Math.random() * 0.55,
        bobAmp: 0.45 + Math.random() * 0.45,
        rotSpeedY: (Math.random() - 0.5) * 0.35,
        phase: Math.random() * Math.PI * 2,
        baseScale: 0.8 + Math.random() * 0.8,
      });
    }

    // 6. Dedicated Instanced Floating Petal Particle System (wind + spiral + player swirl)
    const petalCount = Math.round(260 * density);
    const petalInstMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0x6b1d35,
      emissiveIntensity: 0.32,
      roughness: 0.46,
      sheen: 0.7,
      sheenColor: new THREE.Color(0xffe5ec),
      side: THREE.DoubleSide,
    });
    const instanced = new THREE.InstancedMesh(this.sharedDriftPetalGeo, petalInstMat, petalCount);
    instanced.frustumCulled = false;

    const petalColors = [
      new THREE.Color(0xff4d6d),
      new THREE.Color(0xff8fa3),
      new THREE.Color(0xffccd5),
      new THREE.Color(0xffd6a5),
      new THREE.Color(0xe0aaff),
    ];

    for (let i = 0; i < petalCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 26;
      this.petalsData.push({
        x: Math.cos(a) * r,
        y: 1.0 + Math.random() * 17,
        z: Math.sin(a) * r,
        fallSpeed: 0.32 + Math.random() * 0.55,
        spiralRadius: 0.6 + Math.random() * 1.4,
        spiralSpeed: 0.55 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
        rotSpeedX: (Math.random() - 0.5) * 1.6,
        rotSpeedY: (Math.random() - 0.5) * 1.8,
        rotSpeedZ: (Math.random() - 0.5) * 1.2,
        scaleX: 0.45 + Math.random() * 0.65,
        scaleY: 0.45 + Math.random() * 0.75,
      });
      instanced.setColorAt(i, petalColors[i % petalColors.length]);
    }
    if (instanced.instanceColor) instanced.instanceColor.needsUpdate = true;
    this.petalInstanced = instanced;
    this.rootGroup.add(instanced);

    // 7. Gentle Blooming Pollen & Sparkle Dust
    const pollenCount = Math.round(180 * density);
    const pollenPos = new Float32Array(pollenCount * 3);
    for (let i = 0; i < pollenCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 17;
      pollenPos[i * 3] = Math.cos(a) * r;
      pollenPos[i * 3 + 1] = 0.4 + Math.random() * 7.5;
      pollenPos[i * 3 + 2] = Math.sin(a) * r;
    }
    this.pollenBasePos = new Float32Array(pollenPos);
    const pollenGeo = new THREE.BufferGeometry();
    pollenGeo.setAttribute('position', new THREE.BufferAttribute(pollenPos, 3));
    this.pollenPoints = new THREE.Points(
      pollenGeo,
      new THREE.PointsMaterial({
        size: 0.34,
        map: this.glowSpriteTex,
        color: 0xffdf9e,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rootGroup.add(this.pollenPoints);

    // 8. Wishing Comets with Glowing Sprite Halos & Sparkling Trails
    const cometCount = Number(this.song.experienceParams.cometCount) || 4;
    const cometCoreGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const cometHaloGeo = new THREE.SphereGeometry(0.85, 12, 12);

    for (let i = 0; i < cometCount; i++) {
      const headGroup = new THREE.Group();
      headGroup.add(new THREE.Mesh(cometCoreGeo, new THREE.MeshBasicMaterial({ color: 0xfff8e7 })));
      headGroup.add(
        new THREE.Mesh(
          cometHaloGeo,
          new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0xffd166 : 0xffafcc,
            transparent: true,
            opacity: 0.36,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        )
      );
      this.rootGroup.add(headGroup);

      const trailCount = 36;
      const trailPositions = new Float32Array(trailCount * 3);
      const trailColors = new Float32Array(trailCount * 3);
      for (let t = 0; t < trailCount; t++) {
        const fade = Math.pow(1 - t / trailCount, 1.3);
        trailColors[t * 3] = 1.0 * fade;
        trailColors[t * 3 + 1] = (0.76 + 0.22 * fade) * fade;
        trailColors[t * 3 + 2] = (0.65 + 0.3 * fade) * fade;
      }

      const trailGeo = new THREE.BufferGeometry();
      trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
      trailGeo.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));

      const trailMat = new THREE.PointsMaterial({
        size: 0.42,
        map: this.glowSpriteTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const trailMesh = new THREE.Points(trailGeo, trailMat);
      trailMesh.frustumCulled = false;
      this.rootGroup.add(trailMesh);

      const side = i % 2 === 0 ? 1 : -1;
      this.comets.push({
        headGroup,
        trailMesh,
        trailPositions,
        startPos: new THREE.Vector3(-44 * side, 11 + i * 2.8, -26 - i * 4),
        endPos: new THREE.Vector3(44 * side, 16 + i * 2.2, 18 - i * 6),
        cycleOffset: i * 2.4,
        cycleDuration: 9.0 + i * 1.1,
        arcHeight: 7.5 + i * 1.6,
      });
    }

    handles.scene.add(this.rootGroup);
  }

  private async populatePerimeterBotanicals() {
    const [empodium, fern, sorrel] = await Promise.all([
      assetManager.loadModelClone('/assets/models/flower_empodium/flower_empodium_1k.gltf', 1.25),
      assetManager.loadModelClone('/assets/models/fern_02/fern_02_1k.gltf', 1.45),
      assetManager.loadModelClone('/assets/models/shrub_sorrel_01/shrub_sorrel_01_1k.gltf', 1.2),
    ]);
    if (this.isDisposed) return;

    const ringCount = 12;
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2 + 0.18;
      const r = 13.5 + (i % 3) * 1.8;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      const y = Math.sin(x * 0.35) * Math.cos(z * 0.35) * 0.14;

      const template = i % 3 === 0 ? empodium : i % 3 === 1 ? fern : sorrel;
      if (!template) continue;

      const clone = template.clone(true);
      clone.position.set(x, y, z);
      clone.rotation.y = a + Math.PI;
      clone.scale.setScalar(0.85 + (i % 3) * 0.2);
      clone.userData.sharedAsset = true;
      clone.traverse((o) => { o.userData.sharedAsset = true; });
      this.rootGroup.add(clone);
    }
  }

  public update(frame: ExperienceFrameState, handles: ExperienceSceneHandles): void {
    const { delta, elapsed, experienceElapsed, transitionAlpha } = frame;
    const {
      baseline,
      fog,
      ambientLight,
      hemiLight,
      sunLight,
      cyanLight,
      pinkLight,
      islandMesh,
      pathMesh,
      playerPosRef,
    } = handles;

    // Warm golden, rose-pink & celestial blue lighting
    fog.color.copy(baseline.fogColor).lerp(_warmFog, transitionAlpha);
    ambientLight.color.copy(baseline.ambientColor).lerp(_warmAmbient, transitionAlpha);
    ambientLight.intensity = THREE.MathUtils.lerp(baseline.ambientIntensity, 1.38, transitionAlpha);
    hemiLight.color.copy(baseline.hemiSkyColor).lerp(_warmHemiSky, transitionAlpha);
    hemiLight.groundColor.copy(baseline.hemiGroundColor).lerp(_warmHemiGround, transitionAlpha);
    hemiLight.intensity = THREE.MathUtils.lerp(baseline.hemiIntensity, 1.2, transitionAlpha);

    sunLight.color.copy(baseline.sunColor).lerp(_warmSun, transitionAlpha);
    sunLight.intensity = THREE.MathUtils.lerp(baseline.sunIntensity, 1.9, transitionAlpha);
    cyanLight.color.copy(baseline.cyanLightColor).lerp(_warmCyan, transitionAlpha);
    pinkLight.color.copy(baseline.pinkLightColor).lerp(_warmPink, transitionAlpha);

    const islandMat = islandMesh.material as THREE.MeshStandardMaterial;
    islandMat.color.copy(baseline.islandColor).lerp(_gardenIsland, transitionAlpha);
    islandMat.emissive.copy(baseline.islandEmissive).lerp(_gardenEmissive, transitionAlpha);
    islandMat.emissiveIntensity = THREE.MathUtils.lerp(baseline.islandEmissiveIntensity, 0.35, transitionAlpha);

    const pathMat = pathMesh.material as THREE.MeshStandardMaterial;
    pathMat.color.copy(baseline.pathColor).lerp(_gardenPath, transitionAlpha);
    pathMat.emissive.copy(baseline.pathEmissive).lerp(_warmPink, transitionAlpha);

    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;

    // 1. Update Ground Roses: staggered bud-to-flower petal unfolding + player proximity reaction
    for (let i = 0; i < this.groundRoses.length; i++) {
      const f = this.groundRoses[i];
      const rawGrow = THREE.MathUtils.clamp((experienceElapsed - f.delay) / f.bloomDuration, 0, 1);
      const easeGrow = rawGrow * rawGrow * (3 - 2 * rawGrow);

      f.rig.setBloomProgress(easeGrow);
      const scaleVal = f.targetScale * THREE.MathUtils.smoothstep(rawGrow, 0, 0.25) * transitionAlpha;
      f.rig.root.scale.setScalar(Math.max(0.001, scaleVal));

      const dx = f.x - px;
      const dz = f.z - pz;
      const dist = Math.hypot(dx, dz);

      let targetTiltX = Math.sin(elapsed * 1.25 + f.swayPhase) * 0.06;
      let targetTiltZ = Math.cos(elapsed * 1.05 + f.swayPhase) * 0.06;

      if (dist < 3.6 && dist > 0.05) {
        const push = (1 - dist / 3.6) * 0.58;
        targetTiltZ -= (dx / dist) * push;
        targetTiltX += (dz / dist) * push;
      }

      f.tiltX = THREE.MathUtils.damp(f.tiltX, targetTiltX, 6, delta);
      f.tiltZ = THREE.MathUtils.damp(f.tiltZ, targetTiltZ, 6, delta);
      f.rig.root.rotation.set(f.tiltX, f.swayPhase, f.tiltZ);
      f.rig.bloomGroup.rotation.y = elapsed * 0.14 + f.swayPhase;
    }

    // 2. Small glowing ground blossoms
    if (this.smallGlowBlossoms) {
      for (let i = 0; i < this.glowBlossomData.length; i++) {
        const b = this.glowBlossomData[i];
        const grow = THREE.MathUtils.smoothstep(experienceElapsed, b.delay, b.delay + 1.8);
        const pulse = 0.85 + 0.18 * Math.sin(elapsed * 2.2 + b.phase);
        _tmpPos.set(b.x, b.y, b.z);
        _tmpEuler.set(0, elapsed * 0.4 + b.phase, 0);
        _tmpQuat.setFromEuler(_tmpEuler);
        _tmpScale.setScalar(Math.max(0.001, b.scale * grow * pulse * transitionAlpha));
        _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
        this.smallGlowBlossoms.setMatrixAt(i, _tmpMatrix);
      }
      this.smallGlowBlossoms.instanceMatrix.needsUpdate = true;
    }

    // 3. Orbiting Floating Flower Islands
    for (let i = 0; i < this.floatingIslands.length; i++) {
      const isl = this.floatingIslands[i];
      const ang = isl.orbitAngle + elapsed * isl.orbitSpeed;
      isl.group.position.set(
        Math.cos(ang) * isl.orbitRadius,
        isl.baseY + Math.sin(elapsed * 0.65 + isl.bobPhase) * 0.55,
        Math.sin(ang) * isl.orbitRadius
      );
      isl.group.rotation.y = -ang + Math.PI * 0.5;
      isl.group.scale.setScalar(Math.max(0.001, transitionAlpha));

      const islandBloom = THREE.MathUtils.smoothstep(experienceElapsed, 1.0 + i * 1.2, 5.5 + i * 1.2);
      for (let r = 0; r < isl.roses.length; r++) {
        isl.roses[r].setBloomProgress(islandBloom);
      }
    }

    // 4. Sky Roses unfolding & drifting through space
    for (let i = 0; i < this.skyRoses.length; i++) {
      const sr = this.skyRoses[i];
      const appear = THREE.MathUtils.clamp((experienceElapsed - i * 0.22) / 2.6, 0, 1);
      sr.rig.setBloomProgress(0.35 + 0.65 * appear);
      sr.rig.root.scale.setScalar(Math.max(0.001, sr.baseScale * appear * transitionAlpha));

      const angle = elapsed * sr.orbitSpeed;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      sr.rig.root.position.set(
        sr.basePos.x * cosA - sr.basePos.z * sinA,
        sr.basePos.y + Math.sin(elapsed * sr.bobSpeed + sr.phase) * sr.bobAmp,
        sr.basePos.x * sinA + sr.basePos.z * cosA
      );
      sr.rig.root.rotation.y += sr.rotSpeedY * delta;
      sr.rig.root.rotation.x = Math.sin(elapsed * 0.55 + sr.phase) * 0.28;
    }

    // 5. Spiraling Instanced Rose Petals with subtle wind currents & astronaut swirl reaction
    if (this.petalInstanced) {
      const windX = Math.sin(elapsed * 0.35) * 0.45;
      const windZ = Math.cos(elapsed * 0.28) * 0.35;

      for (let i = 0; i < this.petalsData.length; i++) {
        const p = this.petalsData[i];
        p.y -= p.fallSpeed * delta;
        if (p.y < 0.15) {
          p.y = 16.0 + Math.random() * 2.5;
        }

        const spiralAngle = elapsed * p.spiralSpeed + p.phase;
        let wx = p.x + Math.sin(spiralAngle) * p.spiralRadius + windX * Math.sin(elapsed * 0.5 + i);
        let wz = p.z + Math.cos(spiralAngle) * p.spiralRadius + windZ * Math.cos(elapsed * 0.5 + i);

        // Subtle swirl deflection near moving player
        const dx = wx - px;
        const dz = wz - pz;
        const dSq = dx * dx + dz * dz;
        if (dSq < 12.0 && dSq > 0.04 && p.y < 3.5) {
          const d = Math.sqrt(dSq);
          const force = (1 - d / 3.5) * 0.85;
          wx += (dx / d - dz / d) * force;
          wz += (dz / d + dx / d) * force;
        }

        _tmpPos.set(wx, p.y, wz);
        _tmpEuler.set(
          elapsed * p.rotSpeedX + p.phase,
          elapsed * p.rotSpeedY,
          elapsed * p.rotSpeedZ + Math.sin(elapsed + p.phase) * 0.5
        );
        _tmpQuat.setFromEuler(_tmpEuler);
        _tmpScale.set(p.scaleX * transitionAlpha, p.scaleY * transitionAlpha, p.scaleX * transitionAlpha);
        _tmpMatrix.compose(_tmpPos, _tmpQuat, _tmpScale);
        this.petalInstanced.setMatrixAt(i, _tmpMatrix);
      }
      this.petalInstanced.instanceMatrix.needsUpdate = true;
    }

    // 6. Rising blooming pollen sparkle particles
    if (this.pollenPoints && this.pollenBasePos) {
      const arr = this.pollenPoints.geometry.attributes.position.array as Float32Array;
      const count = arr.length / 3;
      for (let i = 0; i < count; i++) {
        const baseY = this.pollenBasePos[i * 3 + 1];
        arr[i * 3 + 1] = ((baseY + elapsed * 0.35) % 8.5) + 0.25;
        arr[i * 3] = this.pollenBasePos[i * 3] + Math.sin(elapsed * 0.9 + i) * 0.35;
      }
      this.pollenPoints.geometry.attributes.position.needsUpdate = true;
      (this.pollenPoints.material as THREE.PointsMaterial).opacity = 0.72 * transitionAlpha;
    }

    // 7. Wishing Comets
    for (let i = 0; i < this.comets.length; i++) {
      const c = this.comets[i];
      const rawT = ((experienceElapsed + c.cycleOffset) % c.cycleDuration) / c.cycleDuration;
      const activeWindow = 0.58;
      const visible = rawT < activeWindow && transitionAlpha > 0.15;

      c.headGroup.visible = visible;
      c.trailMesh.visible = visible;

      if (visible) {
        const u = rawT / activeWindow;
        const len = c.trailPositions.length / 3;
        for (let t = 0; t < len; t++) {
          const lag = Math.max(0, u - t * 0.0095);
          const x = THREE.MathUtils.lerp(c.startPos.x, c.endPos.x, lag);
          const z = THREE.MathUtils.lerp(c.startPos.z, c.endPos.z, lag);
          const y =
            THREE.MathUtils.lerp(c.startPos.y, c.endPos.y, lag) +
            Math.sin(lag * Math.PI) * c.arcHeight;

          if (t === 0) {
            c.headGroup.position.set(x, y, z);
            c.headGroup.scale.setScalar(transitionAlpha);
          }
          const jitter = (t / len) * 0.14;
          c.trailPositions[t * 3] = x + Math.sin(t * 7 + elapsed * 10) * jitter;
          c.trailPositions[t * 3 + 1] = y + Math.cos(t * 5 + elapsed * 8) * jitter;
          c.trailPositions[t * 3 + 2] = z;
        }
        c.trailMesh.geometry.attributes.position.needsUpdate = true;
      }
    }
  }

  public dispose(handles: ExperienceSceneHandles): void {
    this.isDisposed = true;
    handles.scene.remove(this.rootGroup);
    disposeObject3DTree(this.rootGroup);
    if (this.roseResources) {
      disposeRoseSharedResources(this.roseResources);
      this.roseResources = null;
    }
    if (this.sharedDriftPetalGeo) {
      this.sharedDriftPetalGeo.dispose();
      this.sharedDriftPetalGeo = null;
    }
    if (this.glowSpriteTex) {
      this.glowSpriteTex.dispose();
      this.glowSpriteTex = null;
    }
    this.groundRoses = [];
    this.floatingIslands = [];
    this.skyRoses = [];
    this.glowBlossomData = [];
    this.smallGlowBlossoms = null;
    this.petalsData = [];
    this.pollenPoints = null;
    this.pollenBasePos = null;
    this.comets = [];
    this.petalInstanced = null;
  }
}
