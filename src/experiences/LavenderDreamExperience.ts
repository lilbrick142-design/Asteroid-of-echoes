import * as THREE from 'three';
import { SongItem } from '../types';
import { ExperienceFrameState, ExperienceSceneHandles, ISongExperience } from './types';
import { createSoftGlowTexture, disposeObject3DTree } from './utils/proceduralShapes';

// Pre-allocated math helpers
const _heatherFog = new THREE.Color(0x16102e);
const _heatherAmbient = new THREE.Color(0x473870);
const _heatherHemiSky = new THREE.Color(0xc8b6ff);
const _heatherHemiGround = new THREE.Color(0x23193d);
const _heatherSun = new THREE.Color(0xf0d9ff);
const _heatherCyan = new THREE.Color(0x8ecae6);
const _heatherPink = new THREE.Color(0xe0aaff);
const _heatherIsland = new THREE.Color(0x31264f);
const _heatherPath = new THREE.Color(0x846ef5);

const _nebulaA = new THREE.Color(0x361f66);
const _nebulaB = new THREE.Color(0x8ecae6);
const _nebulaC = new THREE.Color(0xe0aaff);

const _starCenter = new THREE.Vector3(-1.5, 9.2, -23.0);

interface EjectaParticle {
  dir: THREE.Vector3;
  speed: number;
  orbitOffset: number;
}

export class LavenderDreamExperience implements ISongExperience {
  public readonly song: SongItem;
  public readonly rootGroup = new THREE.Group();

  private starSystemGroup = new THREE.Group();
  private glowTexture: THREE.CanvasTexture | null = null;

