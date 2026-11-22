import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SongItem } from '../types';
import { ExperienceFrameState, ExperienceSceneHandles, ISongExperience } from './types';
import { disposeObject3DTree } from './utils/proceduralShapes';
import { qualitySettings } from '../services/qualitySettings';

const _asciiFog = new THREE.Color(0x161128);
const _asciiAmbient = new THREE.Color(0x5a4f78);
const _asciiSun = new THREE.Color(0xffe6c2);
const _asciiCyan = new THREE.Color(0x9ae3ff);
const _asciiPink = new THREE.Color(0xf7b2cc);
const _asciiNebulaA = new THREE.Color(0x3a2a5e);
const _asciiNebulaB = new THREE.Color(0x9ae3ff);
const _asciiNebulaC = new THREE.Color(0xf2c6de);

// 28 perceptual density glyphs (0..27) + 4 directional edge glyphs (28..31) = 32 glyphs
const DENSITY_GLYPH_COUNT = 28;
const ASCII_GLYPHS = [
  ' ', '.', ',', ':', ';', "'", '`', '~',
  '-', '^', '+', '=', '*', 'r', 'c', 'v',
  'x', 'o', 's', 'a', 'e', 'k', 'O', '$',
  '#', '%', '@', '&',
  // Directional contour glyphs (indices 28..31)
  '|', '-', '/', '\\',
];

