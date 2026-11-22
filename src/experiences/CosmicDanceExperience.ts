import * as THREE from 'three';
import { SongItem } from '../types';
import { ExperienceFrameState, ExperienceSceneHandles, ISongExperience } from './types';
import { createSoftGlowTexture, disposeObject3DTree } from './utils/proceduralShapes';

// Pre-allocated math helpers for zero-GC update loop
const _mergerFog = new THREE.Color(0x09071f);
const _mergerAmbient = new THREE.Color(0x2d245c);
const _mergerHemiSky = new THREE.Color(0x8ecae6);
const _mergerHemiGround = new THREE.Color(0x1f0f36);
const _mergerSun = new THREE.Color(0xdad8ff);
const _mergerCyan = new THREE.Color(0x64dfdf);
const _mergerPink = new THREE.Color(0xf72585);
const _mergerIsland = new THREE.Color(0x231d42);
const _mergerPath = new THREE.Color(0x8c52ff);

const _nebA = new THREE.Color(0x1b1f5e);
const _nebB = new THREE.Color(0x4cc9f0);
const _nebC = new THREE.Color(0xf4a261);

const _barycenter = new THREE.Vector3(0, 6.4, -10.5);
const _starPosA = new THREE.Vector3();
const _starPosB = new THREE.Vector3();

interface NeutronStarRig {
  root: THREE.Group;
  spinGroup: THREE.Group;
  coreMesh: THREE.Mesh;
  coreUniforms: {
    uTime: { value: number };
    uBaseColor: { value: THREE.Color };
    uHotColor: { value: THREE.Color };
    uHeat: { value: number };
  };
  coronaSprite: THREE.Sprite;
  jetTop: THREE.Mesh;
  jetBottom: THREE.Mesh;
}

interface EjectaGrain {
  dir: THREE.Vector3;
  speed: number;
  isPolar: boolean;
}

export class CosmicDanceExperience implements ISongExperience {
  public readonly song: SongItem;
  public readonly rootGroup = new THREE.Group();

  private systemGroup = new THREE.Group();
  private glowTexture: THREE.CanvasTexture | null = null;

  private starA: NeutronStarRig | null = null;
  private starB: NeutronStarRig | null = null;
  private pairGlowLight: THREE.PointLight | null = null;

  // Gravitational-wave spacetime ripple shader disk
  private gwRippleDisk: THREE.Mesh | null = null;
  private gwUniforms: {
    uTime: { value: number };
    uStrength: { value: number };
    uChirpFreq: { value: number };
    uOpacity: { value: number };
  };

  // Spiral tidal accretion plasma stream
  private tidalPoints: THREE.Points | null = null;
  private tidalPosArr: Float32Array | null = null;
  private tidalSeeds: Float32Array | null = null;

  // Kilonova explosion & aftermath remnant
  private kilonovaFlashSprite: THREE.Sprite | null = null;
  private kilonovaShockShell: THREE.Mesh | null = null;
  private kilonovaTorus: THREE.Mesh | null = null;
  private kilonovaTorusUniforms: {
    uTime: { value: number };
    uOpacity: { value: number };
  };
  private kilonovaEjectaPoints: THREE.Points | null = null;
  private kilonovaEjectaPos: Float32Array | null = null;
  private ejectaGrains: EjectaGrain[] = [];
  private remnantGroup: THREE.Group | null = null;

  private inspiralAngle = 0;

