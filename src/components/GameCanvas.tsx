import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GameStage, CollectibleItem, PlayerControls, SongItem } from '../types';
import { SONGS_DATA } from '../data/songs';
import { TextureGenerator } from './TextureGenerator';
import { audioEngine } from '../services/audioEngine';

interface GameCanvasProps {
  gameStage: GameStage;
  collectedIds: number[];
  onCollectSong: (song: SongItem) => void;
  onAllCollectedSequenceDone: () => void;
  playerControls: PlayerControls;
}

// Pre-allocated reusable math objects to avoid garbage collection during 60FPS animation loop
const tempDummyMatrix = new THREE.Matrix4();
const tempDummyPos = new THREE.Vector3();
const tempDummyRot = new THREE.Euler();
const tempDummyQuat = new THREE.Quaternion();
const tempDummyScale = new THREE.Vector3();

const tempCamDesiredPos = new THREE.Vector3();
const tempCamLookTarget = new THREE.Vector3();
const tempCamCurrentLook = new THREE.Vector3(0, 0.8, 0);

const tempRaycaster = new THREE.Raycaster();
const tempMouseVec = new THREE.Vector2();

export const GameCanvas: React.FC<GameCanvasProps> = ({
  gameStage,
  collectedIds,
  onCollectSong,
  onAllCollectedSequenceDone,
  playerControls,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Internal Three.js instance refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  const shuttleMeshRef = useRef<THREE.Group | null>(null);
  const playerMeshRef = useRef<THREE.Group | null>(null);
  const playerContainerGlowRef = useRef<THREE.Mesh | null>(null);
  const bridgeGroupRef = useRef<THREE.Group | null>(null);
  const collectiblesGroupRef = useRef<THREE.Group | null>(null);
  const orbitRingGroupRef = useRef<THREE.Group | null>(null);

  // Instanced Meshes & Particle Refs
  const rockInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const rockTransformsRef = useRef<
    { pos: THREE.Vector3; rotSpeed: THREE.Vector3; floatFreq: number; scale: number; baseAngle: number; dist: number }[]
  >([]);

  const crystalInstancedMeshRef = useRef<THREE.InstancedMesh | null>(null);
  const stardustPointsRef = useRef<THREE.Points | null>(null);
  const stardustInitialYRef = useRef<Float32Array | null>(null);
  const stardustSpeedsRef = useRef<Float32Array | null>(null);

  // Smooth Player State Refs
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.8, 0));
  const playerVelRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const playerTargetPosRef = useRef<THREE.Vector3 | null>(null);
  const playerAngleRef = useRef<number>(0);

  // Game Stage & Collection State Sync
  const collectiblesDataRef = useRef<CollectibleItem[]>([]);
  const collectedIdsRef = useRef<number[]>([]);
  const gameStageRef = useRef<GameStage>(gameStage);
  const transitionProgressRef = useRef<number>(0);
  const bridgeProgressRef = useRef<number>(0);
  const completionTriggeredRef = useRef<boolean>(false);

  useEffect(() => {
    gameStageRef.current = gameStage;
  }, [gameStage]);

  useEffect(() => {
    collectedIdsRef.current = collectedIds;
  }, [collectedIds]);

  // Main Three.js Setup Effect
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x180b38, 0.012);

    // 2. Camera Setup - Standard Perspective Camera
    const camera = new THREE.PerspectiveCamera(
      50,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    cameraRef.current = camera;
    camera.position.set(0, 15, 45); // Initial intro space camera position

    // 3. Renderer Setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    rendererRef.current = renderer;

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(renderer.domElement);

    // 4. Atmospheric Lighting Setup
    // Deep Indigo Ambient Light
    const ambientLight = new THREE.AmbientLight(0x3e1f57, 1.2);
    scene.add(ambientLight);

    // Warm Golden Starlight Directional Source
    const sunLight = new THREE.DirectionalLight(0xffd166, 1.6);
    sunLight.position.set(35, 55, 25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 120;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Cyan Atmospheric Accent Point Light
    const cyanPointLight = new THREE.PointLight(0x4cc9f0, 2.5, 70);
    cyanPointLight.position.set(-18, 15, 12);
    scene.add(cyanPointLight);

    // Magenta Atmospheric Accent Point Light
    const pinkPointLight = new THREE.PointLight(0xf72585, 2.2, 70);
    pinkPointLight.position.set(18, 15, -12);
    scene.add(pinkPointLight);

    // 5. Starfield Skybox Sphere
    const starTexture = TextureGenerator.createStarfieldTexture();
    const skyGeo = new THREE.SphereGeometry(300, 32, 32);
    const skyMat = new THREE.MeshBasicMaterial({
      map: starTexture,
      side: THREE.BackSide,
    });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // 6. Background Celestial Bodies (Earth & Moon)
    const earthGeo = new THREE.SphereGeometry(18, 32, 32);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x1d3557,
      roughness: 0.6,
      metalness: 0.2,
      emissive: 0x0a1128,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthMesh.position.set(-65, 28, -130);
    scene.add(earthMesh);

    // Earth Atmosphere Glow
    const atmosphereGeo = new THREE.SphereGeometry(18.8, 32, 32);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: 0x4cc9f0,
      transparent: true,
      opacity: 0.25,
      side: THREE.BackSide,
    });
    const atmosphereMesh = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    earthMesh.add(atmosphereMesh);

    // Glowing Target Moon
    const moonGeo = new THREE.SphereGeometry(9, 32, 32);
    const moonMat = new THREE.MeshStandardMaterial({
      color: 0xf4f1de,
      emissive: 0xe0e1dd,
      emissiveIntensity: 0.2,
      roughness: 0.8,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.position.set(95, 45, -170);
    scene.add(moonMesh);

    // 7. Stylized Space Shuttle (Intro sequence actor)
    const shuttleGroup = new THREE.Group();
    shuttleMeshRef.current = shuttleGroup;

    const bodyGeo = new THREE.ConeGeometry(1.2, 5, 8);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8f9fa,
      roughness: 0.3,
      metalness: 0.6,
    });
    const shuttleBody = new THREE.Mesh(bodyGeo, bodyMat);
    shuttleGroup.add(shuttleBody);

    const visorGeo = new THREE.SphereGeometry(0.7, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    visorGeo.rotateX(Math.PI / 2);
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x00b4d8,
      roughness: 0.1,
      metalness: 0.9,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
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
    const thrusterMat = new THREE.MeshBasicMaterial({ color: 0x48cae4, transparent: true, opacity: 0.85 });
    const thruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    thruster.position.set(0, 0, -2.8);
    shuttleGroup.add(thruster);

    shuttleGroup.position.set(0, 8, 12);
    scene.add(shuttleGroup);

    // 8. Main Asteroid Island (Level 1 Terrain)
    const asteroidGroup = new THREE.Group();

    // Island Terrain Mesh
    const islandGeo = new THREE.CylinderGeometry(22, 17, 5.5, 28, 4);
    const posAttr = islandGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const vz = posAttr.getZ(i);
      const noise = Math.sin(vx * 0.35) * Math.cos(vz * 0.35) * 1.3;
      posAttr.setY(i, vy + noise);
    }
    islandGeo.computeVertexNormals();

    const rockTexture = TextureGenerator.createAsteroidRockTexture();
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x422f60,
      roughness: 0.8,
      metalness: 0.15,
      map: rockTexture,
      flatShading: true,
    });
    const islandMesh = new THREE.Mesh(islandGeo, islandMat);
    islandMesh.position.set(0, -2.75, 0);
    islandMesh.receiveShadow = true;
    asteroidGroup.add(islandMesh);

    // Glowing Stardust Pathway Ring
    const pathGeo = new THREE.RingGeometry(7.5, 18.2, 36);
    pathGeo.rotateX(-Math.PI / 2);
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0x7209b7,
      emissive: 0xb5179e,
      emissiveIntensity: 0.4,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const pathMesh = new THREE.Mesh(pathGeo, pathMat);
    pathMesh.position.set(0, 0.05, 0);
    pathMesh.receiveShadow = true;
    asteroidGroup.add(pathMesh);

    scene.add(asteroidGroup);

    // 9. INSTANCED MESH: Bioluminescent Crystals (Optimized)
    const crystalCount = 22;
    const crystalGeo = new THREE.ConeGeometry(0.38, 2.2, 5);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.2,
      flatShading: true,
    });
    const crystalInstanced = new THREE.InstancedMesh(crystalGeo, crystalMat, crystalCount);
    crystalInstancedMeshRef.current = crystalInstanced;

    const cyanColor = new THREE.Color(0x4cc9f0);
    const pinkColor = new THREE.Color(0xf72585);

    for (let i = 0; i < crystalCount; i++) {
      const angle = (i / crystalCount) * Math.PI * 2 + Math.random() * 0.15;
      const radius = 11.5 + Math.random() * 8.0;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = 0.8;

      tempDummyPos.set(x, y, z);
      tempDummyRot.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
      tempDummyScale.set(1 + Math.random() * 0.4, 0.8 + Math.random() * 0.6, 1 + Math.random() * 0.4);

      tempDummyMatrix.compose(tempDummyPos, tempDummyQuat.setFromEuler(tempDummyRot), tempDummyScale);
      crystalInstanced.setMatrixAt(i, tempDummyMatrix);
      crystalInstanced.setColorAt(i, i % 2 === 0 ? cyanColor : pinkColor);
    }
    crystalInstanced.instanceMatrix.needsUpdate = true;
    if (crystalInstanced.instanceColor) crystalInstanced.instanceColor.needsUpdate = true;
    scene.add(crystalInstanced);

    // 10. INSTANCED MESH: Decorative Floating Asteroid Fragments (Non-colliding, high performance)
    const rockCount = 38;
    const rockGeo = new THREE.DodecahedronGeometry(1.2, 1);
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x4a3b69,
      roughness: 0.85,
      metalness: 0.2,
      flatShading: true,
    });
    const rockInstanced = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rockInstancedMeshRef.current = rockInstanced;

    const rockTransforms = [];
    for (let i = 0; i < rockCount; i++) {
      const baseAngle = (i / rockCount) * Math.PI * 2;
      const dist = 22 + Math.random() * 12;
      const initialPosY = (Math.random() - 0.5) * 8 + 2.0;

      const pos = new THREE.Vector3(
        Math.cos(baseAngle) * dist,
        initialPosY,
        Math.sin(baseAngle) * dist
      );

      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 0.6,
        (Math.random() - 0.5) * 0.8,
        (Math.random() - 0.5) * 0.6
      );

      const scale = 0.8 + Math.random() * 1.6;
      const floatFreq = 0.8 + Math.random() * 1.5;

      rockTransforms.push({ pos, rotSpeed, floatFreq, scale, baseAngle, dist });

      tempDummyPos.copy(pos);
      tempDummyRot.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      tempDummyScale.setScalar(scale);
      tempDummyMatrix.compose(tempDummyPos, tempDummyQuat.setFromEuler(tempDummyRot), tempDummyScale);
      rockInstanced.setMatrixAt(i, tempDummyMatrix);
    }
    rockTransformsRef.current = rockTransforms;
    rockInstanced.instanceMatrix.needsUpdate = true;
    scene.add(rockInstanced);

    // 11. Floating Stardust Particle System
    const particleCount = 280;
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
      const x = Math.cos(angle) * radius;
      const y = Math.random() * 12.0 + 0.5;
      const z = Math.sin(angle) * radius;

      stardustPositions[i * 3] = x;
      stardustPositions[i * 3 + 1] = y;
      stardustPositions[i * 3 + 2] = z;

      stardustInitialY[i] = y;
      stardustSpeeds[i] = 1.0 + Math.random() * 2.0;

      const pColor = paletteColors[Math.floor(Math.random() * paletteColors.length)];
      stardustColors[i * 3] = pColor.r;
      stardustColors[i * 3 + 1] = pColor.g;
      stardustColors[i * 3 + 2] = pColor.b;
    }

    stardustGeo.setAttribute('position', new THREE.BufferAttribute(stardustPositions, 3));
    stardustGeo.setAttribute('color', new THREE.BufferAttribute(stardustColors, 3));

    const stardustMat = new THREE.PointsMaterial({
      size: 0.45,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const stardustPoints = new THREE.Points(stardustGeo, stardustMat);
    stardustPointsRef.current = stardustPoints;
    stardustInitialYRef.current = stardustInitialY;
    stardustSpeedsRef.current = stardustSpeeds;
    scene.add(stardustPoints);

    // 12. Astronaut Character Model (Player)
    const playerGroup = new THREE.Group();
    playerMeshRef.current = playerGroup;

    // Body suit
    const suitMat = new THREE.MeshStandardMaterial({ color: 0xf8f9fa, roughness: 0.35, metalness: 0.1 });
    const suitGeo = new THREE.CapsuleGeometry(0.45, 0.7, 8, 16);
    const suitMesh = new THREE.Mesh(suitGeo, suitMat);
    suitMesh.position.y = 0.8;
    suitMesh.castShadow = true;
    playerGroup.add(suitMesh);

    // Helmet visor
    const helmetMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      metalness: 0.95,
      roughness: 0.05,
    });
    const helmetGeo = new THREE.SphereGeometry(0.38, 16, 16);
    const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
    helmetMesh.position.set(0, 1.15, 0.15);
    playerGroup.add(helmetMesh);

    // Container backpack
    const backpackGeo = new THREE.BoxGeometry(0.5, 0.6, 0.35);
    const backpackMat = new THREE.MeshStandardMaterial({ color: 0x3d405b, roughness: 0.5 });
    const backpack = new THREE.Mesh(backpackGeo, backpackMat);
    backpack.position.set(0, 0.85, -0.38);
    playerGroup.add(backpack);

    // Glowing core crystal inside container
    const containerGeo = new THREE.OctahedronGeometry(0.22);
    const containerMat = new THREE.MeshStandardMaterial({
      color: 0x4cc9f0,
      emissive: 0x4cc9f0,
      emissiveIntensity: 0.9,
      roughness: 0.1,
    });
    const containerCore = new THREE.Mesh(containerGeo, containerMat);
    containerCore.position.set(0, 0.85, -0.58);
    playerContainerGlowRef.current = containerCore;
    playerGroup.add(containerCore);

    playerGroup.position.copy(playerPosRef.current);
    scene.add(playerGroup);

    // 13. Album Collectibles Creation (10 Floating Albums around Terrain)
    const collectiblesGroup = new THREE.Group();
    collectiblesGroupRef.current = collectiblesGroup;
    const collectiblesData: CollectibleItem[] = [];

    const positions: [number, number, number][] = [
      [0, 1.8, 12],     // 1. Mine All Mine - Mitski (Near entry point)
      [-9, 1.8, 8],     // 2. What Once Was - Her's
      [9, 1.8, 8],      // 3. Beige - Yoke Lore
      [-14, 1.8, 0],    // 4. Space Song
      [14, 1.8, 0],     // 5. Resonance
      [-11, 1.8, -9],   // 6. Floating in Space
      [11, 1.8, -9],    // 7. Lunar Horizon
      [-5, 1.8, -14],   // 8. Starlight Drift
      [5, 1.8, -14],    // 9. Echoes of the Moon
      [0, 1.8, -16]     // 10. Orbiting You (Near bridge gateway)
    ];

    SONGS_DATA.forEach((song, idx) => {
      const pos = positions[idx];
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

      // Album mesh box
      const albumTex = TextureGenerator.createAlbumTexture(song);
      const albumGeo = new THREE.BoxGeometry(1.6, 1.6, 0.08);
      const albumMat = new THREE.MeshStandardMaterial({
        map: albumTex,
        roughness: 0.3,
        metalness: 0.2,
      });
      const albumMesh = new THREE.Mesh(albumGeo, albumMat);
      albumMesh.castShadow = true;
      albumGroup.add(albumMesh);

      // Glowing colored aura halo
      const glowGeo = new THREE.PlaneGeometry(2.4, 2.4);
      const glowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(song.color),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      glowMesh.position.z = -0.05;
      albumGroup.add(glowMesh);

      // Light Beam rising from album cover
      const beamGeo = new THREE.CylinderGeometry(0.12, 0.65, 9, 16, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(song.color),
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
      });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.y = 4.5;
      albumGroup.add(beamMesh);

      // Ground glow light
      const pLight = new THREE.PointLight(song.color, 1.4, 7);
      pLight.position.y = -0.5;
      albumGroup.add(pLight);

      collectiblesGroup.add(albumGroup);
    });

    collectiblesDataRef.current = collectiblesData;
    scene.add(collectiblesGroup);

    // 14. Orbit Ring Group (For completion sequence)
    const orbitRingGroup = new THREE.Group();
    orbitRingGroupRef.current = orbitRingGroup;
    scene.add(orbitRingGroup);

    // 15. Floating Stone Bridge Group (Rises upon completing Level 1)
    const bridgeGroup = new THREE.Group();
    bridgeGroupRef.current = bridgeGroup;

    for (let i = 0; i < 8; i++) {
      const stoneGeo = new THREE.BoxGeometry(3.6, 0.8, 3.2);
      const stoneMat = new THREE.MeshStandardMaterial({
        color: 0x4a4e69,
        emissive: 0x22223b,
        emissiveIntensity: 0.25,
        roughness: 0.75,
        flatShading: true,
      });
      const stoneMesh = new THREE.Mesh(stoneGeo, stoneMat);
      stoneMesh.position.set(0, -18, -22 - i * 3.8); // Hidden initially deep in void
      stoneMesh.name = `bridge_stone_${i}`;
      bridgeGroup.add(stoneMesh);
    }

    // Distant second asteroid preview
    const nextAsteroidGeo = new THREE.DodecahedronGeometry(8.5, 2);
    const nextAsteroidMat = new THREE.MeshStandardMaterial({
      color: 0x5c677d,
      emissive: 0x3d5a80,
      emissiveIntensity: 0.35,
      roughness: 0.7,
      flatShading: true,
    });
    const nextAsteroidMesh = new THREE.Mesh(nextAsteroidGeo, nextAsteroidMat);
    nextAsteroidMesh.position.set(0, -2, -60);
    bridgeGroup.add(nextAsteroidMesh);

    scene.add(bridgeGroup);

    // 16. Click/Tap on Island terrain to move player
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (gameStageRef.current !== 'LEVEL1_GAMEPLAY') return;

      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      tempMouseVec.x = (clientX / window.innerWidth) * 2 - 1;
      tempMouseVec.y = -(clientY / window.innerHeight) * 2 + 1;

      if (!cameraRef.current) return;
      tempRaycaster.setFromCamera(tempMouseVec, cameraRef.current);
      const intersects = tempRaycaster.intersectObject(islandMesh);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        playerTargetPosRef.current = new THREE.Vector3(point.x, 0.8, point.z);
      }
    };

    const domEl = renderer.domElement;
    domEl.addEventListener('click', handlePointerDown);

    // 17. Resize Listener
    const handleResize = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      cameraRef.current.aspect = window.innerWidth / window.innerHeight;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 18. MAIN ANIMATION LOOP (60 FPS)
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = Math.min(0.1, clock.getDelta()); // Cap max delta to prevent spikes
      const elapsed = clock.getElapsedTime();

      // Sky background subtle cosmic rotation
      skyMesh.rotation.y = elapsed * 0.008;
      earthMesh.rotation.y = elapsed * 0.015;

      // Update Instanced Floating Asteroid Rocks (High performance matrix loop)
      if (rockInstancedMeshRef.current && rockTransformsRef.current.length > 0) {
        const rocks = rockTransformsRef.current;
        for (let i = 0; i < rocks.length; i++) {
          const r = rocks[i];
          const currentY = r.pos.y + Math.sin(elapsed * r.floatFreq + i) * 0.45;

          tempDummyPos.set(r.pos.x, currentY, r.pos.z);
          tempDummyRot.set(
            elapsed * r.rotSpeed.x,
            elapsed * r.rotSpeed.y,
            elapsed * r.rotSpeed.z
          );
          tempDummyScale.setScalar(r.scale);

          tempDummyMatrix.compose(
            tempDummyPos,
            tempDummyQuat.setFromEuler(tempDummyRot),
            tempDummyScale
          );
          rockInstancedMeshRef.current.setMatrixAt(i, tempDummyMatrix);
        }
        rockInstancedMeshRef.current.instanceMatrix.needsUpdate = true;
      }

      // Update Floating Stardust Particles
      if (stardustPointsRef.current && stardustInitialYRef.current && stardustSpeedsRef.current) {
        const posAttrArr = stardustPointsRef.current.geometry.attributes.position.array as Float32Array;
        const initialYArr = stardustInitialYRef.current;
        const speedArr = stardustSpeedsRef.current;

        for (let i = 0; i < particleCount; i++) {
          posAttrArr[i * 3 + 1] = initialYArr[i] + Math.sin(elapsed * speedArr[i] + i) * 0.6;
        }
        stardustPointsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Space Shuttle floating in space during intro
      if (shuttleGroup) {
        shuttleGroup.position.y = 8 + Math.sin(elapsed * 1.5) * 0.8;
        shuttleGroup.rotation.z = Math.sin(elapsed * 0.8) * 0.08;
      }

      const stage = gameStageRef.current;

      // CAMERA FLOW & TRANSITIONS
      if (stage === 'INTRO_NARRATION') {
        // Wide space view camera gliding softly
        camera.position.x = Math.sin(elapsed * 0.18) * 9;
        camera.position.y = 15 + Math.cos(elapsed * 0.12) * 3;
        camera.position.z = 45;
        camera.lookAt(0, 5, 0);
      } else if (stage === 'TRANSITION_TO_LEVEL1') {
        // Seamless transition from space shuttle to asteroid overview
        transitionProgressRef.current = Math.min(1, transitionProgressRef.current + delta * 0.65);
        const p = transitionProgressRef.current;
        const ease = p * p * (3 - 2 * p); // Cubic smooth ease

        if (shuttleGroup) {
          shuttleGroup.position.z = THREE.MathUtils.lerp(12, -10, ease);
          shuttleGroup.position.y = THREE.MathUtils.lerp(8, 2, ease);
          shuttleGroup.scale.setScalar(THREE.MathUtils.lerp(1, 0.2, ease));
        }

        // Camera smoothly glides down into gameplay isometric view
        camera.position.x = THREE.MathUtils.lerp(0, 14.14, ease);
        camera.position.y = THREE.MathUtils.lerp(15, 14, ease);
        camera.position.z = THREE.MathUtils.lerp(45, 14.14, ease);
        camera.lookAt(0, 0.8, 0);

        if (p >= 0.99 && shuttleGroup) {
          shuttleGroup.visible = false;
        }
      } else if (stage === 'LEVEL1_BRIEF' || stage === 'LEVEL1_GAMEPLAY') {
        // SMOOTH ISOMETRIC CAMERA FOLLOW WITH DAMPING
        // Pitch: 45°, Yaw: 45°, Height: 14 units, Distance: 20 units
        const pPos = playerPosRef.current;
        tempCamDesiredPos.set(pPos.x + 14.14, pPos.y + 14, pPos.z + 14.14);
        tempCamLookTarget.set(pPos.x, pPos.y + 0.8, pPos.z);

        // Exponential Damping Factor for zero jitter
        const dampFactor = 1 - Math.exp(-10 * delta);
        camera.position.lerp(tempCamDesiredPos, dampFactor);
        tempCamCurrentLook.lerp(tempCamLookTarget, dampFactor);
        camera.lookAt(tempCamCurrentLook);
      } else if (stage === 'LEVEL1_COMPLETION' || stage === 'LEVEL1_FINISHED') {
        // Zoom out smoothly for grand cinematic bridge overview
        const pPos = playerPosRef.current;
        tempCamDesiredPos.set(pPos.x * 0.5 + 18, 22, pPos.z + 24);
        tempCamLookTarget.set(0, 0, -12);

        const dampFactor = 1 - Math.exp(-5 * delta);
        camera.position.lerp(tempCamDesiredPos, dampFactor);
        tempCamCurrentLook.lerp(tempCamLookTarget, dampFactor);
        camera.lookAt(tempCamCurrentLook);
      }

      // SMOOTH PLAYER MOVEMENT CONTROLLER (LEVEL 1 GAMEPLAY)
      if (stage === 'LEVEL1_GAMEPLAY' && playerMeshRef.current) {
        let inputX = 0;
        let inputZ = 0;

        // Keyboard & D-Pad Inputs
        if (playerControls.forward) inputZ -= 1;
        if (playerControls.backward) inputZ += 1;
        if (playerControls.left) inputX -= 1;
        if (playerControls.right) inputX += 1;

        if (playerControls.joystickVector.x !== 0 || playerControls.joystickVector.y !== 0) {
          inputX = playerControls.joystickVector.x;
          inputZ = playerControls.joystickVector.y;
          playerTargetPosRef.current = null;
        }

        const maxSpeed = 9.2;

        if (inputX !== 0 || inputZ !== 0) {
          playerTargetPosRef.current = null; // Keyboard cancels click destination
          const inputLen = Math.hypot(inputX, inputZ);
          const normX = inputX / inputLen;
          const normZ = inputZ / inputLen;

          // Target velocity
          const targetVelX = normX * maxSpeed;
          const targetVelZ = normZ * maxSpeed;

          // Smooth acceleration
          playerVelRef.current.x = THREE.MathUtils.lerp(playerVelRef.current.x, targetVelX, delta * 14);
          playerVelRef.current.z = THREE.MathUtils.lerp(playerVelRef.current.z, targetVelZ, delta * 14);
        } else if (playerTargetPosRef.current) {
          // Click-to-move destination physics
          const distToTarget = playerPosRef.current.distanceTo(playerTargetPosRef.current);
          if (distToTarget > 0.35) {
            const dirX = (playerTargetPosRef.current.x - playerPosRef.current.x) / distToTarget;
            const dirZ = (playerTargetPosRef.current.z - playerPosRef.current.z) / distToTarget;

            playerVelRef.current.x = THREE.MathUtils.lerp(playerVelRef.current.x, dirX * maxSpeed, delta * 14);
            playerVelRef.current.z = THREE.MathUtils.lerp(playerVelRef.current.z, dirZ * maxSpeed, delta * 14);
          } else {
            playerTargetPosRef.current = null;
            playerVelRef.current.x = THREE.MathUtils.lerp(playerVelRef.current.x, 0, delta * 12);
            playerVelRef.current.z = THREE.MathUtils.lerp(playerVelRef.current.z, 0, delta * 12);
          }
        } else {
          // Smooth deceleration / floating friction dampening
          playerVelRef.current.x = THREE.MathUtils.lerp(playerVelRef.current.x, 0, delta * 12);
          playerVelRef.current.z = THREE.MathUtils.lerp(playerVelRef.current.z, 0, delta * 12);
        }

        // Apply velocity to position
        playerPosRef.current.x += playerVelRef.current.x * delta;
        playerPosRef.current.z += playerVelRef.current.z * delta;

        // Smoothly update facing rotation angle
        const currentSpeed = playerVelRef.current.length();
        if (currentSpeed > 0.2) {
          const targetAngle = Math.atan2(playerVelRef.current.x, playerVelRef.current.z);
          // Angle interpolation
          let diff = targetAngle - playerAngleRef.current;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          playerAngleRef.current += diff * Math.min(1, delta * 14);
        }

        // Soft terrain boundary clamping (Outer radius ~17.8 units)
        const distFromCenter = Math.hypot(playerPosRef.current.x, playerPosRef.current.z);
        if (distFromCenter > 17.8) {
          const boundAngle = Math.atan2(playerPosRef.current.z, playerPosRef.current.x);
          playerPosRef.current.x = Math.cos(boundAngle) * 17.8;
          playerPosRef.current.z = Math.sin(boundAngle) * 17.8;
          playerVelRef.current.multiplyScalar(0.5); // Soft bounce damping
        }

        // Floaty walking bounce
        if (currentSpeed > 0.4) {
          playerPosRef.current.y = 0.8 + Math.abs(Math.sin(elapsed * 11)) * 0.16;
        } else {
          playerPosRef.current.y = 0.8 + Math.sin(elapsed * 2.5) * 0.04; // Idle breathing
        }

        playerMeshRef.current.position.copy(playerPosRef.current);
        playerMeshRef.current.rotation.y = playerAngleRef.current;
      }

      // COLLECTIBLES ANIMATION & PROXIMITY COLLECTION
      collectiblesDataRef.current.forEach((item) => {
        const albumGroup = collectiblesGroup.getObjectByName(`collectible_${item.id}`);
        if (!albumGroup) return;

        if (collectedIdsRef.current.includes(item.id)) {
          albumGroup.visible = false;
          item.isCollected = true;
          return;
        }

        // Gentle sinusoidal floating and rotation
        albumGroup.position.y = item.position[1] + Math.sin(elapsed * 2.5 + item.id) * 0.35;
        albumGroup.rotation.y = elapsed * 0.6 + item.id;

        // Proximity check with player astronaut
        if (stage === 'LEVEL1_GAMEPLAY') {
          const pPos = playerPosRef.current;
          const dx = pPos.x - item.position[0];
          const dz = pPos.z - item.position[2];
          const distToPlayer = Math.hypot(dx, dz);

          if (distToPlayer < 3.8) {
            // Album floats towards player backpack container
            albumGroup.position.x = THREE.MathUtils.lerp(albumGroup.position.x, pPos.x, delta * 5);
            albumGroup.position.y = THREE.MathUtils.lerp(albumGroup.position.y, pPos.y + 0.8, delta * 5);
            albumGroup.position.z = THREE.MathUtils.lerp(albumGroup.position.z, pPos.z, delta * 5);
            albumGroup.scale.multiplyScalar(0.91);

            if (distToPlayer < 1.2 || albumGroup.scale.x < 0.15) {
              // Collected!
              audioEngine.playCollectChime();
              audioEngine.playSongPreview(item.song);
              onCollectSong(item.song);
              item.isCollected = true;
              albumGroup.visible = false;
            }
          }
        }
      });

      // CONTAINER GLOW ANIMATION
      if (playerContainerGlowRef.current) {
        const count = collectedIdsRef.current.length;
        const mat = playerContainerGlowRef.current.material as THREE.MeshStandardMaterial;
        mat.emissiveIntensity = 0.5 + (count / 10) * 2.2 + Math.sin(elapsed * 4) * 0.3;
      }

      // LEVEL 1 COMPLETION SEQUENCE (WHEN ALL 10 COLLECTED)
      if (collectedIdsRef.current.length === 10 && (stage === 'LEVEL1_GAMEPLAY' || stage === 'LEVEL1_COMPLETION')) {
        if (!completionTriggeredRef.current) {
          completionTriggeredRef.current = true;
          audioEngine.playBridgeRisingSound();

          // Spawn orbiting halo ring of 10 album covers around astronaut
          SONGS_DATA.forEach((song) => {
            const orbitAlbumTex = TextureGenerator.createAlbumTexture(song);
            const orbitGeo = new THREE.BoxGeometry(1.2, 1.2, 0.05);
            const orbitMat = new THREE.MeshStandardMaterial({ map: orbitAlbumTex });
            const orbitMesh = new THREE.Mesh(orbitGeo, orbitMat);
            orbitMesh.name = `orbit_album_${song.id}`;
            orbitRingGroup.add(orbitMesh);
          });
        }

        // Orbit ring rotation around player
        const pPos = playerPosRef.current;
        orbitRingGroup.position.copy(pPos);
        orbitRingGroup.position.y = 2.2;

        SONGS_DATA.forEach((song, idx) => {
          const orbitMesh = orbitRingGroup.getObjectByName(`orbit_album_${song.id}`);
          if (orbitMesh) {
            const angle = (idx / 10) * Math.PI * 2 + elapsed * 0.65;
            const radius = 4.2;
            orbitMesh.position.set(
              Math.cos(angle) * radius,
              Math.sin(elapsed * 2 + idx) * 0.35,
              Math.sin(angle) * radius
            );
            orbitMesh.rotation.y = -angle + Math.PI / 2;
          }
        });

        // Floating Stone Bridge smoothly rises step-by-step from void
        bridgeProgressRef.current = Math.min(1, bridgeProgressRef.current + delta * 0.28);
        const bp = bridgeProgressRef.current;

        for (let i = 0; i < 8; i++) {
          const stone = bridgeGroup.getObjectByName(`bridge_stone_${i}`);
          if (stone) {
            const stoneDelay = i * 0.1;
            const stoneP = Math.max(0, Math.min(1, (bp - stoneDelay) * 3));
            stone.position.y = THREE.MathUtils.lerp(-18, -0.4, stoneP);
          }
        }

        if (bp >= 0.95 && stage === 'LEVEL1_GAMEPLAY') {
          onAllCollectedSequenceDone();
        }
      }

      // Render Three.js frame
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      domEl.removeEventListener('click', handlePointerDown);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current && rendererRef.current.domElement) {
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden select-none bg-slate-950 cursor-crosshair"
    />
  );
};
