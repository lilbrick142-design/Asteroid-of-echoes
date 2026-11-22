import * as THREE from 'three';
import { createSoftGlowTexture, disposeObject3DTree } from './utils/proceduralShapes';
import { QualityPreset } from '../services/qualitySettings';

export interface CelestialModulation {
  starBrightness?: number;
  nebulaOpacity?: number;
  nebulaTintA?: THREE.Color;
  nebulaTintB?: THREE.Color;
  nebulaTintC?: THREE.Color;
  waveIntensity?: number;
  waveFreq?: number;
  cometFrequency?: number;
  constellationOpacity?: number;
}

interface SkyComet {
  group: THREE.Group;
  head: THREE.Sprite;
  tail: THREE.Mesh;
  startPos: THREE.Vector3;
  velocity: THREE.Vector3;
  age: number;
  duration: number;
  cooldown: number;
}

const MAX_STARS = 2600;

const _baseNebulaA = new THREE.Color(0x3a1c71);
const _baseNebulaB = new THREE.Color(0x4cc9f0);
const _baseNebulaC = new THREE.Color(0xf72585);
const _tmpColorA = new THREE.Color();
const _tmpColorB = new THREE.Color();
const _tmpColorC = new THREE.Color();

const _cometColorPalette = [
  new THREE.Color(0xa2d2ff),
  new THREE.Color(0xffd166),
  new THREE.Color(0xe0c3fc),
];

export class CelestialEnvironmentSystem {
  public readonly rootGroup = new THREE.Group();

  private starField: THREE.Points;
  private starGeo: THREE.BufferGeometry;
  private starUniforms: {
    uTime: { value: number };
    uBrightness: { value: number };
    uWaveIntensity: { value: number };
    uWaveFreq: { value: number };
    uPixelRatio: { value: number };
  };

