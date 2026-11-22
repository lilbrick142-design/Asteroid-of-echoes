import * as THREE from 'three';
import { SongItem } from '../types';
import { ExperienceFrameState, ExperienceSceneHandles, ISongExperience } from './types';
import { disposeObject3DTree } from './utils/proceduralShapes';

// Pre-allocated colors for continuous sunrise -> midday -> sunset -> twilight interpolation
const _sunriseSkyTop = new THREE.Color(0x28356b);
const _sunriseSkyHorizon = new THREE.Color(0xff9e7d);
const _middaySkyTop = new THREE.Color(0x1f7ae0);
const _middaySkyHorizon = new THREE.Color(0x90e0ef);
const _sunsetSkyTop = new THREE.Color(0x3a1c5c);
const _sunsetSkyHorizon = new THREE.Color(0xf72585);
const _sunsetMidGlow = new THREE.Color(0xff7b00);
const _duskSkyTop = new THREE.Color(0x100826);
const _duskSkyHorizon = new THREE.Color(0x4a1942);

const _tmpTop = new THREE.Color();
const _tmpHorizon = new THREE.Color();
const _tmpFog = new THREE.Color();
const _tmpSunCol = new THREE.Color();
const _tmpIslandCol = new THREE.Color();
const _tmpCloudCol = new THREE.Color();

interface CloudCluster {
  group: THREE.Group;
  baseAngle: number;
  radius: number;
  height: number;
  speed: number;
  scale: number;
  materials: THREE.MeshStandardMaterial[];
}

export class SolarCycleExperience implements ISongExperience {
  public readonly song: SongItem;
  public readonly rootGroup = new THREE.Group();

  private skyDomeMat: THREE.ShaderMaterial | null = null;
  private sunGroup = new THREE.Group();
  private sunSurfaceMat: THREE.ShaderMaterial | null = null;
  private lightRays: THREE.Mesh[] = [];
  private clouds: CloudCluster[] = [];
  private solarMotes: THREE.Points | null = null;
  private distantPlanet: THREE.Mesh | null = null;

  constructor(song: SongItem) {
    this.song = song;
    this.rootGroup.name = 'experience_solar_cycle';
  }

