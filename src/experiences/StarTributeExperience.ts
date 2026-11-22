import * as THREE from 'three';
import { SongItem } from '../types';
import { ExperienceFrameState, ExperienceSceneHandles, ISongExperience } from './types';
import { createSoftGlowTexture, disposeObject3DTree } from './utils/proceduralShapes';

// Pre-allocated math helpers
const _nurseryFog = new THREE.Color(0x040511);
const _nurseryAmbient = new THREE.Color(0x1f1936);
const _nurseryHemiSky = new THREE.Color(0x8ecae6);
const _nurseryHemiGround = new THREE.Color(0x0d0b1a);
const _nurserySun = new THREE.Color(0xffe19c);
const _nurseryCyan = new THREE.Color(0x6bb8ff);
const _nurseryPink = new THREE.Color(0xf497b6);
const _nurseryIsland = new THREE.Color(0x1a1c30);
const _nurseryPath = new THREE.Color(0xc9934c);

const _nebulaColA = new THREE.Color(0x192a66);
const _nebulaColB = new THREE.Color(0x7c3aed);
const _nebulaColC = new THREE.Color(0xf4a261);

const _emberColor = new THREE.Color(0xff6b35);
const _ignitionColor = new THREE.Color(0xfffdf5);
const _tmpColor = new THREE.Color();

interface HeroStarBirth {
  group: THREE.Group;
  center: THREE.Vector3;
  coreMesh: THREE.Mesh;
  coronaSprite: THREE.Sprite;
  spikesGroup: THREE.Group;
  shockwaveRing: THREE.Mesh;
  finalColor: THREE.Color;
  birthStart: number; // normalized 0..1 songProgress
  birthSpan: number;
  baseScale: number;
  twinkleOffset: number;
}

interface AccretionParticle {
  starIdx: number;
  baseAngle: number;
  baseRadius: number;
  yOffset: number;
  orbitSpeed: number;
  tilt: number;
}

export class StarTributeExperience implements ISongExperience {
  public readonly song: SongItem;
  public readonly rootGroup = new THREE.Group();

