import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  ActiveExperienceState,
  CollectibleItem,
  GameStage,
  PlayerControls,
  SongItem,
} from '../types';
import { SONGS_DATA, TOTAL_SONGS_COUNT } from '../data/songs';
import { TextureGenerator } from './TextureGenerator';
import { audioEngine } from '../services/audioEngine';
import { songExperienceManager } from '../services/SongExperienceManager';
import { assetManager } from '../services/assetManager';
import { qualitySettings } from '../services/qualitySettings';
import { ExperienceSceneController } from '../experiences/ExperienceSceneController';
import { CelestialEnvironmentSystem } from '../experiences/CelestialEnvironmentSystem';
import { ExperienceSceneHandles, SceneBaselineState } from '../experiences/types';
import { disposeObject3DTree } from '../experiences/utils/proceduralShapes';

interface GameCanvasProps {
  gameStage: GameStage;
  collectedIds: number[];
  activeExperience: ActiveExperienceState;
  onCollectSong: (song: SongItem) => void;
  onAllCollectedSequenceDone: () => void;
  playerControls: PlayerControls;
}

// Pre-allocated math helpers for zero-GC 60FPS render loop
const _dummyMat = new THREE.Matrix4();
const _dummyPos = new THREE.Vector3();
const _dummyRot = new THREE.Euler();
const _dummyQuat = new THREE.Quaternion();
const _dummyScale = new THREE.Vector3();

const _camDesiredPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _camCurrentLook = new THREE.Vector3(0, 0.8, 0);

const _raycaster = new THREE.Raycaster();
const _mouseVec = new THREE.Vector2();

