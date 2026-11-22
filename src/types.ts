export type GameStage =
  | 'INTRO_NARRATION'
  | 'TRANSITION_TO_LEVEL1'
  | 'LEVEL1_BRIEF'
  | 'LEVEL1_GAMEPLAY'
  | 'LEVEL1_COMPLETION'
  | 'LEVEL1_FINISHED';

export type VisualQualityLevel = 'high' | 'balanced' | 'performance';

export type ExperienceType =
  | 'CELESTIAL_GARDEN'
  | 'COSMIC_DANCE'
  | 'LAVENDER_DREAM'
  | 'STAR_TRIBUTE'
  | 'SOLAR_CYCLE'
  | 'MEMORY_GALLERY'
  | 'ASCII_WORLD';

export interface MemoryPhotoItem {
  id: string;
  src: string | null;
  caption: string;
  date?: string;
  aspectRatio?: number;
  isPlaceholder: boolean;
}

export interface SongExperienceConfig {
  id: number;
  title: string;
  artist: string;
  year?: string;
  genre?: string;
  audioPath: string;
  experienceType: ExperienceType;
  experienceTitle: string;
  experienceSubtitle: string;
  color: string;
  secondaryColor: string;
  accentColor: string;
  description: string;
  fallbackDurationSec: number;
  transitionDurationSec: number;
  bpm: number;
  synthNotes: number[];
  bgStyle: 'gradient-retro' | 'indie-folk' | 'space-lofi' | 'ambient-wave' | 'cosmic-synth';
  assetRefs?: {
    memoryManifestPath?: string;
  };
  experienceParams: Record<string, number | string | boolean>;
}

export type SongItem = SongExperienceConfig;

export type ExperienceStatus = 'idle' | 'entering' | 'playing' | 'paused' | 'exiting';

export interface ActiveExperienceState {
  song: SongItem | null;
  status: ExperienceStatus;
  elapsedSec: number;
  durationSec: number;
  progress: number;
  usingFallbackAudio: boolean;
  audioError: string | null;
  nearbyMemory: MemoryPhotoItem | null;
  selectedMemory: MemoryPhotoItem | null;
}

export interface CollectibleItem {
  id: number;
  song: SongItem;
  position: [number, number, number];
  isCollected: boolean;
  collectingAnimationProgress: number;
}

export interface PlayerControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  joystickVector: { x: number; y: number };
}
