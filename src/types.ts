export type GameStage = 
  | 'INTRO_NARRATION'
  | 'TRANSITION_TO_LEVEL1'
  | 'LEVEL1_BRIEF'
  | 'LEVEL1_GAMEPLAY'
  | 'LEVEL1_COMPLETION'
  | 'LEVEL1_FINISHED';

export interface SongItem {
  id: number;
  title: string;
  artist: string;
  year?: string;
  genre?: string;
  color: string; // Primary glow color in hex
  secondaryColor: string;
  description: string;
  previewDurationSec: number;
  synthNotes: number[]; // Frequencies for Web Audio synth preview
  bgStyle: 'gradient-retro' | 'indie-folk' | 'space-lofi' | 'ambient-wave' | 'cosmic-synth';
  customAudioUrl?: string; // Replaceable audio URL if user wants to supply real mp3s
}

export interface CollectibleItem {
  id: number;
  song: SongItem;
  position: [number, number, number]; // X, Y, Z on asteroid terrain
  isCollected: boolean;
  collectingAnimationProgress: number; // 0 to 1 during attraction
}

export interface PlayerControls {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  joystickVector: { x: number; y: number };
}