function createAsciiAtlasTexture(anisotropy: number): THREE.CanvasTexture {
  const cellW = 64;
  const cellH = 96;
  const canvas = document.createElement('canvas');
  canvas.width = cellW * ASCII_GLYPHS.length; // 2048px
  canvas.height = cellH;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 66px "JetBrains Mono", "Fira Code", "SFMono-Regular", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ASCII_GLYPHS.forEach((glyph, idx) => {
    if (glyph !== ' ') {
      ctx.fillText(glyph, idx * cellW + cellW * 0.5, cellH * 0.53);
    }
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = Math.min(4, anisotropy);
  tex.generateMipmaps = false;
  return tex;
}

const AsciiPastelShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tAsciiAtlas: { value: null as THREE.Texture | null },
    uResolution: { value: new THREE.Vector2(1280, 720) },
    uCellSize: { value: new THREE.Vector2(8.0, 12.0) },
    uGlyphCount: { value: ASCII_GLYPHS.length },
    uDensityCount: { value: DENSITY_GLYPH_COUNT },
    uTime: { value: 0 },
    uMix: { value: 0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tAsciiAtlas;
    uniform vec2 uResolution;
    uniform vec2 uCellSize;
    uniform float uGlyphCount;
    uniform float uDensityCount;
    uniform float uTime;
    uniform float uMix;
    varying vec2 vUv;

    float sampleLum(vec2 uv) {
      vec3 c = texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb;
      return dot(c, vec3(0.299, 0.587, 0.114));
    }

    vec3 pastelHarmonize(vec3 col, vec2 cellIndex, float lum, float edgeMag) {
      vec3 warmBeige   = vec3(0.95, 0.89, 0.80);
      vec3 champagne   = vec3(0.97, 0.87, 0.69);
      vec3 lavender    = vec3(0.81, 0.70, 0.94);
      vec3 palePink    = vec3(0.98, 0.72, 0.82);
      vec3 cyan        = vec3(0.56, 0.88, 0.98);
      vec3 deepBlue    = vec3(0.39, 0.51, 0.88);
      vec3 violet      = vec3(0.69, 0.53, 0.95);
      vec3 softGold    = vec3(0.99, 0.85, 0.48);

      float waveA = sin(cellIndex.x * 0.09 + cellIndex.y * 0.06 + uTime * 0.65) * 0.5 + 0.5;
      float waveB = cos(cellIndex.x * 0.05 - cellIndex.y * 0.11 + uTime * 0.48) * 0.5 + 0.5;

      // Map scene color temperature & hue into rich dreamy pastel tones
      float warmBias = clamp((col.r - col.b) * 1.4 + 0.5, 0.0, 1.0);
      float greenCyanBias = clamp((col.g + col.b - col.r) * 0.8, 0.0, 1.0);

      vec3 coolTone = mix(deepBlue, cyan, smoothstep(0.18, 0.82, greenCyanBias + waveA * 0.25));
      coolTone = mix(coolTone, lavender, waveB * 0.55);

      vec3 warmTone = mix(palePink, champagne, smoothstep(0.2, 0.85, waveA));
      warmTone = mix(warmTone, warmBeige, 0.42);

      vec3 harmonized = mix(coolTone, warmTone, warmBias);
      harmonized = mix(harmonized, violet, clamp(edgeMag * 0.85, 0.0, 0.45));
      harmonized = mix(harmonized, softGold, smoothstep(0.60, 0.96, lum) * 0.55);

      return mix(col * 1.38 + vec3(0.05), harmonized, 0.62);
    }

    void main() {
      vec4 original = texture2D(tDiffuse, vUv);
      if (uMix <= 0.001) {
        gl_FragColor = original;
        return;
      }

      vec2 pixelPos = vUv * uResolution;
      vec2 cellIndex = floor(pixelPos / uCellSize);
      vec2 cellCenterUv = clamp((cellIndex + 0.5) * uCellSize / uResolution, 0.002, 0.998);
      vec2 cellLocalUv = fract(pixelPos / uCellSize);

      vec2 stepUv = uCellSize / uResolution;
      vec3 cCenter = texture2D(tDiffuse, cellCenterUv).rgb;
      float lum = dot(cCenter, vec3(0.299, 0.587, 0.114));

      // Sobel 3x3 gradient across cell neighborhood for directional contour glyphs
      float lTL = sampleLum(cellCenterUv + vec2(-stepUv.x,  stepUv.y));
      float lTC = sampleLum(cellCenterUv + vec2(      0.0,  stepUv.y));
      float lTR = sampleLum(cellCenterUv + vec2( stepUv.x,  stepUv.y));
      float lML = sampleLum(cellCenterUv + vec2(-stepUv.x,       0.0));
      float lMR = sampleLum(cellCenterUv + vec2( stepUv.x,       0.0));
      float lBL = sampleLum(cellCenterUv + vec2(-stepUv.x, -stepUv.y));
      float lBC = sampleLum(cellCenterUv + vec2(      0.0, -stepUv.y));
      float lBR = sampleLum(cellCenterUv + vec2( stepUv.x, -stepUv.y));

      float gx = -lTL - 2.0 * lML - lBL + lTR + 2.0 * lMR + lBR;
      float gy =  lTL + 2.0 * lTC + lTR - lBL - 2.0 * lBC - lBR;
      float edgeMag = length(vec2(gx, gy));

      // Living wave modulation across character brightness & twinkling cosmic space cells
      float shimmerWave = sin(cellIndex.x * 0.22 + cellIndex.y * 0.15 - uTime * 2.1) * 0.045
                        + cos(cellIndex.x * 0.08 - cellIndex.y * 0.19 + uTime * 1.4) * 0.03;

      float density = clamp(lum * 1.32 + edgeMag * 0.22 + shimmerWave, 0.0, 1.0);
      float glyphIdx = floor(density * (uDensityCount - 0.02));

      // Assign crisp directional edge characters where geometry silhouette gradients are strong
      if (edgeMag > 0.23 && lum > 0.045) {
        float angle = atan(gy, gx); // -pi..pi (normal angle)
        float absA = abs(angle);
        if (absA < 0.39 || absA > 2.75) {
          glyphIdx = 28.0; // '|' vertical edge
        } else if (abs(absA - 1.5708) < 0.39) {
          glyphIdx = 29.0; // '-' horizontal edge
        } else if ((angle > 0.0 && angle < 1.5708) || (angle < -1.5708)) {
          glyphIdx = 31.0; // '\\' diagonal edge
        } else {
          glyphIdx = 30.0; // '/' diagonal edge
        }
      } else if (density < 0.065) {
        // Delicate shimmering stars in background cosmic cells
        float starHash = fract(sin(dot(cellIndex, vec2(12.9898, 78.233))) * 43758.5453);
        float starPulse = sin(uTime * 2.4 + starHash * 40.0) * 0.5 + 0.5;
        if (starHash > 0.978) {
          glyphIdx = starPulse > 0.6 ? 12.0 : 3.0; // '*' or ':'
        } else if (starHash > 0.955) {
          glyphIdx = 1.0; // '.'
        } else {
          glyphIdx = 0.0;
        }
      }

      vec2 atlasUv = vec2(
        (glyphIdx + clamp(cellLocalUv.x, 0.06, 0.94)) / uGlyphCount,
        clamp(cellLocalUv.y, 0.04, 0.96)
      );

      float glyphMask = texture2D(tAsciiAtlas, atlasUv).r;
      vec3 pastelColor = pastelHarmonize(cCenter, cellIndex, lum, edgeMag);

      vec3 bgTone = vec3(0.036, 0.028, 0.065) + cCenter * 0.14;
      float glowBoost = 0.62 + density * 0.72 + clamp(edgeMag * 0.35, 0.0, 0.3);
      vec3 asciiRgb = mix(bgTone, pastelColor * glowBoost, glyphMask);

      gl_FragColor = vec4(mix(original.rgb, asciiRgb, uMix), 1.0);
    }
  `,
};

export class AsciiWorldExperience implements ISongExperience {
  public readonly song: SongItem;
  public readonly rootGroup = new THREE.Group();

  private composer: EffectComposer | null = null;
  private asciiPass: ShaderPass | null = null;
  private asciiAtlas: THREE.CanvasTexture | null = null;
  private unsubscribeQuality: (() => void) | null = null;

  // Living 3D cosmic ASCII phenomena (rendered directly through the scene + ASCII shader)
  private nebulaRibbons: THREE.Mesh[] = [];
  private starClusters: THREE.Group[] = [];
  private constellationLines: THREE.LineSegments | null = null;
  private constellationNodes: THREE.Points | null = null;
  private asciiCometGroup: THREE.Group | null = null;
  private cometAge = 0;

  constructor(song: SongItem) {
    this.song = song;
    this.rootGroup.name = 'experience_ascii_world';
  }

  public enter(handles: ExperienceSceneHandles): void {
    const { renderer, scene, camera } = handles;
    const width = window.innerWidth;
    const height = window.innerHeight;

    // 1. Living 3D Phenomena Rendered Inside the Scene so ASCII Characters Flow Over Them
    // 1a. Shifting Pastel Nebula Ribbons high above the asteroid
    const ribbonConfigs = [
      { color: 0xf2e6d8, r: 22, y: 11, tilt: 0.25, speed: 0.18 },
      { color: 0xc8b6ff, r: 28, y: 15, tilt: -0.32, speed: -0.14 },
      { color: 0x9ae3ff, r: 34, y: 19, tilt: 0.41, speed: 0.11 },
    ];

    ribbonConfigs.forEach((cfg, idx) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 18; i++) {
        const a = (i / 18) * Math.PI * 1.45 - Math.PI * 0.72 + idx * 1.1;
        pts.push(
          new THREE.Vector3(
            Math.cos(a) * cfg.r,
            cfg.y + Math.sin(a * 2.5 + idx) * 3.2,
            Math.sin(a) * cfg.r - 6
          )
        );
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const ribbonGeo = new THREE.TubeGeometry(curve, 48, 0.55 + idx * 0.15, 6, false);
      const ribbonMat = new THREE.MeshBasicMaterial({
        color: cfg.color,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ribbonMesh = new THREE.Mesh(ribbonGeo, ribbonMat);
      ribbonMesh.rotation.z = cfg.tilt;
      ribbonMesh.userData.rotSpeed = cfg.speed;
      this.nebulaRibbons.push(ribbonMesh);
      this.rootGroup.add(ribbonMesh);
    });

    // 1b. Three Pulsing Star Clusters orbiting the sky
    const clusterColors = [0xffd166, 0xffafcc, 0x9ae3ff];
    const coreGeo = new THREE.OctahedronGeometry(0.65, 0);
    const haloGeo = new THREE.SphereGeometry(1.15, 10, 10);

    for (let i = 0; i < 3; i++) {
      const cGroup = new THREE.Group();
      const angle = (i / 3) * Math.PI * 2 + 0.6;
      cGroup.position.set(Math.cos(angle) * 24, 9 + i * 3.2, Math.sin(angle) * 24);

      const coreMat = new THREE.MeshBasicMaterial({ color: 0xfff8e7 });
      const haloMat = new THREE.MeshBasicMaterial({
        color: clusterColors[i],
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      cGroup.add(new THREE.Mesh(coreGeo, coreMat));
      cGroup.add(new THREE.Mesh(haloGeo, haloMat));

      // Orbiting satellite sparklets
      for (let k = 0; k < 5; k++) {
        const ka = (k / 5) * Math.PI * 2;
        const sat = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.22, 0),
          new THREE.MeshBasicMaterial({ color: clusterColors[i] })
        );
        sat.position.set(Math.cos(ka) * 2.2, Math.sin(ka * 2) * 0.7, Math.sin(ka) * 2.2);
        cGroup.add(sat);
      }

      this.starClusters.push(cGroup);
      this.rootGroup.add(cGroup);
    }

    // 1c. Forming & Dissolving High-Altitude Constellation
    const constPts: [number, number, number][] = [
      [-26, 17, -24],
      [-18, 21, -26],
      [-10, 19, -28],
      [-2, 23, -25],
      [7, 20, -24],
      [15, 22, -22],
      [22, 16, -20],
    ];
    const lineCoords: number[] = [];
    const nodeCoords: number[] = [];
    constPts.forEach((p, idx) => {
      nodeCoords.push(p[0], p[1], p[2]);
      if (idx < constPts.length - 1) {
        const n = constPts[idx + 1];
        lineCoords.push(p[0], p[1], p[2], n[0], n[1], n[2]);
      }
    });
    const cLineGeo = new THREE.BufferGeometry();
    cLineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lineCoords, 3));
    this.constellationLines = new THREE.LineSegments(
      cLineGeo,
      new THREE.LineBasicMaterial({ color: 0xe6ccb2, transparent: true, opacity: 0.7 })
    );
    this.rootGroup.add(this.constellationLines);

    const cNodeGeo = new THREE.BufferGeometry();
    cNodeGeo.setAttribute('position', new THREE.Float32BufferAttribute(nodeCoords, 3));
    this.constellationNodes = new THREE.Points(
      cNodeGeo,
      new THREE.PointsMaterial({
        color: 0xffe5ec,
        size: 1.15,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.rootGroup.add(this.constellationNodes);

    // 1d. Sweeping ASCII Shooting Star / Comet
    const cometGroup = new THREE.Group();
    const cometHead = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 0),
      new THREE.MeshBasicMaterial({ color: 0xffe8c2 })
    );
    const cometTail = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 7.5, 6).rotateX(-Math.PI / 2).translate(0, 0, -3.75),
      new THREE.MeshBasicMaterial({
        color: 0x9ae3ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    cometGroup.add(cometHead);
    cometGroup.add(cometTail);
    this.asciiCometGroup = cometGroup;
    this.rootGroup.add(cometGroup);

    handles.scene.add(this.rootGroup);

    // 2. Post-Processing ASCII EffectComposer Pipeline
    const composer = new EffectComposer(renderer);
    const initialPreset = qualitySettings.getPreset();
    composer.setPixelRatio(
      handles.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, initialPreset.maxPixelRatio)
    );
    composer.setSize(width, height);

    composer.addPass(new RenderPass(scene, camera));

    this.asciiAtlas = createAsciiAtlasTexture(renderer.capabilities.getMaxAnisotropy());
    const asciiPass = new ShaderPass(AsciiPastelShader);
    asciiPass.uniforms.tAsciiAtlas.value = this.asciiAtlas;
    asciiPass.uniforms.uResolution.value.set(width, height);
    asciiPass.uniforms.uCellSize.value.set(
      initialPreset.asciiCellWidth,
      initialPreset.asciiCellHeight
    );

    composer.addPass(asciiPass);
    composer.addPass(new OutputPass());

    this.composer = composer;
    this.asciiPass = asciiPass;

    // Live quality preset responsiveness
    this.unsubscribeQuality = qualitySettings.subscribe((preset) => {
      if (this.asciiPass && this.composer) {
        this.asciiPass.uniforms.uCellSize.value.set(
          preset.asciiCellWidth,
          preset.asciiCellHeight
        );
        this.composer.setPixelRatio(
          handles.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, preset.maxPixelRatio)
        );
      }
    });

    handles.setPostProcessPass(() => {
      if (this.composer) {
        this.composer.render();
      }
    });
  }

  public update(frame: ExperienceFrameState, handles: ExperienceSceneHandles): void {
    const { delta, elapsed, transitionAlpha } = frame;
    const { baseline, fog, ambientLight, sunLight, cyanLight, pinkLight, celestialSystem } = handles;

    fog.color.copy(baseline.fogColor).lerp(_asciiFog, transitionAlpha);
    ambientLight.color.copy(baseline.ambientColor).lerp(_asciiAmbient, transitionAlpha);
    ambientLight.intensity = THREE.MathUtils.lerp(baseline.ambientIntensity, 1.45, transitionAlpha);
    sunLight.color.copy(baseline.sunColor).lerp(_asciiSun, transitionAlpha);
    sunLight.intensity = THREE.MathUtils.lerp(baseline.sunIntensity, 1.9, transitionAlpha);
    cyanLight.color.copy(baseline.cyanLightColor).lerp(_asciiCyan, transitionAlpha);
    pinkLight.color.copy(baseline.pinkLightColor).lerp(_asciiPink, transitionAlpha);

    celestialSystem?.blendModulation(transitionAlpha, {
      starBrightness: 1.35,
      nebulaOpacity: 0.72,
      nebulaA: _asciiNebulaA,
      nebulaB: _asciiNebulaB,
      nebulaC: _asciiNebulaC,
    });

    // Animate 3D phenomena rendered into the ASCII matrix
    for (let i = 0; i < this.nebulaRibbons.length; i++) {
      const r = this.nebulaRibbons[i];
      r.rotation.y += delta * (r.userData.rotSpeed as number);
      r.position.y = Math.sin(elapsed * 0.55 + i * 1.4) * 1.1;
      (r.material as THREE.MeshBasicMaterial).opacity = 0.42 * transitionAlpha;
    }

    for (let i = 0; i < this.starClusters.length; i++) {
      const c = this.starClusters[i];
      c.rotation.y = elapsed * (0.45 + i * 0.15);
      const pulse = 0.78 + Math.sin(elapsed * 2.6 + i * 2.1) * 0.28;
      c.scale.setScalar(Math.max(0.001, pulse * transitionAlpha));
    }

    // Breathe forming & dissolving constellation cycle
    if (this.constellationLines && this.constellationNodes) {
      const cycle = 0.5 + 0.5 * Math.sin(elapsed * 0.52);
      const vertPairs = Math.floor(cycle * 6.99);
      this.constellationLines.geometry.setDrawRange(0, vertPairs * 2);
      (this.constellationLines.material as THREE.LineBasicMaterial).opacity =
        (0.25 + cycle * 0.55) * transitionAlpha;
      (this.constellationNodes.material as THREE.PointsMaterial).opacity =
        (0.4 + cycle * 0.5) * transitionAlpha;
    }

    // Periodic bright shooting star arcing across the sky
    if (this.asciiCometGroup) {
      this.cometAge = (this.cometAge + delta) % 7.0;
      const active = this.cometAge < 2.8;
      this.asciiCometGroup.visible = active && transitionAlpha > 0.1;
      if (active) {
        const p = this.cometAge / 2.8;
        const x = THREE.MathUtils.lerp(-38, 38, p);
        const y = 18 - p * 7 + Math.sin(p * Math.PI) * 3.5;
        const z = THREE.MathUtils.lerp(-28, -14, p);
        this.asciiCometGroup.position.set(x, y, z);
        this.asciiCometGroup.lookAt(x + 1, y - 0.15, z + 0.25);
        this.asciiCometGroup.scale.setScalar(Math.sin(p * Math.PI) * transitionAlpha);
      }
    }

    if (this.asciiPass && this.composer) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const res = this.asciiPass.uniforms.uResolution.value as THREE.Vector2;
      if (res.x !== w || res.y !== h) {
        this.composer.setSize(w, h);
        res.set(w, h);
      }
      this.asciiPass.uniforms.uTime.value = elapsed;
      this.asciiPass.uniforms.uMix.value = transitionAlpha;
    }
  }

  public dispose(handles: ExperienceSceneHandles): void {
    handles.setPostProcessPass(null);
    if (this.unsubscribeQuality) {
      this.unsubscribeQuality();
      this.unsubscribeQuality = null;
    }
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
    }
    if (this.asciiAtlas) {
      this.asciiAtlas.dispose();
      this.asciiAtlas = null;
    }
    this.asciiPass = null;
    this.nebulaRibbons = [];
    this.starClusters = [];
    this.constellationLines = null;
    this.constellationNodes = null;
    this.asciiCometGroup = null;
    handles.scene.remove(this.rootGroup);
    disposeObject3DTree(this.rootGroup);
  }
}
