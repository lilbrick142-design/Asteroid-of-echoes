import * as THREE from 'three';
import { ActiveExperienceState, MemoryPhotoItem, SongItem } from '../types';
import type { CelestialEnvironmentSystem } from './CelestialEnvironmentSystem';

export interface SceneBaselineState {
  fogColor: THREE.Color;
  fogDensity: number;
  ambientColor: THREE.Color;
  ambientIntensity: number;
  hemiSkyColor: THREE.Color;
  hemiGroundColor: THREE.Color;
  hemiIntensity: number;
  sunColor: THREE.Color;
  sunIntensity: number;
  sunPosition: THREE.Vector3;
  cyanLightColor: THREE.Color;
  cyanLightIntensity: number;
  pinkLightColor: THREE.Color;
  pinkLightIntensity: number;
  islandColor: THREE.Color;
  islandEmissive: THREE.Color;
  islandEmissiveIntensity: number;
  islandRoughness: number;
  pathColor: THREE.Color;
  pathEmissive: THREE.Color;
  pathOpacity: number;
  skyColor: THREE.Color;
  exposure: number;
}

export interface ExperienceSceneHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
  fog: THREE.FogExp2;
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  sunLight: THREE.DirectionalLight;
  cyanLight: THREE.PointLight;
  pinkLight: THREE.PointLight;
  islandMesh: THREE.Mesh;
  pathMesh: THREE.Mesh;
  skyMesh: THREE.Mesh;
  crystalInstanced: THREE.InstancedMesh;
  rockInstanced: THREE.InstancedMesh;
  stardustPoints: THREE.Points;
  celestialSystem?: CelestialEnvironmentSystem;
  playerGroup: THREE.Group;
  playerPosRef: { current: THREE.Vector3 };
  baseline: SceneBaselineState;
  setPostProcessPass: (passFactory: (() => void) | null) => void;
  onNearbyMemoryChange: (memory: MemoryPhotoItem | null) => void;
  onSelectMemory: (memory: MemoryPhotoItem | null) => void;
}

export interface ExperienceFrameState {
  delta: number;
  elapsed: number;
  experienceElapsed: number;
  songProgress: number; // 0..1 across song duration
  transitionAlpha: number; // 0..1 enter/exit blend weight
  isPaused: boolean;
  experienceState: ActiveExperienceState;
}

export interface CameraOverrideTarget {
  position: THREE.Vector3;
  lookAt: THREE.Vector3;
  weight: number; // 0..1
}

export interface ISongExperience {
  readonly song: SongItem;
  readonly rootGroup: THREE.Group;
  enter(handles: ExperienceSceneHandles): void;
  update(frame: ExperienceFrameState, handles: ExperienceSceneHandles): void;
  getCameraOverride?(handles: ExperienceSceneHandles): CameraOverrideTarget | null;
  onPointerClick?(raycaster: THREE.Raycaster, handles: ExperienceSceneHandles): boolean;
  onInteract?(handles: ExperienceSceneHandles): boolean;
  dispose(handles: ExperienceSceneHandles): void;
}