  private glowTexture: THREE.CanvasTexture | null = null;
  private nebulaPlanes: THREE.Mesh[] = [];
  private nebulaUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
    uFlashBoost: { value: number };
  };

  private heroStars: HeroStarBirth[] = [];
  private accretionParticles: AccretionParticle[] = [];
  private accretionPoints: THREE.Points | null = null;
  private accretionPosArr: Float32Array | null = null;

  private minorStars: THREE.Points | null = null;
  private minorStarCount = 72;
  private minorThresholds: Float32Array = new Float32Array(72);

  private constellations: THREE.LineSegments | null = null;
  private ignitionLight: THREE.PointLight | null = null;

  constructor(song: SongItem) {
    this.song = song;
    this.rootGroup.name = 'experience_stellar_nursery';
    this.nebulaUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uFlashBoost: { value: 0 },
    };
  }

  public enter(handles: ExperienceSceneHandles): void {
    this.glowTexture = createSoftGlowTexture(128);
    this.glowTexture.userData.sharedAsset = false;

    // 1. Swirling 3D Layered Gas & Dust Nebulae (FBM Shader Clouds)
    const nebulaShaderMat = new THREE.ShaderMaterial({
      uniforms: this.nebulaUniforms,
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform float uFlashBoost;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.52;
          mat2 rot = mat2(0.8, -0.6, 0.6, 0.8);
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p = rot * p * 2.02 + vec2(1.3, -0.9);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 p = vUv - 0.5;
          float dist = length(p);
          float radialMask = smoothstep(0.50, 0.10, dist);
          if (radialMask <= 0.002) discard;

          float ang = atan(p.y, p.x);
          vec2 swirlUv = vec2(
            p.x * cos(dist * 2.6 - uTime * 0.08) - p.y * sin(dist * 2.6 - uTime * 0.08),
            p.x * sin(dist * 2.6 - uTime * 0.08) + p.y * cos(dist * 2.6 - uTime * 0.08)
          );

          float n1 = fbm(swirlUv * 5.2 + vec2(uTime * 0.03, -uTime * 0.02));
          float n2 = fbm(swirlUv * 8.5 - vec2(uTime * 0.025, ang * 0.15));
          float wisps = smoothstep(0.28, 0.78, n1 * 0.65 + n2 * 0.45);

          vec3 cDeepBlue = vec3(0.14, 0.25, 0.62);
          vec3 cViolet   = vec3(0.55, 0.26, 0.78);
          vec3 cRose     = vec3(0.92, 0.45, 0.62);
          vec3 cGold     = vec3(0.99, 0.78, 0.42);

          vec3 col = mix(cDeepBlue, cViolet, smoothstep(0.25, 0.72, n1));
          col = mix(col, cRose, smoothstep(0.45, 0.85, n2));
          col = mix(col, cGold, smoothstep(0.55, 0.92, n1 * n2 * 1.9) * (0.65 + uFlashBoost));

          float alpha = wisps * radialMask * uOpacity * (1.0 + uFlashBoost * 0.35);
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const cloudConfigs = [
      { pos: [-16, 13, -36], scale: 42, rotY: 0.38 },
      { pos: [14, 15, -42], scale: 46, rotY: -0.45 },
      { pos: [-4, 19, -54], scale: 58, rotY: 0.12 },
    ];

    const cloudGeo = new THREE.PlaneGeometry(1, 1, 1, 1);
    cloudConfigs.forEach((cfg) => {
      const m = new THREE.Mesh(cloudGeo, nebulaShaderMat);
      m.position.set(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
      m.scale.setScalar(cfg.scale);
      m.rotation.y = cfg.rotY;
      this.nebulaPlanes.push(m);
      this.rootGroup.add(m);
    });

    // 2. Hero Stellar Nurseries (9 staggered star births across the sky)
    const heroCoords: [number, number, number][] = [
      [-14, 10.5, -24],
      [-5, 13.5, -27],
      [6, 12.0, -25],
      [16, 10.0, -22],
      [-19, 15.0, -32],
      [-8, 17.5, -35],
      [3, 18.0, -37],
      [14, 16.5, -31],
      [-1, 9.5, -20],
    ];
    const spectralTints = [
      new THREE.Color(0xfff1c1), // Golden-white
      new THREE.Color(0xb8dcff), // Blue-white O/B giant
      new THREE.Color(0xffcad4), // Warm rose tint
      new THREE.Color(0xffe094), // Champagne amber
      new THREE.Color(0xe0c3fc), // Pale violet starlight
    ];

    const coreGeo = new THREE.SphereGeometry(0.42, 16, 16);
    const shockGeo = new THREE.RingGeometry(0.75, 1.0, 48);
    const spikeGeo = new THREE.PlaneGeometry(0.14, 3.6);

    const heroCount = heroCoords.length;
    const particlesPerHero = 38;
    const totalAccretion = heroCount * particlesPerHero;
    this.accretionPosArr = new Float32Array(totalAccretion * 3);
    const accretionCols = new Float32Array(totalAccretion * 3);

    const constCoords: number[] = [];

    for (let i = 0; i < heroCount; i++) {
      const [hx, hy, hz] = heroCoords[i];
      const center = new THREE.Vector3(hx, hy, hz);
      const finalColor = spectralTints[i % spectralTints.length];

      const sGroup = new THREE.Group();
      sGroup.position.copy(center);

      const coreMat = new THREE.MeshBasicMaterial({
        color: finalColor.clone(),
        transparent: true,
        opacity: 0,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      sGroup.add(coreMesh);

      const coronaSprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: finalColor.clone(),
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      coronaSprite.scale.setScalar(3.5);
      sGroup.add(coronaSprite);

      // Soft 4-point diffraction star spikes visible during peak ignition
      const spikesGroup = new THREE.Group();
      const spikeMat = new THREE.MeshBasicMaterial({
        map: this.glowTexture,
        color: 0xfff8e7,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const spikeV = new THREE.Mesh(spikeGeo, spikeMat);
      const spikeH = new THREE.Mesh(spikeGeo, spikeMat);
      spikeH.rotation.z = Math.PI / 2;
      spikesGroup.add(spikeV, spikeH);
      sGroup.add(spikesGroup);

      // Expanding ionization shockwave ring
      const shockwaveRing = new THREE.Mesh(
        shockGeo,
        new THREE.MeshBasicMaterial({
          color: finalColor,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      sGroup.add(shockwaveRing);

      this.rootGroup.add(sGroup);

      this.heroStars.push({
        group: sGroup,
        center,
        coreMesh,
        coronaSprite,
        spikesGroup,
        shockwaveRing,
        finalColor,
        birthStart: 0.04 + (i / heroCount) * 0.62,
        birthSpan: 0.24,
        baseScale: 0.85 + (i % 3) * 0.28,
        twinkleOffset: i * 1.37,
      });

      // Populate spiral accretion dust around this protostar
      for (let p = 0; p < particlesPerHero; p++) {
        const idx = i * particlesPerHero + p;
        const angle = (p / particlesPerHero) * Math.PI * 2 + Math.random() * 0.5;
        const radius = 1.6 + Math.random() * 4.4;
        this.accretionParticles.push({
          starIdx: i,
          baseAngle: angle,
          baseRadius: radius,
          yOffset: (Math.random() - 0.5) * 2.2,
          orbitSpeed: 1.4 + Math.random() * 1.8,
          tilt: (Math.random() - 0.5) * 0.7,
        });

        accretionCols[idx * 3] = finalColor.r;
        accretionCols[idx * 3 + 1] = finalColor.g;
        accretionCols[idx * 3 + 2] = finalColor.b;
      }

      if (i > 0 && i % 3 !== 0) {
        const prev = heroCoords[i - 1];
        constCoords.push(prev[0], prev[1], prev[2], hx, hy, hz);
      }
    }

    const accGeo = new THREE.BufferGeometry();
    accGeo.setAttribute('position', new THREE.BufferAttribute(this.accretionPosArr, 3));
    accGeo.setAttribute('color', new THREE.BufferAttribute(accretionCols, 3));
    this.accretionPoints = new THREE.Points(
      accGeo,
      new THREE.PointsMaterial({
        map: this.glowTexture,
        size: 0.62,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.accretionPoints.frustumCulled = false;
    this.rootGroup.add(this.accretionPoints);

    // 3. Nascent Background Stars Joining the Starfield
    const minorPos = new Float32Array(this.minorStarCount * 3);
    const minorCol = new Float32Array(this.minorStarCount * 3);
    for (let i = 0; i < this.minorStarCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 24 + Math.random() * 52;
      minorPos[i * 3] = Math.cos(a) * r;
      minorPos[i * 3 + 1] = 6 + Math.random() * 28;
      minorPos[i * 3 + 2] = Math.sin(a) * r - 12;

      const tint = spectralTints[i % spectralTints.length];
      minorCol[i * 3] = tint.r;
      minorCol[i * 3 + 1] = tint.g;
      minorCol[i * 3 + 2] = tint.b;
      this.minorThresholds[i] = 0.08 + (i / this.minorStarCount) * 0.78;
    }

    const minorGeo = new THREE.BufferGeometry();
    minorGeo.setAttribute('position', new THREE.BufferAttribute(minorPos, 3));
    minorGeo.setAttribute('color', new THREE.BufferAttribute(minorCol, 3));
    minorGeo.setDrawRange(0, 0);
    this.minorStars = new THREE.Points(
      minorGeo,
      new THREE.PointsMaterial({
        map: this.glowTexture,
        size: 1.05,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rootGroup.add(this.minorStars);

    // 4. Subtle Constellation Links Connecting Newborn Hero Stars
    const constGeo = new THREE.BufferGeometry();
    constGeo.setAttribute('position', new THREE.Float32BufferAttribute(constCoords, 3));
    constGeo.setDrawRange(0, 0);
    this.constellations = new THREE.LineSegments(
      constGeo,
      new THREE.LineBasicMaterial({
        color: 0xf4d58d,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      })
    );
    this.rootGroup.add(this.constellations);

    // 5. Dynamic Starbirth Illumination Light
    this.ignitionLight = new THREE.PointLight(0xffd166, 0, 85);
    this.ignitionLight.position.set(0, 14, -22);
    this.rootGroup.add(this.ignitionLight);

    handles.scene.add(this.rootGroup);
  }

  public update(frame: ExperienceFrameState, handles: ExperienceSceneHandles): void {
    const { elapsed, songProgress, transitionAlpha } = frame;
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
      camera,
      renderer,
      celestialSystem,
    } = handles;

    // 1. Darken the sky dramatically at the start, then subtly illuminate as stars are born
    const newbornLightLift = THREE.MathUtils.clamp(songProgress * 1.1, 0, 1);
    fog.color.copy(baseline.fogColor).lerp(_nurseryFog, transitionAlpha);
    ambientLight.color.copy(baseline.ambientColor).lerp(_nurseryAmbient, transitionAlpha);
    ambientLight.intensity = THREE.MathUtils.lerp(
      baseline.ambientIntensity,
      0.42 + newbornLightLift * 0.32,
      transitionAlpha
    );
    hemiLight.color.copy(baseline.hemiSkyColor).lerp(_nurseryHemiSky, transitionAlpha);
    hemiLight.groundColor.copy(baseline.hemiGroundColor).lerp(_nurseryHemiGround, transitionAlpha);
    sunLight.color.copy(baseline.sunColor).lerp(_nurserySun, transitionAlpha);
    sunLight.intensity = THREE.MathUtils.lerp(
      baseline.sunIntensity,
      0.75 + newbornLightLift * 0.75,
      transitionAlpha
    );
    cyanLight.color.copy(baseline.cyanLightColor).lerp(_nurseryCyan, transitionAlpha);
    pinkLight.color.copy(baseline.pinkLightColor).lerp(_nurseryPink, transitionAlpha);

    const islandMat = islandMesh.material as THREE.MeshStandardMaterial;
    islandMat.color.copy(baseline.islandColor).lerp(_nurseryIsland, transitionAlpha);
    const pathMat = pathMesh.material as THREE.MeshStandardMaterial;
    pathMat.color.copy(baseline.pathColor).lerp(_nurseryPath, transitionAlpha);

    celestialSystem?.blendModulation(transitionAlpha, {
      starBrightness: 0.48 + newbornLightLift * 0.85,
      nebulaOpacity: 0.78,
      nebulaA: _nebulaColA,
      nebulaB: _nebulaColB,
      nebulaC: _nebulaColC,
    });

    // 2. Hero Star Birth Events: Accretion -> Ignition -> Shockwave -> Steady Star
    let peakFlashTotal = 0;
    for (let i = 0; i < this.heroStars.length; i++) {
      const hs = this.heroStars[i];
      const localP = THREE.MathUtils.clamp((songProgress - hs.birthStart) / hs.birthSpan, 0, 2.5);

      const coreMat = hs.coreMesh.material as THREE.MeshBasicMaterial;
      const coronaMat = hs.coronaSprite.material as THREE.SpriteMaterial;
      const shockMat = hs.shockwaveRing.material as THREE.MeshBasicMaterial;
      const spikeChild = hs.spikesGroup.children[0] as THREE.Mesh;
      const spikeMat = spikeChild.material as THREE.MeshBasicMaterial;

      hs.shockwaveRing.lookAt(camera.position);
      hs.spikesGroup.lookAt(camera.position);

      if (localP <= 0.001) {
        // Dormant gas eddy
        coreMat.opacity = 0;
        coronaMat.opacity = 0;
        shockMat.opacity = 0;
        spikeMat.opacity = 0;
        hs.coreMesh.scale.setScalar(0.01);
        continue;
      }

      if (localP < 0.44) {
        // Phase A: Gravitational collapse & warming protostar ember
        const collapseT = localP / 0.44;
        const heat = collapseT * collapseT;
        _tmpColor.copy(_emberColor).lerp(hs.finalColor, heat);
        coreMat.color.copy(_tmpColor);
        coreMat.opacity = heat * 0.9 * transitionAlpha;
        hs.coreMesh.scale.setScalar((0.35 + heat * 0.75) * hs.baseScale);

        coronaMat.color.copy(_tmpColor);
        coronaMat.opacity = heat * 0.55 * transitionAlpha;
        hs.coronaSprite.scale.setScalar((1.6 + heat * 3.0) * hs.baseScale);

        shockMat.opacity = 0;
        spikeMat.opacity = 0;
      } else if (localP < 0.72) {
        // Phase B: Incandescent Ignition Flash + Expanding Shockwave Ring
        const burstT = (localP - 0.44) / 0.28;
        const flashEnv = Math.sin(burstT * Math.PI);
        peakFlashTotal = Math.max(peakFlashTotal, flashEnv);

        _tmpColor.copy(hs.finalColor).lerp(_ignitionColor, flashEnv * 0.85);
        coreMat.color.copy(_tmpColor);
        coreMat.opacity = transitionAlpha;
        hs.coreMesh.scale.setScalar((1.1 + flashEnv * 1.15) * hs.baseScale);

        coronaMat.color.copy(_tmpColor);
        coronaMat.opacity = (0.65 + flashEnv * 0.35) * transitionAlpha;
        hs.coronaSprite.scale.setScalar((4.2 + flashEnv * 6.5) * hs.baseScale);

        // Starlight diffraction spikes peak at ignition
        spikeMat.opacity = flashEnv * 0.85 * transitionAlpha;
        hs.spikesGroup.scale.setScalar((0.7 + flashEnv * 1.35) * hs.baseScale);
        hs.spikesGroup.rotation.z = elapsed * 0.25 + hs.twinkleOffset;

        // Expanding shockwave ring disperses surrounding gas
        const shockScale = 0.6 + burstT * 7.8;
        hs.shockwaveRing.scale.setScalar(shockScale * hs.baseScale);
        shockMat.opacity = (1.0 - burstT) * 0.68 * transitionAlpha;
      } else {
        // Phase C: Established luminous newborn star twinkling serenely in space
        const settleT = THREE.MathUtils.clamp((localP - 0.72) / 0.3, 0, 1);
        const twinkle = 0.82 + Math.sin(elapsed * 2.4 + hs.twinkleOffset) * 0.18;

        coreMat.color.copy(hs.finalColor);
        coreMat.opacity = transitionAlpha;
        hs.coreMesh.scale.setScalar(THREE.MathUtils.lerp(1.15, 0.82, settleT) * hs.baseScale * twinkle);

        coronaMat.color.copy(hs.finalColor);
        coronaMat.opacity = 0.62 * twinkle * transitionAlpha;
        hs.coronaSprite.scale.setScalar(THREE.MathUtils.lerp(5.2, 3.6, settleT) * hs.baseScale * twinkle);

        spikeMat.opacity = 0.22 * twinkle * transitionAlpha;
        hs.spikesGroup.scale.setScalar(0.55 * hs.baseScale * twinkle);
        shockMat.opacity = 0;
      }
    }

    // 3. Update Accretion -> Dispersal Dust Particles
    if (this.accretionPoints && this.accretionPosArr) {
      for (let i = 0; i < this.accretionParticles.length; i++) {
        const ap = this.accretionParticles[i];
        const hs = this.heroStars[ap.starIdx];
        const localP = THREE.MathUtils.clamp((songProgress - hs.birthStart) / hs.birthSpan, 0, 1.5);

        let radialMult = 1.0;
        if (localP < 0.44) {
          // Spiral inward during accretion
          radialMult = THREE.MathUtils.lerp(1.25, 0.18, localP / 0.44);
        } else {
          // Dispersal wave outward after ignition
          const dispT = THREE.MathUtils.clamp((localP - 0.44) / 0.65, 0, 1);
          radialMult = THREE.MathUtils.lerp(0.22, 1.9, dispT);
        }

        const r = ap.baseRadius * radialMult;
        const spinBoost = localP < 0.44 ? 1.0 + (localP / 0.44) * 2.4 : 0.65;
        const angle = ap.baseAngle + elapsed * ap.orbitSpeed * spinBoost;

        this.accretionPosArr[i * 3] = hs.center.x + Math.cos(angle) * r;
        this.accretionPosArr[i * 3 + 1] = hs.center.y + ap.yOffset * Math.min(1.1, radialMult) + Math.sin(angle * 2) * ap.tilt * r * 0.2;
        this.accretionPosArr[i * 3 + 2] = hs.center.z + Math.sin(angle) * r;
      }
      this.accretionPoints.geometry.attributes.position.needsUpdate = true;
      (this.accretionPoints.material as THREE.PointsMaterial).opacity = 0.85 * transitionAlpha;
    }

    // 4. Reveal minor background stars & subtle constellation threads
    if (this.minorStars) {
      let revealedCount = 0;
      while (
        revealedCount < this.minorStarCount &&
        songProgress >= this.minorThresholds[revealedCount]
      ) {
        revealedCount++;
      }
      this.minorStars.geometry.setDrawRange(0, revealedCount);
      (this.minorStars.material as THREE.PointsMaterial).opacity = 0.9 * transitionAlpha;
    }

    if (this.constellations) {
      const totalVerts = this.constellations.geometry.attributes.position.count;
      const revealed = Math.floor(THREE.MathUtils.clamp((songProgress - 0.25) * 1.4, 0, 1) * (totalVerts / 2)) * 2;
      this.constellations.geometry.setDrawRange(0, revealed);
      (this.constellations.material as THREE.LineBasicMaterial).opacity = 0.36 * transitionAlpha;
    }

    // 5. Update Nebula Shaders & Dynamic Ignition Exposure Pulse
    this.nebulaUniforms.uTime.value = elapsed;
    this.nebulaUniforms.uOpacity.value = 0.72 * transitionAlpha;
    this.nebulaUniforms.uFlashBoost.value = peakFlashTotal;

    if (this.ignitionLight) {
      this.ignitionLight.intensity = (1.2 + peakFlashTotal * 4.5 + newbornLightLift * 1.4) * transitionAlpha;
    }

    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      baseline.exposure,
      1.04 + peakFlashTotal * 0.22,
      transitionAlpha
    );
  }

  public dispose(handles: ExperienceSceneHandles): void {
    handles.scene.remove(this.rootGroup);
    disposeObject3DTree(this.rootGroup);
    if (this.glowTexture) {
      this.glowTexture.dispose();
      this.glowTexture = null;
    }
    this.nebulaPlanes = [];
    this.heroStars = [];
    this.accretionParticles = [];
    this.accretionPoints = null;
    this.accretionPosArr = null;
    this.minorStars = null;
    this.constellations = null;
    this.ignitionLight = null;
  }
}
