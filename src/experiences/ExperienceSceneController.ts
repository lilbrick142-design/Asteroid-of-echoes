import * as THREE from 'three';
import { ActiveExperienceState, ExperienceType, SongItem } from '../types';
import {
  CameraOverrideTarget,
  ExperienceSceneHandles,
  ISongExperience,
} from './types';
import { CelestialGardenExperience } from './CelestialGardenExperience';
import { CosmicDanceExperience } from './CosmicDanceExperience';
import { LavenderDreamExperience } from './LavenderDreamExperience';
import { StarTributeExperience } from './StarTributeExperience';
import { SolarCycleExperience } from './SolarCycleExperience';
import { MemoryGalleryExperience } from './MemoryGalleryExperience';
import { AsciiWorldExperience } from './AsciiWorldExperience';

function createExperienceInstance(song: SongItem): ISongExperience {
  const type: ExperienceType = song.experienceType;
  switch (type) {
    case 'CELESTIAL_GARDEN':
      return new CelestialGardenExperience(song);
    case 'COSMIC_DANCE':
      return new CosmicDanceExperience(song);
    case 'LAVENDER_DREAM':
      return new LavenderDreamExperience(song);
    case 'STAR_TRIBUTE':
      return new StarTributeExperience(song);
    case 'SOLAR_CYCLE':
      return new SolarCycleExperience(song);
    case 'MEMORY_GALLERY':
      return new MemoryGalleryExperience(song);
    case 'ASCII_WORLD':
      return new AsciiWorldExperience(song);
  }
}

export class ExperienceSceneController {
  private activeExperience: ISongExperience | null = null;
  private activeSongId: number | null = null;
  private transitionAlpha = 0;
  private experienceElapsed = 0;

  public update(
    delta: number,
    elapsed: number,
    experienceState: ActiveExperienceState,
    handles: ExperienceSceneHandles
  ): void {
    const requestedSong = experienceState.song;
    const status = experienceState.status;

    // 1. Mount new experience if requested
    if (requestedSong && status !== 'idle') {
      if (this.activeSongId !== requestedSong.id) {
        this.unmountCurrent(handles);
        const instance = createExperienceInstance(requestedSong);
        this.activeExperience = instance;
        this.activeSongId = requestedSong.id;
        this.transitionAlpha = 0;
        this.experienceElapsed = 0;
        instance.enter(handles);
      }
    }

    // 2. Smoothly advance transition alpha (enter -> 1, exit -> 0)
    if (this.activeExperience) {
      const targetAlpha = status === 'exiting' || status === 'idle' ? 0 : 1;
      const dampRate = status === 'exiting' ? 3.5 : 2.2;
      this.transitionAlpha = THREE.MathUtils.damp(this.transitionAlpha, targetAlpha, dampRate, delta);

      if (status !== 'paused') {
        this.experienceElapsed += delta;
      }

      const songProgress =
        experienceState.durationSec > 0
          ? THREE.MathUtils.clamp(experienceState.elapsedSec / experienceState.durationSec, 0, 1)
          : 0;

      this.activeExperience.update(
        {
          delta,
          elapsed,
          experienceElapsed: this.experienceElapsed,
          songProgress,
          transitionAlpha: this.transitionAlpha,
          isPaused: status === 'paused',
          experienceState,
        },
        handles
      );

      // Once exit transition completes or status returns to idle, restore baseline & dispose
      if (status === 'idle' || (status === 'exiting' && this.transitionAlpha < 0.02)) {
        this.unmountCurrent(handles);
      }
    }
  }

  public getCameraOverride(handles: ExperienceSceneHandles): CameraOverrideTarget | null {
    if (!this.activeExperience?.getCameraOverride) return null;
    return this.activeExperience.getCameraOverride(handles);
  }

  public handlePointerClick(raycaster: THREE.Raycaster, handles: ExperienceSceneHandles): boolean {
    if (!this.activeExperience?.onPointerClick) return false;
    return this.activeExperience.onPointerClick(raycaster, handles);
  }

  public handleInteract(handles: ExperienceSceneHandles): boolean {
    if (!this.activeExperience?.onInteract) return false;
    return this.activeExperience.onInteract(handles);
  }

  private unmountCurrent(handles: ExperienceSceneHandles) {
    if (this.activeExperience) {
      this.activeExperience.dispose(handles);
      this.activeExperience = null;
      this.activeSongId = null;
      this.transitionAlpha = 0;
      this.experienceElapsed = 0;
      this.restoreBaseline(handles);
    }
  }

  private restoreBaseline(handles: ExperienceSceneHandles) {
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
    } = handles;

    fog.color.copy(baseline.fogColor);
    fog.density = baseline.fogDensity;

    ambientLight.color.copy(baseline.ambientColor);
    ambientLight.intensity = baseline.ambientIntensity;

    hemiLight.color.copy(baseline.hemiSkyColor);
    hemiLight.groundColor.copy(baseline.hemiGroundColor);
    hemiLight.intensity = baseline.hemiIntensity;

    sunLight.color.copy(baseline.sunColor);
    sunLight.intensity = baseline.sunIntensity;
    sunLight.position.copy(baseline.sunPosition);

    cyanLight.color.copy(baseline.cyanLightColor);
    cyanLight.intensity = baseline.cyanLightIntensity;

    pinkLight.color.copy(baseline.pinkLightColor);
    pinkLight.intensity = baseline.pinkLightIntensity;

    const islandMat = islandMesh.material as THREE.MeshStandardMaterial;
    islandMat.color.copy(baseline.islandColor);
    islandMat.emissive.copy(baseline.islandEmissive);
    islandMat.emissiveIntensity = baseline.islandEmissiveIntensity;
    islandMat.roughness = baseline.islandRoughness;

    const pathMat = pathMesh.material as THREE.MeshStandardMaterial;
    pathMat.color.copy(baseline.pathColor);
    pathMat.emissive.copy(baseline.pathEmissive);
    pathMat.opacity = baseline.pathOpacity;

    renderer.toneMappingExposure = baseline.exposure;
    handles.celestialSystem?.resetModulation();
  }

  public dispose(handles: ExperienceSceneHandles) {
    this.unmountCurrent(handles);
  }
}