const COLLECTIBLE_POSITIONS: [number, number, number][] = [
  [0, 1.8, 11.5],      // 1. My Love Mine All Mine — Mitski
  [-10.5, 1.8, 6.2],   // 2. Lady — Avenoir
  [10.5, 1.8, 6.2],    // 3. Heather — Conan Gray
  [-12.8, 1.8, -5.2],  // 4. Best Part — Daniel Caesar
  [12.8, 1.8, -5.2],   // 5. Midnight Sun — Zara Larsson
  [-6.8, 1.8, -13.2],  // 6. Come Over and Love Me
  [6.8, 1.8, -13.2],   // 7. Beige — Yoke Lore
];

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameStage,
  collectedIds,
  activeExperience,
  onCollectSong,
  onAllCollectedSequenceDone,
  playerControls,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const gameStageRef = useRef<GameStage>(gameStage);
  const collectedIdsRef = useRef<number[]>(collectedIds);
  const activeExperienceRef = useRef<ActiveExperienceState>(activeExperience);
  const playerControlsRef = useRef<PlayerControls>(playerControls);
  const onCollectSongRef = useRef(onCollectSong);
  const onAllCollectedRef = useRef(onAllCollectedSequenceDone);

  useEffect(() => {
    gameStageRef.current = gameStage;
  }, [gameStage]);

  useEffect(() => {
    collectedIdsRef.current = collectedIds;
  }, [collectedIds]);

  useEffect(() => {
    activeExperienceRef.current = activeExperience;
  }, [activeExperience]);

  useEffect(() => {
    playerControlsRef.current = playerControls;
  }, [playerControls]);

  useEffect(() => {
    onCollectSongRef.current = onCollectSong;
  }, [onCollectSong]);

  useEffect(() => {
    onAllCollectedRef.current = onAllCollectedSequenceDone;
  }, [onAllCollectedSequenceDone]);

  useEffect(() => {
    const mountEl = containerRef.current;
    if (!mountEl) return;

    // Detect software WebGL once for rendering cost tuning (keep scene content identical)
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    qualitySettings.initFromRenderer(isSoftwareGl);
    const initialPreset = qualitySettings.getPreset();
    let isDisposed = false;

    // 1. Scene & Atmospheric Fog
    const scene = new THREE.Scene();
    const fog = new THREE.FogExp2(0x160a30, 0.011);
    scene.fog = fog;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 15, 45);

    // 3. Renderer + WebGL Context Recovery
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, initialPreset.maxPixelRatio)
    );
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl && initialPreset.enableShadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const handleContextLost = (e: Event) => {
      e.preventDefault();
    };
    const handleContextRestored = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    mountEl.innerHTML = '';
    mountEl.appendChild(renderer.domElement);

    // 4. Studio Reflection Environment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTex = pmremGenerator.fromScene(roomEnv, 0.04).texture;
    scene.environment = envTex;
    roomEnv.dispose();
    pmremGenerator.dispose();

    // 5. Three-Point + Hemisphere Lighting Rig
    const ambientLight = new THREE.AmbientLight(0x3e1f57, 1.0);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x8ecae6, 0x241438, 0.78);
    hemiLight.position.set(0, 50, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffd166, 1.55);
    sunLight.position.set(35, 55, 25);
    sunLight.castShadow = !isSoftwareGl && initialPreset.enableShadows;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0005;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const cyanPointLight = new THREE.PointLight(0x4cc9f0, 2.2, 70);
    cyanPointLight.position.set(-18, 15, 12);
    scene.add(cyanPointLight);

    const pinkPointLight = new THREE.PointLight(0xf72585, 2.0, 70);
    pinkPointLight.position.set(18, 15, -12);
    scene.add(pinkPointLight);

    // 6. Starfield Skybox + Reusable Celestial Environment System
    const starTexture = TextureGenerator.createStarfieldTexture();
    const skyMesh = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 32),
      new THREE.MeshBasicMaterial({ map: starTexture, side: THREE.BackSide })
    );
    scene.add(skyMesh);

    const celestialSystem = new CelestialEnvironmentSystem(isSoftwareGl);
    celestialSystem.applyQualityPreset(initialPreset, isSoftwareGl);
    scene.add(celestialSystem.rootGroup);

    // 7. Distant Earth (Detailed Continents + Atmospheric Rim) & Target Moon (CC0 PBR Maps)
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const earthTex = TextureGenerator.createEarthTexture();
    earthTex.anisotropy = Math.min(4, maxAniso);
    const earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(18, 36, 36),
      new THREE.MeshStandardMaterial({
        map: earthTex,
        roughness: 0.56,
        metalness: 0.08,
        emissive: 0x091632,
        emissiveIntensity: 0.35,
      })
    );
    earthMesh.position.set(-65, 28, -130);
    scene.add(earthMesh);

    const atmosphereMesh = new THREE.Mesh(
      new THREE.SphereGeometry(19.2, 36, 36),
      new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
            vViewDir = normalize(-mvPos.xyz);
            gl_Position = projectionMatrix * mvPos;
          }
        `,
        fragmentShader: `
          varying vec3 vNormal;
          varying vec3 vViewDir;
          void main() {
            float rim = pow(clamp(0.75 + dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0), 2.4);
            gl_FragColor = vec4(0.32, 0.78, 0.98, rim * 0.55);
          }
        `,
        transparent: true,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    earthMesh.add(atmosphereMesh);

    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xf4f1de,
      emissive: 0x3b3d4a,
      emissiveIntensity: 0.25,
      roughness: 0.88,
    });
    const moonMesh = new THREE.Mesh(new THREE.SphereGeometry(9.5, 36, 36), moonMat);
    moonMesh.position.set(95, 45, -170);
    scene.add(moonMesh);

    assetManager
      .loadPbrTextureSet('/assets/textures/moon_01', 'moon_01', 1, Math.min(4, maxAniso))
      .then((pbr) => {
        if (!pbr || isDisposed) return;
        moonMat.map = pbr.map;
        moonMat.normalMap = pbr.normalMap;
        moonMat.normalScale.set(0.85, 0.85);
        moonMat.roughnessMap = pbr.roughnessMap;
        moonMat.color.setHex(0xffffff);
        moonMat.needsUpdate = true;
      });

    // 8. Space Shuttle (Intro sequence)
    const shuttleGroup = new THREE.Group();
    const shuttleBodyGeo = new THREE.ConeGeometry(1.2, 5, 8);
    shuttleBodyGeo.rotateX(Math.PI / 2);
    shuttleGroup.add(
      new THREE.Mesh(
        shuttleBodyGeo,
        new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.3, metalness: 0.6 })
      )
    );

    const visorGeo = new THREE.SphereGeometry(0.7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    visorGeo.rotateX(Math.PI / 2);
    const visor = new THREE.Mesh(
      visorGeo,
      new THREE.MeshStandardMaterial({ color: 0x00b4d8, roughness: 0.1, metalness: 0.9 })
    );
    visor.position.set(0, 0.4, 0.8);
    shuttleGroup.add(visor);

    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(2.5, -1.5);
    wingShape.lineTo(0, -2.5);
    wingShape.closePath();
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.15, bevelEnabled: false });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x212529, roughness: 0.5 });

    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.rotation.x = Math.PI / 2;
    leftWing.position.set(0, 0, 0.5);
    shuttleGroup.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.rotation.x = Math.PI / 2;
    rightWing.scale.set(-1, 1, 1);
    rightWing.position.set(0, 0, 0.5);
    shuttleGroup.add(rightWing);

    const thrusterGeo = new THREE.CylinderGeometry(0.4, 0.1, 1.2, 16);
    thrusterGeo.rotateX(Math.PI / 2);
    const thruster = new THREE.Mesh(
      thrusterGeo,
      new THREE.MeshBasicMaterial({ color: 0x48cae4, transparent: true, opacity: 0.85 })
    );
    thruster.position.set(0, 0, -2.8);
    shuttleGroup.add(thruster);
    shuttleGroup.position.set(0, 8, 12);
    scene.add(shuttleGroup);

    // 9. Main Asteroid Island Terrain (CC0 dark_rock_02 PBR + Glowing Mineral Fissures)
    const islandGeo = new THREE.CylinderGeometry(22, 17, 5.5, 36, 5);
    const posAttr = islandGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const noise = Math.sin(vx * 0.35) * Math.cos(vz * 0.35) * 1.15;
      posAttr.setY(i, vy + noise);
    }
    islandGeo.computeVertexNormals();

    const rockTexture = TextureGenerator.createAsteroidRockTexture();
    rockTexture.anisotropy = Math.min(4, maxAniso);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x4b386b,
      roughness: 0.84,
      metalness: 0.14,
      map: rockTexture,
      flatShading: true,
    });
    const islandMesh = new THREE.Mesh(islandGeo, islandMat);
    islandMesh.position.set(0, -2.75, 0);
    islandMesh.receiveShadow = true;
    scene.add(islandMesh);

    assetManager
      .loadPbrTextureSet('/assets/textures/dark_rock_02', 'dark_rock_02', 3, Math.min(4, maxAniso))
      .then((pbr) => {
        if (!pbr || isDisposed) return;
        islandMat.map = pbr.map;
        islandMat.normalMap = pbr.normalMap;
        islandMat.normalScale.set(0.75, 0.75);
        islandMat.roughnessMap = pbr.roughnessMap;
        islandMat.flatShading = false;
        islandMat.needsUpdate = true;
      });

    const pathGeo = new THREE.RingGeometry(7.5, 18.2, 48);
    pathGeo.rotateX(-Math.PI / 2);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x7209b7,
      emissive: 0xb5179e,
      emissiveIntensity: 0.38,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    pathMesh.position.set(0, 0.05, 0);
    pathMesh.receiveShadow = true;
    scene.add(pathMesh);

    // Subtle glowing mineral vein fissures etched across the outer asteroid rim
    const fissureGroup = new THREE.Group();
    const fissureMat = new THREE.MeshBasicMaterial({
      color: 0x4cc9f0,
      transparent: true,
      opacity: 0.36,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let f = 0; f < 6; f++) {
      const fGeo = new THREE.RingGeometry(15.2 + (f % 2) * 1.6, 15.42 + (f % 2) * 1.6, 12, 1, 0, Math.PI * 0.28);
      fGeo.rotateX(-Math.PI / 2);
      const fissure = new THREE.Mesh(fGeo, fissureMat);
      fissure.position.y = 0.08;
      fissure.rotation.y = (f / 6) * Math.PI * 2 + 0.3;
      fissureGroup.add(fissure);
    }
    scene.add(fissureGroup);

    // 10. Instanced Multi-Prism Bioluminescent Crystal Clusters
    const shardA = new THREE.ConeGeometry(0.32, 2.2, 5);
    shardA.translate(0, 1.1, 0);
    const shardB = new THREE.ConeGeometry(0.22, 1.5, 5);
    shardB.rotateZ(0.28);
    shardB.translate(0.26, 0.72, 0.14);
    const shardC = new THREE.ConeGeometry(0.19, 1.25, 5);
    shardC.rotateX(-0.26);
    shardC.translate(-0.24, 0.6, -0.16);
    const crystalClusterGeo = mergeGeometries([shardA, shardB, shardC]) ?? new THREE.ConeGeometry(0.38, 2.2, 5);
    shardA.dispose();
    shardB.dispose();
    shardC.dispose();

    const crystalCount = 22;
    const crystalInstanced = new THREE.InstancedMesh(
      crystalClusterGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.85,
        roughness: 0.18,
        metalness: 0.15,
        flatShading: true,
      }),
      crystalCount
    );
    const cyanColor = new THREE.Color(0x4cc9f0);
    const pinkColor = new THREE.Color(0xf72585);
    for (let i = 0; i < crystalCount; i++) {
      const angle = (i / crystalCount) * Math.PI * 2 + Math.random() * 0.15;
      const radius = 14.2 + Math.random() * 5.6;
      _dummyPos.set(Math.cos(angle) * radius, 0.05, Math.sin(angle) * radius);
      _dummyRot.set((Math.random() - 0.5) * 0.25, Math.random() * Math.PI, (Math.random() - 0.5) * 0.25);
      _dummyScale.set(0.95 + Math.random() * 0.35, 0.8 + Math.random() * 0.55, 0.95 + Math.random() * 0.35);
      _dummyMat.compose(_dummyPos, _dummyQuat.setFromEuler(_dummyRot), _dummyScale);
      crystalInstanced.setMatrixAt(i, _dummyMat);
      crystalInstanced.setColorAt(i, i % 2 === 0 ? cyanColor : pinkColor);
    }
    crystalInstanced.instanceMatrix.needsUpdate = true;
    if (crystalInstanced.instanceColor) crystalInstanced.instanceColor.needsUpdate = true;
    crystalInstanced.computeBoundingSphere();
    scene.add(crystalInstanced);

    // Perimeter CC0 boulders (moon_rock_03) & cosmic moss tufts (shrub_sorrel_01)
    const perimeterPropsGroup = new THREE.Group();
    scene.add(perimeterPropsGroup);
    Promise.all([
      assetManager.loadModelClone('/assets/models/moon_rock_03/moon_rock_03_1k.gltf', 2.4),
      assetManager.loadModelClone('/assets/models/shrub_sorrel_01/shrub_sorrel_01_1k.gltf', 1.15),
    ]).then(([rockTemplate, mossTemplate]) => {
      if (isDisposed) return;
      if (rockTemplate) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 + 0.32;
          const r = 18.6 + (i % 2) * 1.4;
          const b = rockTemplate.clone(true);
          b.userData.sharedAsset = true;
          b.position.set(Math.cos(a) * r, -0.35, Math.sin(a) * r);
          b.rotation.y = a * 2.1;
          b.scale.setScalar(0.68 + (i % 3) * 0.28);
          perimeterPropsGroup.add(b);
        }
      }
      if (mossTemplate) {
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + 0.14;
          const r = 15.8 + (i % 3) * 1.4;
          const m = mossTemplate.clone(true);
          m.userData.sharedAsset = true;
          m.position.set(Math.cos(a) * r, -0.1, Math.sin(a) * r);
          m.rotation.y = a * 1.7;
          m.scale.setScalar(0.75 + (i % 2) * 0.35);
          perimeterPropsGroup.add(m);
        }
      }
    });

    // 11. Instanced Floating Asteroid Rocks (upgraded asynchronously to CC0 moon_rock_02 geometry)
    const rockCount = 38;
    const rockInstanced = new THREE.InstancedMesh<THREE.BufferGeometry, THREE.Material>(
      new THREE.DodecahedronGeometry(1.2, 1),
      new THREE.MeshStandardMaterial({
        color: 0x5c4d7d,
        roughness: 0.85,
        metalness: 0.18,
        flatShading: true,
      }),
      rockCount
    );
    rockInstanced.frustumCulled = false;
    const rockTransforms: {
      pos: THREE.Vector3;
      rotSpeed: THREE.Vector3;
      floatFreq: number;
      scale: number;
    }[] = [];
    for (let i = 0; i < rockCount; i++) {
      const baseAngle = (i / rockCount) * Math.PI * 2;
      const dist = 23.0 + Math.random() * 12;
      const pos = new THREE.Vector3(
        Math.cos(baseAngle) * dist,
        (Math.random() - 0.5) * 8 + 2.0,
        Math.sin(baseAngle) * dist
      );
      rockTransforms.push({
        pos,
        rotSpeed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.7,
          (Math.random() - 0.5) * 0.5
        ),
        floatFreq: 0.8 + Math.random() * 1.5,
        scale: 0.8 + Math.random() * 1.4,
      });
    }
    scene.add(rockInstanced);

    assetManager
      .loadFirstMeshData('/assets/models/moon_rock_02/moon_rock_02_1k.gltf', 2.4)
      .then((meshData) => {
        if (!meshData || isDisposed) return;
        rockInstanced.geometry.dispose();
        meshData.geometry.center();
        rockInstanced.geometry = meshData.geometry;
        rockInstanced.material = meshData.material;
      });

    // 12. Stardust Particles
    const particleCount = 260;
    const stardustGeo = new THREE.BufferGeometry();
    const stardustPositions = new Float32Array(particleCount * 3);
    const stardustColors = new Float32Array(particleCount * 3);
    const stardustInitialY = new Float32Array(particleCount);
    const stardustSpeeds = new Float32Array(particleCount);
    const paletteColors = [
      new THREE.Color(0x4cc9f0),
      new THREE.Color(0xf72585),
      new THREE.Color(0xffd166),
      new THREE.Color(0x7209b7),
    ];
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 32.0;
      const y = Math.random() * 12.0 + 0.5;
      stardustPositions[i * 3] = Math.cos(angle) * radius;
      stardustPositions[i * 3 + 1] = y;
      stardustPositions[i * 3 + 2] = Math.sin(angle) * radius;
      stardustInitialY[i] = y;
      stardustSpeeds[i] = 1.0 + Math.random() * 2.0;
      const pc = paletteColors[i % paletteColors.length];
      stardustColors[i * 3] = pc.r;
      stardustColors[i * 3 + 1] = pc.g;
      stardustColors[i * 3 + 2] = pc.b;
    }
    stardustGeo.setAttribute('position', new THREE.BufferAttribute(stardustPositions, 3));
    stardustGeo.setAttribute('color', new THREE.BufferAttribute(stardustColors, 3));
    const stardustPoints = new THREE.Points(
      stardustGeo,
      new THREE.PointsMaterial({
        size: 0.42,
        vertexColors: true,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    scene.add(stardustPoints);

    // 13. Astronaut Player Model (Composite multi-part group)
    const playerGroup = new THREE.Group();
    const suitMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 0.7, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.35, metalness: 0.1 })
    );
    suitMesh.position.y = 0.8;
    suitMesh.castShadow = !isSoftwareGl;
    playerGroup.add(suitMesh);

    const helmetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xffb703, metalness: 0.95, roughness: 0.05 })
    );
    helmetMesh.position.set(0, 1.15, 0.15);
    playerGroup.add(helmetMesh);

    const backpack = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.6, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.5 })
    );
    backpack.position.set(0, 0.85, -0.38);
    playerGroup.add(backpack);

    const containerCoreMat = new THREE.MeshStandardMaterial({
      color: 0x4cc9f0,
      emissive: 0x4cc9f0,
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });
    const containerCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), containerCoreMat);
    containerCore.position.set(0, 0.85, -0.58);
    playerGroup.add(containerCore);

    const playerPosRef = { current: new THREE.Vector3(0, 0.8, 0) };
    const playerVel = new THREE.Vector3();
    let playerTargetPos: THREE.Vector3 | null = null;
    let playerAngle = 0;
    playerGroup.position.copy(playerPosRef.current);
    scene.add(playerGroup);

    // 14. Seven Album Collectibles
    const collectiblesGroup = new THREE.Group();
    const collectiblesData: CollectibleItem[] = [];

    SONGS_DATA.forEach((song, idx) => {
      const pos = COLLECTIBLE_POSITIONS[idx];
      collectiblesData.push({
        id: song.id,
        song,
        position: pos,
        isCollected: false,
        collectingAnimationProgress: 0,
      });

      const albumGroup = new THREE.Group();
      albumGroup.name = `collectible_${song.id}`;
      albumGroup.position.set(pos[0], pos[1], pos[2]);

      const albumTex = TextureGenerator.createAlbumTexture(song, maxAniso);
      const albumMesh = new THREE.Mesh(
        new THREE.BoxGeometry(1.65, 1.65, 0.08),
        new THREE.MeshStandardMaterial({ map: albumTex, roughness: 0.28, metalness: 0.2 })
      );
      albumMesh.castShadow = !isSoftwareGl;
      albumGroup.add(albumMesh);

      const glowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 2.4),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(song.color),
          transparent: true,
          opacity: 0.36,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      glowMesh.position.z = -0.05;
      albumGroup.add(glowMesh);

      const beamMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.65, 9, 16, 1, true),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color(song.color),
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      beamMesh.position.y = 4.5;
      albumGroup.add(beamMesh);

      const pLight = new THREE.PointLight(song.color, 1.35, 7);
      pLight.position.y = -0.5;
      albumGroup.add(pLight);

      collectiblesGroup.add(albumGroup);
    });
    scene.add(collectiblesGroup);

    // 15. Orbit Ring (7 albums) & Rising Stone Bridge
    const orbitRingGroup = new THREE.Group();
    scene.add(orbitRingGroup);

    const bridgeGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const stoneMesh = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.8, 3.2),
        new THREE.MeshStandardMaterial({
          color: 0x4a4e69,
          emissive: 0x22223b,
          emissiveIntensity: 0.25,
          roughness: 0.75,
          flatShading: true,
        })
      );
      stoneMesh.position.set(0, -18, -22 - i * 3.8);
      stoneMesh.name = `bridge_stone_${i}`;
      bridgeGroup.add(stoneMesh);
    }

    const nextAsteroidMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(8.5, 2),
      new THREE.MeshStandardMaterial({
        color: 0x5c677d,
        emissive: 0x3d5a80,
        emissiveIntensity: 0.35,
        roughness: 0.7,
        flatShading: true,
      })
    );
    nextAsteroidMesh.position.set(0, -2, -60);
    bridgeGroup.add(nextAsteroidMesh);
    scene.add(bridgeGroup);

    // 16. Baseline Snapshot & ExperienceSceneController Setup
    const baseline: SceneBaselineState = {
      fogColor: fog.color.clone(),
      fogDensity: fog.density,
      ambientColor: ambientLight.color.clone(),
      ambientIntensity: ambientLight.intensity,
      hemiSkyColor: hemiLight.color.clone(),
      hemiGroundColor: hemiLight.groundColor.clone(),
      hemiIntensity: hemiLight.intensity,
      sunColor: sunLight.color.clone(),
      sunIntensity: sunLight.intensity,
      sunPosition: sunLight.position.clone(),
      cyanLightColor: cyanPointLight.color.clone(),
      cyanLightIntensity: cyanPointLight.intensity,
      pinkLightColor: pinkPointLight.color.clone(),
      pinkLightIntensity: pinkPointLight.intensity,
      islandColor: islandMat.color.clone(),
      islandEmissive: islandMat.emissive.clone(),
      islandEmissiveIntensity: islandMat.emissiveIntensity,
      islandRoughness: islandMat.roughness,
      pathColor: pathMat.color.clone(),
      pathEmissive: pathMat.emissive.clone(),
      pathOpacity: pathMat.opacity,
      skyColor: new THREE.Color(0x150a33),
      exposure: renderer.toneMappingExposure,
    };

    let customRenderPass: (() => void) | null = null;
    const experienceController = new ExperienceSceneController();

    // 16b. Adaptive GPU Bloom Post-Processing Pipeline
    let mainComposer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    let bloomActive = !isSoftwareGl && initialPreset.enableBloom;

    if (!isSoftwareGl) {
      mainComposer = new EffectComposer(renderer);
      mainComposer.setPixelRatio(Math.min(window.devicePixelRatio, initialPreset.maxPixelRatio));
      mainComposer.setSize(window.innerWidth, window.innerHeight);
      mainComposer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.32,
        0.55,
        0.8
      );
      bloomPass.enabled = bloomActive;
      mainComposer.addPass(bloomPass);
      mainComposer.addPass(new OutputPass());
    }

    const unsubscribeQuality = qualitySettings.subscribe((preset) => {
      const targetPr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, preset.maxPixelRatio);
      renderer.setPixelRatio(targetPr);
      renderer.shadowMap.enabled = !isSoftwareGl && preset.enableShadows;
      sunLight.castShadow = !isSoftwareGl && preset.enableShadows;
      celestialSystem.applyQualityPreset(preset, isSoftwareGl);
      bloomActive = !isSoftwareGl && preset.enableBloom;
      if (mainComposer && bloomPass) {
        mainComposer.setPixelRatio(targetPr);
        bloomPass.enabled = bloomActive;
      }
    });

    const handles: ExperienceSceneHandles = {
      scene,
      camera,
      renderer,
      isSoftwareGl,
      fog,
      ambientLight,
      hemiLight,
      sunLight,
      cyanLight: cyanPointLight,
      pinkLight: pinkPointLight,
      islandMesh,
      pathMesh,
      skyMesh,
      crystalInstanced,
      rockInstanced,
      stardustPoints,
      celestialSystem,
      playerGroup,
      playerPosRef,
      baseline,
      setPostProcessPass: (fn) => {
        customRenderPass = fn;
      },
      onNearbyMemoryChange: (mem) => songExperienceManager.setNearbyMemory(mem),
      onSelectMemory: (mem) => songExperienceManager.setSelectedMemory(mem),
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 17. Pointer & Keyboard Interaction
    const handlePointerClick = (event: MouseEvent) => {
      if (gameStageRef.current !== 'LEVEL1_GAMEPLAY') return;

      _mouseVec.x = (event.clientX / window.innerWidth) * 2 - 1;
      _mouseVec.y = -(event.clientY / window.innerHeight) * 2 + 1;
      _raycaster.setFromCamera(_mouseVec, camera);

      // Give active 3D experience first click priority (e.g. clicking memory frames)
      if (experienceController.handlePointerClick(_raycaster, handles)) {
        return;
      }

      // If inspecting a close-up memory frame, ignore ground walk clicks
      if (activeExperienceRef.current.selectedMemory) {
        return;
      }

      const intersects = _raycaster.intersectObject(islandMesh);
      if (intersects.length > 0) {
        const pt = intersects[0].point;
        playerTargetPos = new THREE.Vector3(pt.x, 0.8, pt.z);
      }
    };

    const handleExperienceKeyDown = (e: KeyboardEvent) => {
      if (gameStageRef.current !== 'LEVEL1_GAMEPLAY') return;
      if (e.key.toLowerCase() === 'e') {
        experienceController.handleInteract(handles);
      } else if (e.key === 'Escape' && activeExperienceRef.current.selectedMemory) {
        songExperienceManager.setSelectedMemory(null);
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('click', handlePointerClick);
    window.addEventListener('keydown', handleExperienceKeyDown);

    const handleResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (mainComposer) {
        mainComposer.setSize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    // 18. Main Loop State
    let frameId = 0;
    const clock = new THREE.Clock();
    let transitionProgress = 0;
    let bridgeProgress = 0;
    let completionTriggered = false;
    let lastCollectedLen = collectedIdsRef.current.length;

    const resetLevelObjects = () => {
      completionTriggered = false;
      bridgeProgress = 0;
      playerPosRef.current.set(0, 0.8, 0);
      playerVel.set(0, 0, 0);
      playerTargetPos = null;
      playerAngle = 0;
      playerGroup.position.copy(playerPosRef.current);

      for (let i = 0; i < 8; i++) {
        const stone = bridgeGroup.getObjectByName(`bridge_stone_${i}`);
        if (stone) stone.position.y = -18;
      }

      while (orbitRingGroup.children.length > 0) {
        const child = orbitRingGroup.children[0];
        orbitRingGroup.remove(child);
        disposeObject3DTree(child);
      }

      collectiblesData.forEach((item) => {
        item.isCollected = false;
        const g = collectiblesGroup.getObjectByName(`collectible_${item.id}`);
        if (g) {
          g.visible = true;
          g.scale.setScalar(1);
          g.position.set(item.position[0], item.position[1], item.position[2]);
        }
      });
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (isDisposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (isDisposed) return;

      const delta = Math.min(0.1, clock.getDelta());
      const elapsed = clock.getElapsedTime();
      const stage = gameStageRef.current;
      const collected = collectedIdsRef.current;
      const activeExp = activeExperienceRef.current;

      // Detect replay reset (collectedIds went from >0 back to 0)
      if (lastCollectedLen > 0 && collected.length === 0) {
        resetLevelObjects();
      }
      lastCollectedLen = collected.length;

      // Subtle background cosmic drift & reusable celestial environment update
      skyMesh.rotation.y = elapsed * 0.004;
      earthMesh.rotation.y = elapsed * 0.015;
      moonMesh.rotation.y = elapsed * 0.008;
      celestialSystem.update(delta, elapsed);

      // Update Instanced Floating Rocks
      for (let i = 0; i < rockTransforms.length; i++) {
        const r = rockTransforms[i];
        const currentY = r.pos.y + Math.sin(elapsed * r.floatFreq + i) * 0.45;
        _dummyPos.set(r.pos.x, currentY, r.pos.z);
        _dummyRot.set(elapsed * r.rotSpeed.x, elapsed * r.rotSpeed.y, elapsed * r.rotSpeed.z);
        _dummyScale.setScalar(r.scale);
        _dummyMat.compose(_dummyPos, _dummyQuat.setFromEuler(_dummyRot), _dummyScale);
        rockInstanced.setMatrixAt(i, _dummyMat);
      }
      rockInstanced.instanceMatrix.needsUpdate = true;

      // Update Stardust Particles
      const posArr = stardustPoints.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        posArr[i * 3 + 1] = stardustInitialY[i] + Math.sin(elapsed * stardustSpeeds[i] + i) * 0.6;
      }
      stardustPoints.geometry.attributes.position.needsUpdate = true;

      // Shuttle hover during intro
      shuttleGroup.position.y = 8 + Math.sin(elapsed * 1.5) * 0.8;
      shuttleGroup.rotation.z = Math.sin(elapsed * 0.8) * 0.08;

      // Update Active 3D Song Experience
      experienceController.update(delta, elapsed, activeExp, handles);

      // Camera Choreography
      const camOverride = experienceController.getCameraOverride(handles);
      if (stage === 'INTRO_NARRATION') {
        camera.position.set(
          Math.sin(elapsed * 0.18) * 9,
          15 + Math.cos(elapsed * 0.12) * 3,
          45
        );
        camera.lookAt(0, 5, 0);
      } else if (stage === 'TRANSITION_TO_LEVEL1') {
        transitionProgress = Math.min(1, transitionProgress + delta * 0.65);
        const ease = transitionProgress * transitionProgress * (3 - 2 * transitionProgress);
        shuttleGroup.position.z = THREE.MathUtils.lerp(12, -10, ease);
        shuttleGroup.position.y = THREE.MathUtils.lerp(8, 2, ease);
        shuttleGroup.scale.setScalar(THREE.MathUtils.lerp(1, 0.2, ease));
        camera.position.set(
          THREE.MathUtils.lerp(0, 14.14, ease),
          THREE.MathUtils.lerp(15, 14, ease),
          THREE.MathUtils.lerp(45, 14.14, ease)
        );
        camera.lookAt(0, 0.8, 0);
        if (transitionProgress >= 0.99) shuttleGroup.visible = false;
      } else if (stage === 'LEVEL1_BRIEF' || stage === 'LEVEL1_GAMEPLAY') {
        if (camOverride) {
          const dampFactor = 1 - Math.exp(-6.5 * delta);
          camera.position.lerp(camOverride.position, dampFactor);
          _camCurrentLook.lerp(camOverride.lookAt, dampFactor);
          camera.lookAt(_camCurrentLook);
        } else {
          const pPos = playerPosRef.current;
          _camDesiredPos.set(pPos.x + 14.14, pPos.y + 14, pPos.z + 14.14);
          _camLookTarget.set(pPos.x, pPos.y + 0.8, pPos.z);
          const dampFactor = 1 - Math.exp(-10 * delta);
          camera.position.lerp(_camDesiredPos, dampFactor);
          _camCurrentLook.lerp(_camLookTarget, dampFactor);
          camera.lookAt(_camCurrentLook);
        }
      } else if (stage === 'LEVEL1_COMPLETION' || stage === 'LEVEL1_FINISHED') {
        const pPos = playerPosRef.current;
        _camDesiredPos.set(pPos.x * 0.5 + 18, 22, pPos.z + 24);
        _camLookTarget.set(0, 0, -12);
        const dampFactor = 1 - Math.exp(-5 * delta);
        camera.position.lerp(_camDesiredPos, dampFactor);
        _camCurrentLook.lerp(_camLookTarget, dampFactor);
        camera.lookAt(_camCurrentLook);
      }

      // Player Movement (preserved during all 7 experiences unless inspecting memory close-up)
      if (stage === 'LEVEL1_GAMEPLAY' && !activeExp.selectedMemory) {
        const ctrls = playerControlsRef.current;
        let inputX = 0;
        let inputZ = 0;
        if (ctrls.forward) inputZ -= 1;
        if (ctrls.backward) inputZ += 1;
        if (ctrls.left) inputX -= 1;
        if (ctrls.right) inputX += 1;
        if (ctrls.joystickVector.x !== 0 || ctrls.joystickVector.y !== 0) {
          inputX = ctrls.joystickVector.x;
          inputZ = ctrls.joystickVector.y;
          playerTargetPos = null;
        }

        const maxSpeed = 9.2;
        if (inputX !== 0 || inputZ !== 0) {
          playerTargetPos = null;
          const len = Math.hypot(inputX, inputZ);
          playerVel.x = THREE.MathUtils.lerp(playerVel.x, (inputX / len) * maxSpeed, delta * 14);
          playerVel.z = THREE.MathUtils.lerp(playerVel.z, (inputZ / len) * maxSpeed, delta * 14);
        } else if (playerTargetPos) {
          const distToTarget = playerPosRef.current.distanceTo(playerTargetPos);
          if (distToTarget > 0.35) {
            const dx = (playerTargetPos.x - playerPosRef.current.x) / distToTarget;
            const dz = (playerTargetPos.z - playerPosRef.current.z) / distToTarget;
            playerVel.x = THREE.MathUtils.lerp(playerVel.x, dx * maxSpeed, delta * 14);
            playerVel.z = THREE.MathUtils.lerp(playerVel.z, dz * maxSpeed, delta * 14);
          } else {
            playerTargetPos = null;
            playerVel.x = THREE.MathUtils.lerp(playerVel.x, 0, delta * 12);
            playerVel.z = THREE.MathUtils.lerp(playerVel.z, 0, delta * 12);
          }
        } else {
          playerVel.x = THREE.MathUtils.lerp(playerVel.x, 0, delta * 12);
          playerVel.z = THREE.MathUtils.lerp(playerVel.z, 0, delta * 12);
        }

        playerPosRef.current.x += playerVel.x * delta;
        playerPosRef.current.z += playerVel.z * delta;

        const speed = playerVel.length();
        if (speed > 0.2) {
          const targetAngle = Math.atan2(playerVel.x, playerVel.z);
          let diff = targetAngle - playerAngle;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          playerAngle += diff * Math.min(1, delta * 14);
        }

        const distFromCenter = Math.hypot(playerPosRef.current.x, playerPosRef.current.z);
        if (distFromCenter > 17.8) {
          const boundAngle = Math.atan2(playerPosRef.current.z, playerPosRef.current.x);
          playerPosRef.current.x = Math.cos(boundAngle) * 17.8;
          playerPosRef.current.z = Math.sin(boundAngle) * 17.8;
          playerVel.multiplyScalar(0.5);
        }

        playerPosRef.current.y =
          speed > 0.4
            ? 0.8 + Math.abs(Math.sin(elapsed * 11)) * 0.16
            : 0.8 + Math.sin(elapsed * 2.5) * 0.04;

        playerGroup.position.copy(playerPosRef.current);
        playerGroup.rotation.y = playerAngle;
      }

      // Album Collectibles (locked while an experience is active)
      const canCollect = songExperienceManager.canCollectAlbum();
      for (let i = 0; i < collectiblesData.length; i++) {
        const item = collectiblesData[i];
        const albumGroup = collectiblesGroup.getObjectByName(`collectible_${item.id}`);
        if (!albumGroup) continue;

        if (collected.includes(item.id)) {
          albumGroup.visible = false;
          item.isCollected = true;
          continue;
        }

        // Dim uncollected albums slightly while another song experience is active
        albumGroup.position.y = item.position[1] + Math.sin(elapsed * 2.5 + item.id) * 0.35;
        albumGroup.rotation.y = elapsed * 0.6 + item.id;

        if (stage === 'LEVEL1_GAMEPLAY' && canCollect) {
          const pPos = playerPosRef.current;
          const distToPlayer = Math.hypot(pPos.x - item.position[0], pPos.z - item.position[2]);

          if (distToPlayer < 3.6) {
            albumGroup.position.x = THREE.MathUtils.lerp(albumGroup.position.x, pPos.x, delta * 5);
            albumGroup.position.y = THREE.MathUtils.lerp(albumGroup.position.y, pPos.y + 0.8, delta * 5);
            albumGroup.position.z = THREE.MathUtils.lerp(albumGroup.position.z, pPos.z, delta * 5);
            albumGroup.scale.multiplyScalar(0.91);

            if (distToPlayer < 1.2 || albumGroup.scale.x < 0.16) {
              audioEngine.playCollectChime();
              item.isCollected = true;
              albumGroup.visible = false;
              onCollectSongRef.current(item.song);
            }
          }
        }
      }

      // Backpack core glow scales with 7 collected songs
      containerCoreMat.emissiveIntensity =
        0.5 + (collected.length / TOTAL_SONGS_COUNT) * 2.2 + Math.sin(elapsed * 4) * 0.25;

      // Level 1 Completion Sequence (once all 7 are collected AND no song experience is currently playing)
      const noActiveExp = activeExp.status === 'idle' || activeExp.song === null;
      if (
        collected.length === TOTAL_SONGS_COUNT &&
        noActiveExp &&
        (stage === 'LEVEL1_GAMEPLAY' || stage === 'LEVEL1_COMPLETION')
      ) {
        if (!completionTriggered) {
          completionTriggered = true;
          audioEngine.playBridgeRisingSound();

          SONGS_DATA.forEach((song) => {
            const orbitTex = TextureGenerator.createAlbumTexture(song, maxAniso);
            const orbitMesh = new THREE.Mesh(
              new THREE.BoxGeometry(1.2, 1.2, 0.05),
              new THREE.MeshStandardMaterial({ map: orbitTex })
            );
            orbitMesh.name = `orbit_album_${song.id}`;
            orbitRingGroup.add(orbitMesh);
          });
        }

        const pPos = playerPosRef.current;
        orbitRingGroup.position.set(pPos.x, 2.2, pPos.z);

        SONGS_DATA.forEach((song, idx) => {
          const orbitMesh = orbitRingGroup.getObjectByName(`orbit_album_${song.id}`);
          if (orbitMesh) {
            const angle = (idx / TOTAL_SONGS_COUNT) * Math.PI * 2 + elapsed * 0.65;
            const radius = 4.2;
            orbitMesh.position.set(
              Math.cos(angle) * radius,
              Math.sin(elapsed * 2 + idx) * 0.35,
              Math.sin(angle) * radius
            );
            orbitMesh.rotation.y = -angle + Math.PI / 2;
          }
        });

        bridgeProgress = Math.min(1, bridgeProgress + delta * 0.28);
        for (let i = 0; i < 8; i++) {
          const stone = bridgeGroup.getObjectByName(`bridge_stone_${i}`);
          if (stone) {
            const stoneDelay = i * 0.1;
            const stoneP = Math.max(0, Math.min(1, (bridgeProgress - stoneDelay) * 3));
            stone.position.y = THREE.MathUtils.lerp(-18, -0.4, stoneP);
          }
        }

        if (bridgeProgress >= 0.95 && stage === 'LEVEL1_GAMEPLAY') {
          onAllCollectedRef.current();
        }
      }

      // Render Frame (ASCII shader pass takes priority; otherwise adaptive bloom composer on GPU)
      if (customRenderPass) {
        customRenderPass();
      } else if (mainComposer && bloomActive) {
        mainComposer.render();
      } else {
        renderer.render(scene, camera);
      }

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      unsubscribeQuality();
      domEl.removeEventListener('click', handlePointerClick);
      domEl.removeEventListener('webglcontextlost', handleContextLost);
      domEl.removeEventListener('webglcontextrestored', handleContextRestored);
      window.removeEventListener('keydown', handleExperienceKeyDown);
      window.removeEventListener('resize', handleResize);
      experienceController.dispose(handles);
      celestialSystem.dispose();
      if (mainComposer) {
        mainComposer.dispose();
      }
      disposeObject3DTree(scene);
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none bg-slate-950 cursor-crosshair"
    />
  );
};