  private nebulaDomes: THREE.Mesh[] = [];
  private nebulaUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
    uColorA: { value: THREE.Color };
    uColorB: { value: THREE.Color };
    uColorC: { value: THREE.Color };
  };

  private constellationPivot = new THREE.Group();
  private constellationLines: THREE.LineSegments;
  private constellationStars: THREE.Points;

  private comets: SkyComet[] = [];
  private glowTexture: THREE.CanvasTexture;
  private cometFreqMultiplier = 1.0;

  constructor(isSoftwareGl: boolean) {
    this.rootGroup.name = 'celestial_environment_system';
    this.glowTexture = createSoftGlowTexture(128);
    this.glowTexture.userData.sharedAsset = false;

    // 1. Multi-Size Spectral Twinkling Starfield Shader
    const positions = new Float32Array(MAX_STARS * 3);
    const colors = new Float32Array(MAX_STARS * 3);
    const sizes = new Float32Array(MAX_STARS);
    const phases = new Float32Array(MAX_STARS);
    const speeds = new Float32Array(MAX_STARS);

    const spectralColors = [
      new THREE.Color(0xcad8ff), // O/B blue-white
      new THREE.Color(0xf8f9fa), // A white
      new THREE.Color(0xfff1d0), // F/G warm champagne
      new THREE.Color(0xffd6a5), // K soft amber
      new THREE.Color(0xe5d4ff), // Soft lavender starlight
    ];

    for (let i = 0; i < MAX_STARS; i++) {
      // Blend isotropic distribution with a tilted galactic Milky-Way band
      const inBand = i % 3 !== 0;
      const theta = Math.random() * Math.PI * 2;
      let phi: number;
      if (inBand) {
        const bandSpread = (Math.random() - 0.5) * 0.55 + (Math.random() - 0.5) * 0.35;
        phi = Math.PI * 0.5 + bandSpread;
      } else {
        phi = Math.acos(2 * Math.random() - 1);
      }

      const r = 135 + Math.random() * 115;
      let x = r * Math.sin(phi) * Math.cos(theta);
      let y = r * Math.cos(phi);
      let z = r * Math.sin(phi) * Math.sin(theta);

      // Tilt the galactic plane ~28 degrees for sweeping night-sky framing
      const tilt = 0.48;
      const ty = y * Math.cos(tilt) - z * Math.sin(tilt);
      const tz = y * Math.sin(tilt) + z * Math.cos(tilt);
      y = ty;
      z = tz;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const c = spectralColors[i % spectralColors.length];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      const sizeRoll = Math.random();
      sizes[i] = sizeRoll > 0.94 ? 4.4 + Math.random() * 2.2 : 1.3 + sizeRoll * 2.3;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.8 + Math.random() * 2.2;
    }

    this.starGeo = new THREE.BufferGeometry();
    this.starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.starGeo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    this.starGeo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    this.starGeo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
    this.starGeo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    this.starGeo.setDrawRange(0, isSoftwareGl ? 1100 : MAX_STARS);

    this.starUniforms = {
      uTime: { value: 0 },
      uBrightness: { value: 1.0 },
      uWaveIntensity: { value: 0.0 },
      uWaveFreq: { value: 9.0 },
      uPixelRatio: { value: isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2) },
    };

    const starMat = new THREE.ShaderMaterial({
      uniforms: this.starUniforms,
      vertexShader: `
        attribute vec3 aColor;
        attribute float aSize;
        attribute float aPhase;
        attribute float aSpeed;
        uniform float uTime;
        uniform float uWaveIntensity;
        uniform float uWaveFreq;
        uniform float uPixelRatio;
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vColor = aColor;
          float angle = atan(position.z, position.x);
          float ripple = sin(angle * 2.0 - uTime * uWaveFreq + length(position.xz) * 0.03) * uWaveIntensity;
          float twinkle = 0.65 + 0.35 * sin(uTime * aSpeed + aPhase);
          vTwinkle = twinkle + ripple * 0.4;

          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = clamp(aSize * uPixelRatio * (260.0 / max(1.0, -mvPos.z)) * (0.85 + twinkle * 0.25), 1.0, 18.0);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uBrightness;
        varying vec3 vColor;
        varying float vTwinkle;

        void main() {
          vec2 d = gl_PointCoord - vec2(0.5);
          float r = length(d);
          if (r > 0.5) discard;

          float core = smoothstep(0.5, 0.04, r);
          float spike = exp(-abs(d.x) * 14.0) * exp(-abs(d.y) * 5.0) + exp(-abs(d.y) * 14.0) * exp(-abs(d.x) * 5.0);
          float alpha = clamp((core * 0.85 + spike * 0.25) * vTwinkle * uBrightness, 0.0, 1.0);
          gl_FragColor = vec4(vColor * (1.05 + spike * 0.35), alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    this.starField = new THREE.Points(this.starGeo, starMat);
    this.starField.frustumCulled = false;
    this.rootGroup.add(this.starField);

    // 2. Layered Drifting FBM Cosmic Nebula Curtains
    this.nebulaUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0.44 },
      uColorA: { value: _baseNebulaA.clone() },
      uColorB: { value: _baseNebulaB.clone() },
      uColorC: { value: _baseNebulaC.clone() },
    };

    const nebulaShader = new THREE.ShaderMaterial({
      uniforms: this.nebulaUniforms,
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uOpacity;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform vec3 uColorC;
        varying vec3 vDir;

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
            p = p * 2.04 + vec3(0.12, -0.09, 0.15);
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec3 q = vDir * 2.4 + vec3(uTime * 0.014, -uTime * 0.009, uTime * 0.011);
          float n1 = fbm(q);
          float n2 = fbm(q * 1.65 - vec3(uTime * 0.018, 0.5, -uTime * 0.01));

          // Concentrate tendrils around sweeping celestial arcs
          float bandMask = smoothstep(-0.35, 0.55, 1.0 - abs(vDir.y * 1.25 - vDir.x * 0.35));
          float wisps = smoothstep(0.36, 0.78, n1 * 0.62 + n2 * 0.48) * bandMask;

          vec3 col = mix(uColorA, uColorB, smoothstep(0.3, 0.75, n2));
          col = mix(col, uColorC, smoothstep(0.45, 0.85, n1 * n2 * 1.8));

          float alpha = wisps * uOpacity;
          if (alpha < 0.004) discard;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });

    const domeOuter = new THREE.Mesh(new THREE.SphereGeometry(210, 32, 24), nebulaShader);
    this.nebulaDomes.push(domeOuter);
    this.rootGroup.add(domeOuter);

    // 3. Slowly Rotating Distant Astronomical Constellations
    const constellationSets: number[][][] = [
      // Northern Crown arc
      [
        [-88, 56, -110],
        [-74, 62, -116],
        [-58, 59, -120],
        [-44, 66, -112],
        [-32, 58, -104],
      ],
      // Eastern Lyra / Harp motif
      [
        [82, 48, -98],
        [94, 56, -92],
        [102, 49, -84],
        [92, 41, -88],
        [82, 48, -98],
      ],
      // Western Celestial Compass
      [
        [-110, 34, 42],
        [-96, 46, 36],
        [-84, 38, 22],
        [-94, 28, 30],
      ],
    ];

    const segCoords: number[] = [];
    const nodeCoords: number[] = [];
    constellationSets.forEach((chain) => {
      for (let i = 0; i < chain.length; i++) {
        nodeCoords.push(chain[i][0], chain[i][1], chain[i][2]);
        if (i < chain.length - 1) {
          segCoords.push(
            chain[i][0], chain[i][1], chain[i][2],
            chain[i + 1][0], chain[i + 1][1], chain[i + 1][2]
          );
        }
      }
    });

    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(segCoords, 3));
    this.constellationLines = new THREE.LineSegments(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: 0xa2d2ff,
        transparent: true,
        opacity: 0.24,
        depthWrite: false,
      })
    );

    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodeCoords, 3));
    this.constellationStars = new THREE.Points(
      nodeGeo,
      new THREE.PointsMaterial({
        map: this.glowTexture,
        color: 0xe0e1ff,
        size: 3.4,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );

    this.constellationPivot.add(this.constellationLines);
    this.constellationPivot.add(this.constellationStars);
    this.rootGroup.add(this.constellationPivot);

    // 4. Pool of Passing Comets & Shooting Stars
    const tailGeo = new THREE.ConeGeometry(0.32, 9.5, 6);
    tailGeo.rotateX(-Math.PI / 2);
    tailGeo.translate(0, 0, -4.75);

    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group();
      const tint = _cometColorPalette[i % _cometColorPalette.length];

      const head = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: tint,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      head.scale.set(2.8, 2.8, 1);

      const tail = new THREE.Mesh(
        tailGeo,
        new THREE.MeshBasicMaterial({
          color: tint,
          transparent: true,
          opacity: 0,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );

      group.add(head);
      group.add(tail);
      group.visible = false;
      this.rootGroup.add(group);

      const comet: SkyComet = {
        group,
        head,
        tail,
        startPos: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        age: 0,
        duration: 2.5,
        cooldown: 1.5 + i * 3.8,
      };
      this.resetCometTrajectory(comet);
      this.comets.push(comet);
    }
  }

  private resetCometTrajectory(comet: SkyComet) {
    const theta = Math.random() * Math.PI * 2;
    const dist = 105 + Math.random() * 45;
    const height = 24 + Math.random() * 48;
    comet.startPos.set(Math.cos(theta) * dist, height, Math.sin(theta) * dist);

    // Sweep tangentially across the sky dome
    const speed = 28 + Math.random() * 22;
    const dirX = -Math.sin(theta) * speed + (Math.random() - 0.5) * 10;
    const dirY = -(5 + Math.random() * 12);
    const dirZ = Math.cos(theta) * speed + (Math.random() - 0.5) * 10;
    comet.velocity.set(dirX, dirY, dirZ);

    comet.age = 0;
    comet.duration = 1.8 + Math.random() * 1.8;
    comet.cooldown = (4.0 + Math.random() * 7.5) / Math.max(0.25, this.cometFreqMultiplier);
  }

  public applyQualityPreset(preset: QualityPreset, isSoftwareGl: boolean) {
    const baseMax = isSoftwareGl ? 1100 : MAX_STARS;
    const count = Math.max(400, Math.floor(baseMax * preset.particleDensity));
    this.starGeo.setDrawRange(0, count);
    this.starUniforms.uPixelRatio.value = isSoftwareGl
      ? 1
      : Math.min(window.devicePixelRatio, preset.maxPixelRatio);
  }

  public setModulation(mod: CelestialModulation) {
    if (mod.starBrightness !== undefined) {
      this.starUniforms.uBrightness.value = mod.starBrightness;
    }
    if (mod.nebulaOpacity !== undefined) {
      this.nebulaUniforms.uOpacity.value = mod.nebulaOpacity;
    }
    if (mod.nebulaTintA) this.nebulaUniforms.uColorA.value.copy(mod.nebulaTintA);
    if (mod.nebulaTintB) this.nebulaUniforms.uColorB.value.copy(mod.nebulaTintB);
    if (mod.nebulaTintC) this.nebulaUniforms.uColorC.value.copy(mod.nebulaTintC);
    if (mod.waveIntensity !== undefined) {
      this.starUniforms.uWaveIntensity.value = mod.waveIntensity;
    }
    if (mod.waveFreq !== undefined) {
      this.starUniforms.uWaveFreq.value = mod.waveFreq;
    }
    if (mod.cometFrequency !== undefined) {
      this.cometFreqMultiplier = mod.cometFrequency;
    }
    if (mod.constellationOpacity !== undefined) {
      (this.constellationLines.material as THREE.LineBasicMaterial).opacity =
        0.24 * mod.constellationOpacity;
      (this.constellationStars.material as THREE.PointsMaterial).opacity =
        0.72 * mod.constellationOpacity;
    }
  }

  public resetModulation() {
    this.starUniforms.uBrightness.value = 1.0;
    this.starUniforms.uWaveIntensity.value = 0.0;
    this.starUniforms.uWaveFreq.value = 9.0;
    this.nebulaUniforms.uOpacity.value = 0.44;
    this.nebulaUniforms.uColorA.value.copy(_baseNebulaA);
    this.nebulaUniforms.uColorB.value.copy(_baseNebulaB);
    this.nebulaUniforms.uColorC.value.copy(_baseNebulaC);
    this.cometFreqMultiplier = 1.0;
    (this.constellationLines.material as THREE.LineBasicMaterial).opacity = 0.24;
    (this.constellationStars.material as THREE.PointsMaterial).opacity = 0.72;
  }

  public blendModulation(
    alpha: number,
    target: {
      starBrightness?: number;
      nebulaOpacity?: number;
      nebulaA?: THREE.Color;
      nebulaB?: THREE.Color;
      nebulaC?: THREE.Color;
      waveIntensity?: number;
      constellationOpacity?: number;
    }
  ) {
    if (target.starBrightness !== undefined) {
      this.starUniforms.uBrightness.value = THREE.MathUtils.lerp(1.0, target.starBrightness, alpha);
    }
    if (target.nebulaOpacity !== undefined) {
      this.nebulaUniforms.uOpacity.value = THREE.MathUtils.lerp(0.44, target.nebulaOpacity, alpha);
    }
    if (target.nebulaA) {
      _tmpColorA.copy(_baseNebulaA).lerp(target.nebulaA, alpha);
      this.nebulaUniforms.uColorA.value.copy(_tmpColorA);
    }
    if (target.nebulaB) {
      _tmpColorB.copy(_baseNebulaB).lerp(target.nebulaB, alpha);
      this.nebulaUniforms.uColorB.value.copy(_tmpColorB);
    }
    if (target.nebulaC) {
      _tmpColorC.copy(_baseNebulaC).lerp(target.nebulaC, alpha);
      this.nebulaUniforms.uColorC.value.copy(_tmpColorC);
    }
    if (target.waveIntensity !== undefined) {
      this.starUniforms.uWaveIntensity.value = target.waveIntensity * alpha;
    }
    if (target.constellationOpacity !== undefined) {
      const cAlpha = THREE.MathUtils.lerp(1.0, target.constellationOpacity, alpha);
      (this.constellationLines.material as THREE.LineBasicMaterial).opacity = 0.24 * cAlpha;
      (this.constellationStars.material as THREE.PointsMaterial).opacity = 0.72 * cAlpha;
    }
  }

  public update(delta: number, elapsed: number) {
    this.starUniforms.uTime.value = elapsed;
    this.nebulaUniforms.uTime.value = elapsed;

    this.starField.rotation.y = elapsed * 0.0025;
    this.constellationPivot.rotation.y = elapsed * 0.0045;

    for (let i = 0; i < this.comets.length; i++) {
      const c = this.comets[i];
      if (c.cooldown > 0) {
        c.cooldown -= delta;
        c.group.visible = false;
        continue;
      }

      c.age += delta;
      if (c.age >= c.duration) {
        c.group.visible = false;
        this.resetCometTrajectory(c);
        continue;
      }

      c.group.visible = true;
      const t = c.age / c.duration;
      const env = Math.sin(t * Math.PI);

      c.group.position.copy(c.startPos).addScaledVector(c.velocity, c.age);
      c.group.lookAt(
        c.group.position.x + c.velocity.x,
        c.group.position.y + c.velocity.y,
        c.group.position.z + c.velocity.z
      );
      (c.head.material as THREE.SpriteMaterial).opacity = env * 0.9;
      (c.tail.material as THREE.MeshBasicMaterial).opacity = env * 0.45;
    }
  }

  public dispose() {
    disposeObject3DTree(this.rootGroup);
    this.glowTexture.dispose();
  }
}