  constructor(song: SongItem) {
    this.song = song;
    this.rootGroup.name = 'experience_neutron_merger';

    this.gwUniforms = {
      uTime: { value: 0 },
      uStrength: { value: 0.4 },
      uChirpFreq: { value: 3.0 },
      uOpacity: { value: 0 },
    };

    this.kilonovaTorusUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
    };
  }

  private buildNeutronStar(baseHex: number, hotHex: number, radius: number): NeutronStarRig {
    const root = new THREE.Group();
    const spinGroup = new THREE.Group();
    // Misaligned magnetic dipole axis relative to orbital plane for sweeping pulsar jets
    spinGroup.rotation.set(0.45, 0, 0.35);
    root.add(spinGroup);

    const coreUniforms = {
      uTime: { value: 0 },
      uBaseColor: { value: new THREE.Color(baseHex) },
      uHotColor: { value: new THREE.Color(hotHex) },
      uHeat: { value: 0.4 },
    };

    const coreMat = new THREE.ShaderMaterial({
      uniforms: coreUniforms,
      vertexShader: `
        varying vec3 vLocal;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vLocal = normalize(position);
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uBaseColor;
        uniform vec3 uHotColor;
        uniform float uHeat;
        varying vec3 vLocal;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        void main() {
          // Polar magnetic hotspots at north/south poles (vLocal.y)
          float polarCap = smoothstep(0.62, 0.96, abs(vLocal.y));
          float crustCracks = 0.5 + 0.5 * sin(vLocal.x * 11.0 + uTime * 3.0) * cos(vLocal.z * 11.0 - uTime * 2.4);
          float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 2.0);

          vec3 col = mix(uBaseColor, uHotColor, clamp(polarCap * 0.95 + crustCracks * 0.25 + uHeat * 0.4, 0.0, 1.0));
          col += uHotColor * fresnel * 0.65;
          gl_FragColor = vec4(col * (1.25 + polarCap * 0.9 + uHeat * 0.7), 1.0);
        }
      `,
    });

    const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 28), coreMat);
    spinGroup.add(coreMesh);

    const coronaSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: baseHex,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    coronaSprite.scale.setScalar(radius * 5.2);
    spinGroup.add(coronaSprite);

    // Relativistic bipolar pulsar jets with longitudinal + Fresnel attenuation
    const jetMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(hotHex) },
        uOpacity: { value: 0.75 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          float fade = pow(clamp(1.0 - vUv.y, 0.0, 1.0), 1.6);
          gl_FragColor = vec4(uColor * 1.4, fade * uOpacity * 0.65);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const jetGeoTop = new THREE.CylinderGeometry(0.55, 0.07, 5.2, 16, 1, true);
    jetGeoTop.translate(0, 2.6, 0);
    const jetTop = new THREE.Mesh(jetGeoTop, jetMat);
    spinGroup.add(jetTop);

    const jetGeoBot = new THREE.CylinderGeometry(0.07, 0.55, 5.2, 16, 1, true);
    jetGeoBot.translate(0, -2.6, 0);
    const jetBottom = new THREE.Mesh(jetGeoBot, jetMat);
    spinGroup.add(jetBottom);

    // Subtle dipolar magnetic field arcs
    const arcGeo = new THREE.TorusGeometry(radius * 1.85, 0.022, 6, 36);
    const arcMat = new THREE.MeshBasicMaterial({
      color: baseHex,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const arc1 = new THREE.Mesh(arcGeo, arcMat);
    arc1.position.x = radius * 0.9;
    const arc2 = new THREE.Mesh(arcGeo, arcMat);
    arc2.position.x = -radius * 0.9;
    spinGroup.add(arc1, arc2);

    return {
      root,
      spinGroup,
      coreMesh,
      coreUniforms,
      coronaSprite,
      jetTop,
      jetBottom,
    };
  }

  public enter(handles: ExperienceSceneHandles): void {
    this.inspiralAngle = 0;
    this.glowTexture = createSoftGlowTexture(128);
    this.glowTexture.userData.sharedAsset = false;

    this.systemGroup.position.copy(_barycenter);
    this.rootGroup.add(this.systemGroup);

    // 1. Two Magnetized Neutron Stars (Sapphire-Cyan & Violet-Gold)
    this.starA = this.buildNeutronStar(0x4cc9f0, 0xe0fbfc, 0.68);
    this.starB = this.buildNeutronStar(0xb56dff, 0xffe29a, 0.64);
    this.systemGroup.add(this.starA.root);
    this.systemGroup.add(this.starB.root);

    this.pairGlowLight = new THREE.PointLight(0xb8c0ff, 2.8, 55);
    this.systemGroup.add(this.pairGlowLight);

    // 2. Gravitational-Wave Quadrupole Spacetime Ripple Disk
    const gwGeo = new THREE.PlaneGeometry(46, 46, 1, 1);
    gwGeo.rotateX(-Math.PI / 2);
    const gwMat = new THREE.ShaderMaterial({
      uniforms: this.gwUniforms,
      vertexShader: `
        varying vec2 vPos;
        void main() {
          vPos = position.xz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform float uStrength;
        uniform float uChirpFreq;
        uniform float uOpacity;
        varying vec2 vPos;

        void main() {
          float r = length(vPos);
          if (r > 23.0 || r < 0.7) discard;

          float theta = atan(vPos.y, vPos.x);
          // Spiral quadrupole gravitational wave pattern (m = 2)
          float phase = 2.0 * theta - r * (0.55 + uChirpFreq * 0.08) + uTime * uChirpFreq;
          float wave = pow(0.5 + 0.5 * sin(phase), 3.0);
          float radialFade = smoothstep(0.7, 3.2, r) * smoothstep(23.0, 7.0, r);

          vec3 col = mix(vec3(0.42, 0.78, 1.0), vec3(0.84, 0.58, 1.0), 0.5 + 0.5 * cos(phase * 0.5));
          float alpha = wave * radialFade * uStrength * uOpacity * 0.58;
          gl_FragColor = vec4(col, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.gwRippleDisk = new THREE.Mesh(gwGeo, gwMat);
    this.gwRippleDisk.position.y = -0.3;
    this.systemGroup.add(this.gwRippleDisk);

    // 3. Spiral Tidal Plasma Accretion Stream Between Stars
    const tidalCount = Number(this.song.experienceParams.trailParticles) || 240;
    this.tidalPosArr = new Float32Array(tidalCount * 3);
    this.tidalSeeds = new Float32Array(tidalCount);
    const tidalCols = new Float32Array(tidalCount * 3);

    const cCyan = new THREE.Color(0x72efdd);
    const cViolet = new THREE.Color(0xe0aaff);
    const cGold = new THREE.Color(0xffd166);

    for (let i = 0; i < tidalCount; i++) {
      this.tidalSeeds[i] = i / tidalCount;
      const c = i % 3 === 0 ? cCyan : i % 3 === 1 ? cViolet : cGold;
      tidalCols[i * 3] = c.r;
      tidalCols[i * 3 + 1] = c.g;
      tidalCols[i * 3 + 2] = c.b;
    }

    const tidalGeo = new THREE.BufferGeometry();
    tidalGeo.setAttribute('position', new THREE.BufferAttribute(this.tidalPosArr, 3));
    tidalGeo.setAttribute('color', new THREE.BufferAttribute(tidalCols, 3));
    this.tidalPoints = new THREE.Points(
      tidalGeo,
      new THREE.PointsMaterial({
        map: this.glowTexture,
        size: 0.45,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.tidalPoints.frustumCulled = false;
    this.systemGroup.add(this.tidalPoints);

    // 4. Kilonova Merger Assets (Flash, Expanding Shock Shell, Equatorial Gold-Crimson Torus, Ejecta)
    this.kilonovaFlashSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xf4f9ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.systemGroup.add(this.kilonovaFlashSprite);

    this.kilonovaShockShell = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xa2d2ff,
        transparent: true,
        opacity: 0,
        wireframe: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.systemGroup.add(this.kilonovaShockShell);

    const knTorusGeo = new THREE.TorusGeometry(1.0, 0.34, 18, 64);
    knTorusGeo.rotateX(Math.PI / 2);
    const knTorusMat = new THREE.ShaderMaterial({
      uniforms: this.kilonovaTorusUniforms,
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
          float fil = 0.55 + 0.45 * sin(vUv.x * 18.0 - uTime * 1.4) * cos(vUv.y * 8.0);
          float band = smoothstep(0.0, 0.4, sin(vUv.y * 3.14159));
          vec3 cGold = vec3(1.0, 0.78, 0.34);
          vec3 cCrimson = vec3(0.96, 0.36, 0.22);
          vec3 cViolet = vec3(0.76, 0.44, 0.98);
          vec3 col = mix(cGold, cCrimson, fil);
          col = mix(col, cViolet, pow(1.0 - band, 1.5) * 0.45);
          gl_FragColor = vec4(col * 1.25, band * fil * uOpacity);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.kilonovaTorus = new THREE.Mesh(knTorusGeo, knTorusMat);
    this.systemGroup.add(this.kilonovaTorus);

    // Kilonova multi-spectral ejecta cloud (blue-violet polar jets + gold/amber/crimson equatorial cloud)
    const ejectaCount = 420;
    this.kilonovaEjectaPos = new Float32Array(ejectaCount * 3);
    const ejectaCols = new Float32Array(ejectaCount * 3);
    const cPolarBlue = new THREE.Color(0xcaf0f8);
    const cPolarViolet = new THREE.Color(0xc77dff);
    const cEqGold = new THREE.Color(0xffd166);
    const cEqOrange = new THREE.Color(0xf77f00);

    for (let i = 0; i < ejectaCount; i++) {
      const isPolar = i % 3 === 0;
      const theta = Math.random() * Math.PI * 2;
      let phi: number;
      if (isPolar) {
        phi = Math.random() > 0.5 ? Math.random() * 0.45 : Math.PI - Math.random() * 0.45;
      } else {
        phi = Math.PI * 0.5 + (Math.random() - 0.5) * 0.58;
      }
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      );
      this.ejectaGrains.push({
        dir,
        speed: isPolar ? 1.35 + Math.random() * 1.15 : 0.65 + Math.random() * 0.85,
        isPolar,
      });

      const col = isPolar
        ? i % 2 === 0
          ? cPolarBlue
          : cPolarViolet
        : i % 2 === 0
          ? cEqGold
          : cEqOrange;
      ejectaCols[i * 3] = col.r;
      ejectaCols[i * 3 + 1] = col.g;
      ejectaCols[i * 3 + 2] = col.b;
    }

    const knGeo = new THREE.BufferGeometry();
    knGeo.setAttribute('position', new THREE.BufferAttribute(this.kilonovaEjectaPos, 3));
    knGeo.setAttribute('color', new THREE.BufferAttribute(ejectaCols, 3));
    this.kilonovaEjectaPoints = new THREE.Points(
      knGeo,
      new THREE.PointsMaterial({
        map: this.glowTexture,
        size: 0.72,
        vertexColors: true,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.kilonovaEjectaPoints.frustumCulled = false;
    this.systemGroup.add(this.kilonovaEjectaPoints);

    // 5. Merged Central Hypermassive Magnetar Remnant
    const remnant = new THREE.Group();
    const remCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.88, 28, 28),
      new THREE.MeshBasicMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0 })
    );
    const remHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0xb8dcff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    remHalo.scale.setScalar(7.5);
    remnant.add(remCore, remHalo);
    this.remnantGroup = remnant;
    this.systemGroup.add(remnant);

    handles.scene.add(this.rootGroup);
  }

  public update(frame: ExperienceFrameState, handles: ExperienceSceneHandles): void {
    const { delta, elapsed, songProgress, transitionAlpha } = frame;
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
      renderer,
      celestialSystem,
    } = handles;

    fog.color.copy(baseline.fogColor).lerp(_mergerFog, transitionAlpha);
    ambientLight.color.copy(baseline.ambientColor).lerp(_mergerAmbient, transitionAlpha);
    ambientLight.intensity = THREE.MathUtils.lerp(baseline.ambientIntensity, 0.85, transitionAlpha);
    hemiLight.color.copy(baseline.hemiSkyColor).lerp(_mergerHemiSky, transitionAlpha);
    hemiLight.groundColor.copy(baseline.hemiGroundColor).lerp(_mergerHemiGround, transitionAlpha);
    sunLight.color.copy(baseline.sunColor).lerp(_mergerSun, transitionAlpha);
    sunLight.intensity = THREE.MathUtils.lerp(baseline.sunIntensity, 1.05, transitionAlpha);
    cyanLight.color.copy(baseline.cyanLightColor).lerp(_mergerCyan, transitionAlpha);
    pinkLight.color.copy(baseline.pinkLightColor).lerp(_mergerPink, transitionAlpha);

    const islandMat = islandMesh.material as THREE.MeshStandardMaterial;
    islandMat.color.copy(baseline.islandColor).lerp(_mergerIsland, transitionAlpha);
    const pathMat = pathMesh.material as THREE.MeshStandardMaterial;
    pathMat.color.copy(baseline.pathColor).lerp(_mergerPath, transitionAlpha);

    this.systemGroup.scale.setScalar(Math.max(0.001, transitionAlpha));

    // Timeline across songProgress:
    // 0.00 -> 0.62: Inspiral + Gravitational Waves + Tidal Accretion
    // 0.62 -> 0.84: Collision Merger & Kilonova Explosion
    // 0.82 -> 1.00: Remnant + Expanding Kilonova Glow
    const inspiralT = THREE.MathUtils.clamp(songProgress / 0.62, 0, 1);
    const mergerAge = Math.max(0, (songProgress - 0.62) / 0.38); // 0 -> 1 after collision
    const isMerged = songProgress >= 0.62;

    // 1. Accelerating Binary Inspiral
    const sep = isMerged ? 0 : 4.2 * Math.pow(1 - inspiralT, 0.45) + 0.52;
    const orbitalFreq = 1.6 + Math.pow(inspiralT, 2.2) * 14.0;
    this.inspiralAngle += delta * orbitalFreq;

    const cosO = Math.cos(this.inspiralAngle);
    const sinO = Math.sin(this.inspiralAngle);

    if (this.starA && this.starB) {
      const visibleBeforeMerger = !isMerged;
      this.starA.root.visible = visibleBeforeMerger;
      this.starB.root.visible = visibleBeforeMerger;

      if (visibleBeforeMerger) {
        _starPosA.set(cosO * sep, Math.sin(elapsed * 1.4) * 0.14, sinO * sep);
        _starPosB.set(-cosO * sep, -Math.sin(elapsed * 1.4) * 0.14, -sinO * sep);
        this.starA.root.position.copy(_starPosA);
        this.starB.root.position.copy(_starPosB);

        // Tidal deformation elongation facing partner as separation drops
        this.starA.root.lookAt(_starPosB);
        this.starB.root.lookAt(_starPosA);
        const tidalStretch = 1.0 + Math.pow(inspiralT, 2.6) * 0.65;
        const tidalSquash = 1.0 / Math.sqrt(tidalStretch);
        this.starA.coreMesh.scale.set(tidalSquash, tidalSquash, tidalStretch);
        this.starB.coreMesh.scale.set(tidalSquash, tidalSquash, tidalStretch);

        // Rapid pulsar spin + hotspot heat climb
        const spinRate = 5.5 + inspiralT * 14.0;
        this.starA.spinGroup.rotation.y += delta * spinRate;
        this.starB.spinGroup.rotation.y -= delta * spinRate * 1.12;

        this.starA.coreUniforms.uTime.value = elapsed;
        this.starA.coreUniforms.uHeat.value = 0.3 + inspiralT * 0.7;
        this.starB.coreUniforms.uTime.value = elapsed;
        this.starB.coreUniforms.uHeat.value = 0.3 + inspiralT * 0.7;

        // Tidal Plasma Stream connecting stars
        if (this.tidalPoints && this.tidalPosArr && this.tidalSeeds) {
          this.tidalPoints.visible = true;
          const count = this.tidalSeeds.length;
          for (let i = 0; i < count; i++) {
            const s = (this.tidalSeeds[i] + elapsed * (0.45 + inspiralT * 1.2)) % 1;
            const bridgeCurve = Math.sin(s * Math.PI);
            const swirlAng = this.inspiralAngle + s * Math.PI * 2.2;
            const px = THREE.MathUtils.lerp(_starPosA.x, _starPosB.x, s) + Math.cos(swirlAng) * bridgeCurve * (0.3 + sep * 0.22);
            const py = THREE.MathUtils.lerp(_starPosA.y, _starPosB.y, s) + Math.sin(s * Math.PI * 3 + elapsed * 3) * 0.25 * bridgeCurve;
            const pz = THREE.MathUtils.lerp(_starPosA.z, _starPosB.z, s) + Math.sin(swirlAng) * bridgeCurve * (0.3 + sep * 0.22);
            this.tidalPosArr[i * 3] = px;
            this.tidalPosArr[i * 3 + 1] = py;
            this.tidalPosArr[i * 3 + 2] = pz;
          }
          this.tidalPoints.geometry.attributes.position.needsUpdate = true;
          (this.tidalPoints.material as THREE.PointsMaterial).opacity =
            (0.45 + inspiralT * 0.55) * transitionAlpha;
        }
      } else if (this.tidalPoints) {
        this.tidalPoints.visible = false;
      }
    }

    // 2. Gravitational-Wave Spacetime Ripples (chirping up to collision, damping smoothly after)
    const gwEnvelope = isMerged ? Math.max(0, 1.0 - mergerAge * 2.2) : 0.3 + inspiralT * 0.85;
    this.gwUniforms.uTime.value = elapsed;
    this.gwUniforms.uChirpFreq.value = 2.8 + inspiralT * 9.5;
    this.gwUniforms.uStrength.value = gwEnvelope;
    this.gwUniforms.uOpacity.value = transitionAlpha;

    celestialSystem?.blendModulation(transitionAlpha, {
      starBrightness: 1.05 + (isMerged ? Math.max(0, 1 - mergerAge * 2) * 0.5 : 0),
      nebulaOpacity: 0.62,
      nebulaA: _nebA,
      nebulaB: _nebB,
      nebulaC: _nebC,
      waveIntensity: gwEnvelope * 0.65,
    });

    // 3. Merger Flash, Shock Shell, Gold-Crimson Kilonova Ejecta & Central Remnant
    const flashEnv = isMerged ? Math.exp(-mergerAge * 7.5) : 0;
    if (this.kilonovaFlashSprite) {
      const fMat = this.kilonovaFlashSprite.material as THREE.SpriteMaterial;
      fMat.opacity = flashEnv * transitionAlpha;
      this.kilonovaFlashSprite.scale.setScalar((2.0 + (1 - flashEnv) * 18.0) * (flashEnv > 0.02 ? 1 : 0.01));
    }

    if (this.kilonovaShockShell) {
      this.kilonovaShockShell.visible = isMerged && mergerAge < 0.7;
      if (this.kilonovaShockShell.visible) {
        const sScale = 1.0 + mergerAge * 28.0;
        this.kilonovaShockShell.scale.setScalar(sScale);
        (this.kilonovaShockShell.material as THREE.MeshBasicMaterial).opacity =
          Math.max(0, 1 - mergerAge / 0.7) * 0.45 * transitionAlpha;
      }
    }

    if (this.kilonovaTorus) {
      this.kilonovaTorus.visible = isMerged;
      if (isMerged) {
        const torusExpand = 1.4 + mergerAge * 11.5;
        this.kilonovaTorus.scale.setScalar(torusExpand);
        this.kilonovaTorus.rotation.y = elapsed * 0.35;
        this.kilonovaTorusUniforms.uTime.value = elapsed;
        this.kilonovaTorusUniforms.uOpacity.value =
          THREE.MathUtils.smoothstep(mergerAge, 0, 0.14) *
          THREE.MathUtils.lerp(0.95, 0.42, mergerAge) *
          transitionAlpha;
      }
    }

    if (this.kilonovaEjectaPoints && this.kilonovaEjectaPos) {
      this.kilonovaEjectaPoints.visible = isMerged;
      if (isMerged) {
        for (let i = 0; i < this.ejectaGrains.length; i++) {
          const g = this.ejectaGrains[i];
          const dist = 0.6 + mergerAge * 16.5 * g.speed;
          this.kilonovaEjectaPos[i * 3] = g.dir.x * dist;
          this.kilonovaEjectaPos[i * 3 + 1] = g.dir.y * dist;
          this.kilonovaEjectaPos[i * 3 + 2] = g.dir.z * dist;
        }
        this.kilonovaEjectaPoints.geometry.attributes.position.needsUpdate = true;
        (this.kilonovaEjectaPoints.material as THREE.PointsMaterial).opacity =
          THREE.MathUtils.lerp(0.95, 0.48, mergerAge) * transitionAlpha;
      }
    }

    if (this.remnantGroup) {
      const remAppear = isMerged ? THREE.MathUtils.smoothstep(mergerAge, 0.08, 0.28) : 0;
      this.remnantGroup.visible = remAppear > 0.01;
      if (this.remnantGroup.visible) {
        const pulse = 1.0 + Math.sin(elapsed * 4.2) * 0.12;
        this.remnantGroup.scale.setScalar(pulse * remAppear);
        const remCore = this.remnantGroup.children[0] as THREE.Mesh;
        const remHalo = this.remnantGroup.children[1] as THREE.Sprite;
        (remCore.material as THREE.MeshBasicMaterial).opacity = remAppear * transitionAlpha;
        (remHalo.material as THREE.SpriteMaterial).opacity = remAppear * 0.88 * transitionAlpha;
      }
    }

    if (this.pairGlowLight) {
      this.pairGlowLight.intensity = (2.8 + inspiralT * 2.2 + flashEnv * 6.5) * transitionAlpha;
    }

    renderer.toneMappingExposure = THREE.MathUtils.lerp(
      baseline.exposure,
      1.08 + flashEnv * 0.36,
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
    this.starA = null;
    this.starB = null;
    this.pairGlowLight = null;
    this.gwRippleDisk = null;
    this.tidalPoints = null;
    this.tidalPosArr = null;
    this.tidalSeeds = null;
    this.kilonovaFlashSprite = null;
    this.kilonovaShockShell = null;
    this.kilonovaTorus = null;
    this.kilonovaEjectaPoints = null;
    this.kilonovaEjectaPos = null;
    this.ejectaGrains = [];
    this.remnantGroup = null;
  }
}