  // Aging Star Photosphere
  private giantStarMesh: THREE.Mesh | null = null;
  private giantStarUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
    uInstability: { value: number };
  };
  private giantCoronaSprite: THREE.Sprite | null = null;

  // Planetary Nebula Shells (Inner Ionization + Outer Bipolar Lobes + Equatorial Dust Torus)
  private innerShellMesh: THREE.Mesh | null = null;
  private innerShellUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
  };

  private bipolarGroup = new THREE.Group();
  private outerLobesUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
  };
  private dustTorus: THREE.Mesh | null = null;
  private dustTorusUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
  };

  // White Dwarf Remnant
  private whiteDwarfMesh: THREE.Mesh | null = null;
  private whiteDwarfGlow: THREE.Sprite | null = null;
  private starLight: THREE.PointLight | null = null;

  // Expanding Nebula Debris & Ambient Ground Dust
  private ejectaPoints: THREE.Points | null = null;
  private ejectaPosArr: Float32Array | null = null;
  private ejectaParticles: EjectaParticle[] = [];
  private groundMistPoints: THREE.Points | null = null;

  constructor(song: SongItem) {
    this.song = song;
    this.rootGroup.name = 'experience_death_of_star';

    this.giantStarUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uInstability: { value: 0 },
    };
    this.innerShellUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
    this.outerLobesUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
    this.dustTorusUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
  }

  public enter(handles: ExperienceSceneHandles): void {
    this.glowTexture = createSoftGlowTexture(128);
    this.glowTexture.userData.sharedAsset = false;

    this.starSystemGroup.position.copy(_starCenter);
    this.rootGroup.add(this.starSystemGroup);

    // 1. Aging Luminous Giant Star with Convection-Cell Plasma Shader
    const giantGeo = new THREE.SphereGeometry(3.8, 48, 48);
    const giantMat = new THREE.ShaderMaterial({
      uniforms: this.giantStarUniforms,
      vertexShader: `
        uniform float uTime;
        uniform float uInstability;
        varying vec3 vNormal;
        varying vec3 vLocalPos;
        varying vec3 vViewDir;

        void main() {
          vLocalPos = position;
          // Pulsating convective surface waves before shedding envelope
          float swell = sin(position.x * 1.4 + uTime * 2.1) * cos(position.y * 1.4 - uTime * 1.7) * sin(position.z * 1.4 + uTime * 1.3);
          vec3 displaced = position + normal * (swell * (0.08 + uInstability * 0.34));
          vec4 worldPos = modelMatrix * vec4(displaced, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = viewMatrix * worldPos;
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform float uInstability;
        varying vec3 vNormal;
        varying vec3 vLocalPos;
        varying vec3 vViewDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        float fbm(vec3 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 4; i++) {
            v += a * noise(p);
            p = p * 2.08 + vec3(0.15, -0.11, 0.09);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 p = normalize(vLocalPos) * 3.1;
          float n1 = fbm(p + vec3(uTime * 0.16, -uTime * 0.11, uTime * 0.08));
          float n2 = fbm(p * 1.9 - vec3(uTime * 0.22, 0.4, -uTime * 0.15));
          float cell = smoothstep(0.28, 0.78, n1 * 0.65 + n2 * 0.45);

          float rim = 1.0 - clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);

          vec3 cDeepRose  = vec3(0.58, 0.16, 0.48);
          vec3 cHeather   = vec3(0.86, 0.56, 0.94);
          vec3 cAmberCore = vec3(1.00, 0.80, 0.64);
          vec3 cRimViolet = vec3(0.75, 0.65, 1.00);

          vec3 col = mix(cDeepRose, cHeather, cell);
          col = mix(col, cAmberCore, smoothstep(0.56, 0.92, cell) * (0.75 + uInstability * 0.5));
          col = mix(col, cRimViolet, pow(rim, 1.8) * 0.72);

          gl_FragColor = vec4(col * (1.05 + uInstability * 0.45), uOpacity);
        }
      `,
      transparent: true,
      depthWrite: true,
    });
    this.giantStarMesh = new THREE.Mesh(giantGeo, giantMat);
    this.starSystemGroup.add(this.giantStarMesh);

    this.giantCoronaSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xe0aaff,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.giantCoronaSprite.scale.setScalar(13.5);
    this.starSystemGroup.add(this.giantCoronaSprite);

    // 2. Inner Ionization Shell (Cyan-Lavender O[III] Glow)
    const innerGeo = new THREE.SphereGeometry(1, 36, 36);
    const innerMat = new THREE.ShaderMaterial({
      uniforms: this.innerShellUniforms,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vLocal;
        varying vec3 vViewDir;
        void main() {
          vLocal = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vLocal;
        varying vec3 vViewDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        void main() {
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.2);
          float fil = noise(normalize(vLocal) * 4.5 + vec3(uTime * 0.09, -uTime * 0.06, 0.0));
          float fil2 = noise(normalize(vLocal) * 8.0 - vec3(0.0, uTime * 0.11, uTime * 0.05));
          float pattern = smoothstep(0.28, 0.82, fil * 0.65 + fil2 * 0.45);

          vec3 cCyan = vec3(0.48, 0.86, 0.98);
          vec3 cLav  = vec3(0.78, 0.65, 1.00);
          vec3 col = mix(cCyan, cLav, fil);

          float alpha = (0.28 + fresnel * 0.95) * (0.42 + pattern * 0.68) * uOpacity;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.9));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.innerShellMesh = new THREE.Mesh(innerGeo, innerMat);
    this.starSystemGroup.add(this.innerShellMesh);

    // 3. Outer Bipolar Planetary Nebula Lobes + Equatorial Dust Torus
    this.bipolarGroup.rotation.set(0.32, 0.15, -0.45);
    this.starSystemGroup.add(this.bipolarGroup);

    const outerMat = new THREE.ShaderMaterial({
      uniforms: this.outerLobesUniforms,
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vLocal;
        varying vec3 vViewDir;
        void main() {
          vLocal = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        varying vec3 vNormal;
        varying vec3 vLocal;
        varying vec3 vViewDir;

        float hash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }

        float noise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        void main() {
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.75);
          vec3 np = normalize(vLocal) * 3.8;
          float n1 = noise(np + vec3(0.0, uTime * 0.08, uTime * 0.05));
          float n2 = noise(np * 2.1 - vec3(uTime * 0.1, 0.2, 0.0));
          float filaments = smoothstep(0.24, 0.85, n1 * 0.6 + n2 * 0.5);

          vec3 cRose    = vec3(0.95, 0.52, 0.78);
          vec3 cViolet  = vec3(0.62, 0.42, 0.96);
          vec3 cTwilight= vec3(0.56, 0.76, 0.98);

          vec3 col = mix(cViolet, cRose, smoothstep(0.25, 0.75, n1));
          col = mix(col, cTwilight, smoothstep(0.55, 0.9, n2) * 0.55);

          float alpha = (0.18 + fresnel * 0.82) * filaments * uOpacity;
          gl_FragColor = vec4(col, clamp(alpha, 0.0, 0.85));
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const lobeGeo = new THREE.SphereGeometry(1, 32, 32);
    const northLobe = new THREE.Mesh(lobeGeo, outerMat);
    northLobe.position.y = 0.55;
    northLobe.scale.set(0.88, 1.32, 0.88);
    this.bipolarGroup.add(northLobe);

    const southLobe = new THREE.Mesh(lobeGeo, outerMat);
    southLobe.position.y = -0.55;
    southLobe.scale.set(0.88, 1.32, 0.88);
    this.bipolarGroup.add(southLobe);

    const torusGeo = new THREE.TorusGeometry(0.95, 0.22, 16, 64);
    torusGeo.rotateX(Math.PI / 2);
    const torusMat = new THREE.ShaderMaterial({
      uniforms: this.dustTorusUniforms,
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
        varying vec2 vUv;
        void main() {
          float streaks = 0.55 + 0.45 * sin(vUv.x * 24.0 + uTime * 0.7) * cos(vUv.y * 6.0);
          float band = smoothstep(0.0, 0.35, sin(vUv.y * 3.14159));
          vec3 col = mix(vec3(0.55, 0.42, 0.88), vec3(0.95, 0.68, 0.86), streaks);
          gl_FragColor = vec4(col, band * streaks * uOpacity * 0.55);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.dustTorus = new THREE.Mesh(torusGeo, torusMat);
    this.bipolarGroup.add(this.dustTorus);

    // 4. Serene White Dwarf Remnant at the Heart
    this.whiteDwarfMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 28, 28),
      new THREE.MeshBasicMaterial({
        color: 0xeef7ff,
        transparent: true,
        opacity: 0,
      })
    );
    this.starSystemGroup.add(this.whiteDwarfMesh);

    this.whiteDwarfGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xc8e4ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.whiteDwarfGlow.scale.setScalar(6.2);
    this.starSystemGroup.add(this.whiteDwarfGlow);

    this.starLight = new THREE.PointLight(0xe0aaff, 3.0, 95);
    this.starSystemGroup.add(this.starLight);

    // 5. Expanding Bipolar Nebula Ejecta Particles
    const ejectaCount = 340;
    this.ejectaPosArr = new Float32Array(ejectaCount * 3);
    const ejectaCols = new Float32Array(ejectaCount * 3);
    const ejectaPalette = [
      new THREE.Color(0xb8c0ff),
      new THREE.Color(0xe0aaff),
      new THREE.Color(0x8ecae6),
      new THREE.Color(0xffafcc),
    ];

    const axisTilt = new THREE.Euler(0.32, 0.15, -0.45);
    for (let i = 0; i < ejectaCount; i++) {
      // Bias slightly along bipolar axis & equatorial plane
      const theta = Math.random() * Math.PI * 2;
      const inEquatorial = i % 3 === 0;
      const phi = inEquatorial
        ? Math.PI * 0.5 + (Math.random() - 0.5) * 0.35
        : (Math.random() > 0.5 ? 0.35 : Math.PI - 0.35) + (Math.random() - 0.5) * 0.55;

      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).applyEuler(axisTilt);

      this.ejectaParticles.push({
        dir,
        speed: 0.75 + Math.random() * 0.95,
        orbitOffset: Math.random() * Math.PI * 2,
      });

      const c = ejectaPalette[i % ejectaPalette.length];
      ejectaCols[i * 3] = c.r;
      ejectaCols[i * 3 + 1] = c.g;
      ejectaCols[i * 3 + 2] = c.b;
    }

    const ejectaGeo = new THREE.BufferGeometry();
    ejectaGeo.setAttribute('position', new THREE.BufferAttribute(this.ejectaPosArr, 3));
    ejectaGeo.setAttribute('color', new THREE.BufferAttribute(ejectaCols, 3));
    this.ejectaPoints = new THREE.Points(
      ejectaGeo,
      new THREE.PointsMaterial({
        map: this.glowTexture,
        size: 0.65,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.ejectaPoints.frustumCulled = false;
    this.starSystemGroup.add(this.ejectaPoints);

    // 6. Soft Twilight Heather Dust Drifting Across the Asteroid Surface
    const mistCount = Number(this.song.experienceParams.petalCount) || 160;
    const mistPos = new Float32Array(mistCount * 3);
    for (let i = 0; i < mistCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 17.5;
      mistPos[i * 3] = Math.cos(a) * r;
      mistPos[i * 3 + 1] = 0.3 + Math.random() * 6.5;
      mistPos[i * 3 + 2] = Math.sin(a) * r;
    }
    const mistGeo = new THREE.BufferGeometry();
    mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
    this.groundMistPoints = new THREE.Points(
      mistGeo,
      new THREE.PointsMaterial({
        map: this.glowTexture,
        color: 0xd8b4fe,
        size: 0.42,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rootGroup.add(this.groundMistPoints);

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
      celestialSystem,
    } = handles;

    fog.color.copy(baseline.fogColor).lerp(_heatherFog, transitionAlpha);
    ambientLight.color.copy(baseline.ambientColor).lerp(_heatherAmbient, transitionAlpha);
    ambientLight.intensity = THREE.MathUtils.lerp(baseline.ambientIntensity, 0.92, transitionAlpha);
    hemiLight.color.copy(baseline.hemiSkyColor).lerp(_heatherHemiSky, transitionAlpha);
    hemiLight.groundColor.copy(baseline.hemiGroundColor).lerp(_heatherHemiGround, transitionAlpha);
    sunLight.color.copy(baseline.sunColor).lerp(_heatherSun, transitionAlpha);
    sunLight.intensity = THREE.MathUtils.lerp(baseline.sunIntensity, 1.15, transitionAlpha);
    cyanLight.color.copy(baseline.cyanLightColor).lerp(_heatherCyan, transitionAlpha);
    pinkLight.color.copy(baseline.pinkLightColor).lerp(_heatherPink, transitionAlpha);

    const islandMat = islandMesh.material as THREE.MeshStandardMaterial;
    islandMat.color.copy(baseline.islandColor).lerp(_heatherIsland, transitionAlpha);
    const pathMat = pathMesh.material as THREE.MeshStandardMaterial;
    pathMat.color.copy(baseline.pathColor).lerp(_heatherPath, transitionAlpha);

    celestialSystem?.blendModulation(transitionAlpha, {
      starBrightness: 1.05,
      nebulaOpacity: 0.64,
      nebulaA: _nebulaA,
      nebulaB: _nebulaB,
      nebulaC: _nebulaC,
    });

    // Stellar Evolution Phases across songProgress (0.0 -> 1.0)
    // Phase 1 (0 -> 0.34): Pulsation & Instability builds
    const instability = THREE.MathUtils.smoothstep(songProgress, 0.08, 0.36);
    // Phase 2 (0.30 -> 0.68): Shedding outer layers into planetary nebula
    const shedStart = THREE.MathUtils.smoothstep(songProgress, 0.28, 0.44);
    const envelopeFade = 1.0 - THREE.MathUtils.smoothstep(songProgress, 0.36, 0.62);
    // Phase 3 (0.56 -> 1.0): White dwarf core revealed inside glowing lingering nebula
    const whiteDwarfReveal = THREE.MathUtils.smoothstep(songProgress, 0.50, 0.72);

    this.starSystemGroup.scale.setScalar(Math.max(0.001, transitionAlpha));

    // Giant Star Photosphere
    if (this.giantStarMesh && this.giantCoronaSprite) {
      const pulse = 1.0 + Math.sin(elapsed * (1.8 + instability * 3.8)) * (0.04 + instability * 0.14);
      const expansion = 1.0 + shedStart * 0.45;
      this.giantStarMesh.scale.setScalar(pulse * expansion);
      this.giantStarMesh.rotation.y = elapsed * 0.12;

      this.giantStarUniforms.uTime.value = elapsed;
      this.giantStarUniforms.uInstability.value = instability;
      this.giantStarUniforms.uOpacity.value = envelopeFade * transitionAlpha;
      this.giantStarMesh.visible = envelopeFade > 0.01;

      (this.giantCoronaSprite.material as THREE.SpriteMaterial).opacity =
        (0.55 + instability * 0.3) * envelopeFade * transitionAlpha;
      this.giantCoronaSprite.scale.setScalar((13.5 + instability * 4.5) * pulse);
    }

    // Expanding Planetary Nebula Shells (linger & drift gracefully after main event)
    const expTime = Math.max(0, songProgress - 0.26) / 0.74; // 0 -> 1 after ejection begins
    const innerScale = 3.8 + expTime * 11.5;
    const outerScale = 4.2 + expTime * 14.5;

    if (this.innerShellMesh) {
      this.innerShellMesh.scale.setScalar(innerScale);
      this.innerShellMesh.rotation.y = elapsed * 0.06;
      this.innerShellUniforms.uTime.value = elapsed;
      this.innerShellUniforms.uOpacity.value =
        shedStart * THREE.MathUtils.lerp(0.92, 0.48, expTime) * transitionAlpha;
    }

    this.bipolarGroup.scale.setScalar(outerScale);
    this.bipolarGroup.rotation.y = 0.15 + elapsed * 0.04;
    this.outerLobesUniforms.uTime.value = elapsed;
    this.outerLobesUniforms.uOpacity.value =
      shedStart * THREE.MathUtils.lerp(0.88, 0.46, expTime) * transitionAlpha;

    if (this.dustTorus) {
      this.dustTorusUniforms.uTime.value = elapsed;
      this.dustTorusUniforms.uOpacity.value =
        shedStart * THREE.MathUtils.lerp(0.75, 0.38, expTime) * transitionAlpha;
    }

    // Serene White Dwarf Core
    if (this.whiteDwarfMesh && this.whiteDwarfGlow) {
      const wdBeat = 1.0 + Math.sin(elapsed * 2.2) * 0.08;
      this.whiteDwarfMesh.scale.setScalar(Math.max(0.001, whiteDwarfReveal * wdBeat));
      (this.whiteDwarfMesh.material as THREE.MeshBasicMaterial).opacity =
        whiteDwarfReveal * transitionAlpha;

      (this.whiteDwarfGlow.material as THREE.SpriteMaterial).opacity =
        whiteDwarfReveal * 0.88 * transitionAlpha;
      this.whiteDwarfGlow.scale.setScalar((5.8 + Math.sin(elapsed * 2.2) * 0.6) * whiteDwarfReveal);
    }

    if (this.starLight) {
      this.starLight.intensity = (2.6 + shedStart * 2.2) * transitionAlpha;
    }

    // Expanding Nebula Ejecta Particles
    if (this.ejectaPoints && this.ejectaPosArr) {
      const driftRadius = 3.2 + expTime * 15.5;
      for (let i = 0; i < this.ejectaParticles.length; i++) {
        const ep = this.ejectaParticles[i];
        const r = driftRadius * ep.speed;
        const swirl = elapsed * 0.15 + ep.orbitOffset;
        this.ejectaPosArr[i * 3] = ep.dir.x * r + Math.cos(swirl) * 0.35;
        this.ejectaPosArr[i * 3 + 1] = ep.dir.y * r + Math.sin(swirl * 0.8) * 0.25;
        this.ejectaPosArr[i * 3 + 2] = ep.dir.z * r + Math.sin(swirl) * 0.35;
      }
      this.ejectaPoints.geometry.attributes.position.needsUpdate = true;
      (this.ejectaPoints.material as THREE.PointsMaterial).opacity =
        shedStart * THREE.MathUtils.lerp(0.9, 0.45, expTime) * transitionAlpha;
    }

    if (this.groundMistPoints) {
      this.groundMistPoints.rotation.y = elapsed * 0.035;
      (this.groundMistPoints.material as THREE.PointsMaterial).opacity = 0.62 * transitionAlpha;
    }
  }

  public dispose(handles: ExperienceSceneHandles): void {
    handles.scene.remove(this.rootGroup);
    disposeObject3DTree(this.rootGroup);
    if (this.glowTexture) {
      this.glowTexture.dispose();
      this.glowTexture = null;
    }
    this.giantStarMesh = null;
    this.giantCoronaSprite = null;
    this.innerShellMesh = null;
    this.dustTorus = null;
    this.whiteDwarfMesh = null;
    this.whiteDwarfGlow = null;
    this.starLight = null;
    this.ejectaPoints = null;
    this.ejectaPosArr = null;
    this.ejectaParticles = [];
    this.groundMistPoints = null;
  }
}