  public enter(handles: ExperienceSceneHandles): void {
    // 1. Atmospheric Gradient Sky Dome (inside starbox, blends smoothly with sun elevation)
    const skyGeo = new THREE.SphereGeometry(220, 32, 24);
    this.skyDomeMat = new THREE.ShaderMaterial({
      uniforms: {
        uTopColor: { value: new THREE.Color(0x28356b) },
        uHorizonColor: { value: new THREE.Color(0xff9e7d) },
        uSunDir: { value: new THREE.Vector3(0, 0.2, -1) },
        uAlpha: { value: 0 },
      },
      vertexShader: `
        varying vec3 vWorldDir;
        void main() {
          vWorldDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTopColor;
        uniform vec3 uHorizonColor;
        uniform vec3 uSunDir;
        uniform float uAlpha;
        varying vec3 vWorldDir;

        void main() {
          float h = clamp(vWorldDir.y * 0.8 + 0.25, 0.0, 1.0);
          vec3 sky = mix(uHorizonColor, uTopColor, pow(h, 0.72));
          float sunAlign = max(0.0, dot(normalize(vWorldDir), normalize(uSunDir)));
          sky += uHorizonColor * pow(sunAlign, 8.0) * 0.45;
          gl_FragColor = vec4(sky, uAlpha * 0.86);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const skyDome = new THREE.Mesh(skyGeo, this.skyDomeMat);
    this.rootGroup.add(skyDome);

    // 2. Luminous 3D Sun + Plasma Surface + Volumetric Corona + Atmospheric Light Rays
    const sunCoreGeo = new THREE.SphereGeometry(6.8, 32, 32);
    this.sunSurfaceMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCoreColor: { value: new THREE.Color(0xfff3b0) },
        uGlowColor: { value: new THREE.Color(0xff7b00) },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uCoreColor;
        uniform vec3 uGlowColor;
        varying vec3 vNormal;
        varying vec3 vPos;

        void main() {
          float wave = sin(vPos.x * 0.9 + uTime * 1.8) * cos(vPos.y * 0.9 - uTime * 1.4) * sin(vPos.z * 0.9 + uTime);
          vec3 col = mix(uGlowColor, uCoreColor, 0.55 + 0.35 * wave);
          gl_FragColor = vec4(col * 1.25, 1.0);
        }
      `,
    });
    this.sunGroup.add(new THREE.Mesh(sunCoreGeo, this.sunSurfaceMat));

    const coronaGeo = new THREE.SphereGeometry(9.2, 24, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffb703,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sunGroup.add(new THREE.Mesh(coronaGeo, coronaMat));

    // Radial atmospheric light rays fanning out from the 3D sun
    const rayGeo = new THREE.ConeGeometry(2.6, 26, 8, 1, true);
    rayGeo.translate(0, 13, 0);
    for (let i = 0; i < 8; i++) {
      const rayMat = new THREE.MeshBasicMaterial({
        color: 0xffd166,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ray = new THREE.Mesh(rayGeo, rayMat);
      ray.rotation.z = (i / 8) * Math.PI * 2;
      ray.rotation.x = 0.15;
      this.lightRays.push(ray);
      this.sunGroup.add(ray);
    }

    this.rootGroup.add(this.sunGroup);

    // 3. Stylized Drifting Clouds catching sunrise/midday/sunset tints
    const cloudCount = Number(this.song.experienceParams.cloudClusters) || 14;
    const puffGeo = new THREE.DodecahedronGeometry(1.5, 1);

    for (let i = 0; i < cloudCount; i++) {
      const cGroup = new THREE.Group();
      const mats: THREE.MeshStandardMaterial[] = [];
      const puffCount = 3 + (i % 3);

      for (let p = 0; p < puffCount; p++) {
        const mat = new THREE.MeshStandardMaterial({
          color: 0xfff1e6,
          emissive: 0xff9e7d,
          emissiveIntensity: 0.25,
          roughness: 0.9,
          transparent: true,
          opacity: 0.78,
        });
        mats.push(mat);
        const puff = new THREE.Mesh(puffGeo, mat);
        puff.position.set((p - 1) * 1.4, Math.sin(p * 1.7) * 0.4, (p % 2) * 0.5);
        puff.scale.set(1.2 - p * 0.12, 0.72, 0.95);
        cGroup.add(puff);
      }

      this.rootGroup.add(cGroup);
      this.clouds.push({
        group: cGroup,
        baseAngle: (i / cloudCount) * Math.PI * 2,
        radius: 25 + (i % 4) * 6,
        height: 4.5 + (i % 5) * 2.4,
        speed: 0.025 + (i % 3) * 0.01,
        scale: 0.9 + (i % 3) * 0.35,
        materials: mats,
      });
    }

    // 4. Distant Celestial Companion Planet
    const planetGeo = new THREE.SphereGeometry(5.5, 24, 24);
    const planetMat = new THREE.MeshStandardMaterial({
      color: 0x6d597a,
      roughness: 0.8,
      metalness: 0.1,
    });
    this.distantPlanet = new THREE.Mesh(planetGeo, planetMat);
    this.distantPlanet.position.set(42, 22, -75);
    this.rootGroup.add(this.distantPlanet);

    // 5. Golden Atmospheric Particles
    const moteCount = 180;
    const motePos = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 24;
      motePos[i * 3] = Math.cos(a) * r;
      motePos[i * 3 + 1] = 0.8 + Math.random() * 12;
      motePos[i * 3 + 2] = Math.sin(a) * r;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
    this.solarMotes = new THREE.Points(
      moteGeo,
      new THREE.PointsMaterial({
        color: 0xffd166,
        size: 0.25,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rootGroup.add(this.solarMotes);

    handles.scene.add(this.rootGroup);
  }

  public update(frame: ExperienceFrameState, handles: ExperienceSceneHandles): void {
    const { delta, elapsed, songProgress, transitionAlpha } = frame;
    const { baseline, fog, ambientLight, hemiLight, sunLight, cyanLight, pinkLight, islandMesh, pathMesh } = handles;

    // Map full songProgress (0 -> 1) across the complete celestial day cycle
    const t = THREE.MathUtils.clamp(songProgress, 0, 1);

    // Arc angle from East horizon (-0.15 rad) -> Zenith (PI/2) -> West horizon (PI + 0.15 rad)
    const sunAngle = THREE.MathUtils.lerp(-0.08, Math.PI + 0.08, t);
    const orbitR = Number(this.song.experienceParams.sunOrbitRadius) || 68;
    const sunX = -Math.cos(sunAngle) * orbitR;
    const sunY = Math.sin(sunAngle) * (orbitR * 0.56) + 2.0;
    const sunZ = -44 - Math.sin(sunAngle) * 14;

    this.sunGroup.position.set(sunX, sunY, sunZ);
    this.sunGroup.scale.setScalar(Math.max(0.001, transitionAlpha));

    // Rotate atmospheric light rays gently
    for (let i = 0; i < this.lightRays.length; i++) {
      this.lightRays[i].rotation.z += delta * 0.08;
    }
    if (this.sunSurfaceMat) {
      this.sunSurfaceMat.uniforms.uTime.value = elapsed;
    }

    // Color phases: Sunrise (0..0.28) -> Midday (0.28..0.62) -> Sunset (0.62..0.90) -> Dusk (0.90..1.0)
    if (t < 0.28) {
      const k = t / 0.28;
      _tmpTop.copy(_sunriseSkyTop).lerp(_middaySkyTop, k);
      _tmpHorizon.copy(_sunriseSkyHorizon).lerp(_middaySkyHorizon, k);
      _tmpSunCol.setHex(0xffb36b).lerp(new THREE.Color(0xfff5d6), k);
      _tmpCloudCol.setHex(0xffcdb2).lerp(new THREE.Color(0xffffff), k);
    } else if (t < 0.62) {
      const k = (t - 0.28) / 0.34;
      _tmpTop.copy(_middaySkyTop).lerp(_sunsetSkyTop, k * 0.35);
      _tmpHorizon.copy(_middaySkyHorizon).lerp(_sunsetMidGlow, k * 0.55);
      _tmpSunCol.setHex(0xfff5d6).lerp(new THREE.Color(0xffbe55), k);
      _tmpCloudCol.setHex(0xffffff).lerp(new THREE.Color(0xffd6a5), k);
    } else if (t < 0.9) {
      const k = (t - 0.62) / 0.28;
      _tmpTop.copy(_middaySkyTop).lerp(_sunsetSkyTop, 0.35 + k * 0.65);
      _tmpHorizon.copy(_sunsetMidGlow).lerp(_sunsetSkyHorizon, k);
      _tmpSunCol.setHex(0xffbe55).lerp(new THREE.Color(0xff5d8f), k);
      _tmpCloudCol.setHex(0xffd6a5).lerp(new THREE.Color(0xff8fab), k);
    } else {
      const k = (t - 0.9) / 0.1;
      _tmpTop.copy(_sunsetSkyTop).lerp(_duskSkyTop, k);
      _tmpHorizon.copy(_sunsetSkyHorizon).lerp(_duskSkyHorizon, k);
      _tmpSunCol.setHex(0xff5d8f).lerp(new THREE.Color(0x9d4edd), k);
      _tmpCloudCol.setHex(0xff8fab).lerp(new THREE.Color(0x6d597a), k);
    }

    if (this.skyDomeMat) {
      this.skyDomeMat.uniforms.uTopColor.value.copy(_tmpTop);
      this.skyDomeMat.uniforms.uHorizonColor.value.copy(_tmpHorizon);
      this.skyDomeMat.uniforms.uSunDir.value.set(sunX, sunY, sunZ).normalize();
      this.skyDomeMat.uniforms.uAlpha.value = transitionAlpha;
    }

    // Dynamic asteroid lighting tracking the 3D sun position
    _tmpFog.copy(baseline.fogColor).lerp(_tmpHorizon, transitionAlpha * 0.55);
    fog.color.copy(_tmpFog);

    sunLight.position.lerpVectors(baseline.sunPosition, this.sunGroup.position, transitionAlpha);
    sunLight.color.copy(baseline.sunColor).lerp(_tmpSunCol, transitionAlpha);
    sunLight.intensity = THREE.MathUtils.lerp(
      baseline.sunIntensity,
      1.35 + Math.sin(sunAngle) * 0.95,
      transitionAlpha
    );

    ambientLight.color.copy(baseline.ambientColor).lerp(_tmpTop, transitionAlpha);
    hemiLight.color.copy(baseline.hemiSkyColor).lerp(_tmpHorizon, transitionAlpha);
    hemiLight.groundColor.copy(baseline.hemiGroundColor).lerp(_tmpTop, transitionAlpha * 0.6);
    cyanLight.color.copy(baseline.cyanLightColor).lerp(_tmpHorizon, transitionAlpha);
    pinkLight.color.copy(baseline.pinkLightColor).lerp(_tmpSunCol, transitionAlpha);

    const islandMat = islandMesh.material as THREE.MeshStandardMaterial;
    _tmpIslandCol.setHex(0x4f3b5b).lerp(_tmpHorizon, 0.25);
    islandMat.color.copy(baseline.islandColor).lerp(_tmpIslandCol, transitionAlpha);

    const pathMat = pathMesh.material as THREE.MeshStandardMaterial;
    pathMat.color.copy(baseline.pathColor).lerp(_tmpSunCol, transitionAlpha);

    // Update clouds
    for (let i = 0; i < this.clouds.length; i++) {
      const c = this.clouds[i];
      const angle = c.baseAngle + elapsed * c.speed;
      c.group.position.set(
        Math.cos(angle) * c.radius,
        c.height + Math.sin(elapsed * 0.45 + i) * 0.35,
        Math.sin(angle) * c.radius
      );
      c.group.lookAt(0, c.height, 0);
      c.group.scale.setScalar(Math.max(0.001, c.scale * transitionAlpha));

      for (let m = 0; m < c.materials.length; m++) {
        c.materials[m].color.copy(_tmpCloudCol);
        c.materials[m].emissive.copy(_tmpHorizon);
        c.materials[m].opacity = 0.75 * transitionAlpha;
      }
    }

    if (this.distantPlanet) {
      this.distantPlanet.scale.setScalar(Math.max(0.001, transitionAlpha));
      this.distantPlanet.rotation.y = elapsed * 0.05;
    }

    if (this.solarMotes) {
      this.solarMotes.rotation.y = elapsed * 0.04;
      (this.solarMotes.material as THREE.PointsMaterial).color.copy(_tmpSunCol);
      (this.solarMotes.material as THREE.PointsMaterial).opacity = 0.72 * transitionAlpha;
    }
  }

  public dispose(handles: ExperienceSceneHandles): void {
    handles.scene.remove(this.rootGroup);
    disposeObject3DTree(this.rootGroup);
    this.skyDomeMat = null;
    this.sunSurfaceMat = null;
    this.lightRays = [];
    this.clouds = [];
    this.solarMotes = null;
    this.distantPlanet = null;
  }
}
