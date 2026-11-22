import { ActiveExperienceState, MemoryPhotoItem, SongItem } from '../types';
import { audioEngine } from './audioEngine';

type StateListener = (state: ActiveExperienceState) => void;

const INITIAL_STATE: ActiveExperienceState = {
  song: null,
  status: 'idle',
  elapsedSec: 0,
  durationSec: 0,
  progress: 0,
  usingFallbackAudio: false,
  audioError: null,
  nearbyMemory: null,
  selectedMemory: null,
};

class SongExperienceManager {
  private state: ActiveExperienceState = { ...INITIAL_STATE };
  private listeners = new Set<StateListener>();
  private transitionTimer: number | null = null;
  private onCompleteExitCallbacks: (() => void)[] = [];

  public getState(): ActiveExperienceState {
    return this.state;
  }

  public isActive(): boolean {
    return this.state.status !== 'idle' && this.state.song !== null;
  }

  public canCollectAlbum(): boolean {
    return this.state.status === 'idle';
  }

  public subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(patch: Partial<ActiveExperienceState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener(this.state));
  }

  public startExperience(song: SongItem, onFinishedOrExited?: () => void) {
    // Prevent multiple experiences running simultaneously
    if (this.state.status !== 'idle') {
      return;
    }

    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }

    if (onFinishedOrExited) {
      this.onCompleteExitCallbacks.push(onFinishedOrExited);
    }

    this.emit({
      song,
      status: 'entering',
      elapsedSec: 0,
      durationSec: song.fallbackDurationSec,
      progress: 0,
      usingFallbackAudio: false,
      audioError: null,
      nearbyMemory: null,
      selectedMemory: null,
    });

    // Begin audio playback via independent AudioEngine
    audioEngine.playExperienceAudio(song, {
      onReady: (durationSec, usingFallback) => {
        if (this.state.song?.id !== song.id) return;
        this.emit({
          durationSec,
          usingFallbackAudio: usingFallback,
        });
      },
      onProgress: (elapsedSec, durationSec) => {
        if (this.state.song?.id !== song.id || this.state.status === 'exiting') return;
        const progress = durationSec > 0 ? Math.min(1, Math.max(0, elapsedSec / durationSec)) : 0;
        this.emit({
          elapsedSec,
          durationSec,
          progress,
        });
      },
      onError: (message) => {
        if (this.state.song?.id !== song.id) return;
        this.emit({ audioError: message });
      },
      onAutoplayBlocked: () => {
        if (this.state.song?.id !== song.id) return;
        this.emit({
          status: 'paused',
          audioError: 'Click Resume to start audio playback.',
        });
      },
      onEnded: () => {
        if (this.state.song?.id !== song.id) return;
        this.exitExperience();
      },
    });

    // Smoothly transition from 'entering' to 'playing'
    const enterDelay = Math.min(1200, (song.transitionDurationSec || 2.0) * 500);
    this.transitionTimer = window.setTimeout(() => {
      if (this.state.song?.id === song.id && this.state.status === 'entering') {
        this.emit({ status: 'playing' });
      }
    }, enterDelay);
  }

  public seekExperience(timeSec: number) {
    if (this.state.status === 'idle' || !this.state.song) return;
    audioEngine.seekExperienceAudio(timeSec);
  }

  public pauseExperience() {
    if (this.state.status !== 'playing' && this.state.status !== 'entering') return;
    audioEngine.pauseExperienceAudio();
    this.emit({ status: 'paused' });
  }

  public resumeExperience() {
    if (this.state.status !== 'paused') return;
    audioEngine.resumeExperienceAudio();
    this.emit({ status: 'playing', audioError: null });
  }

  public togglePause() {
    if (this.state.status === 'paused') {
      this.resumeExperience();
    } else if (this.state.status === 'playing' || this.state.status === 'entering') {
      this.pauseExperience();
    }
  }

  public exitExperience() {
    if (this.state.status === 'idle' || this.state.status === 'exiting') return;

    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }

    audioEngine.stopExperienceAudio(0.45);
    this.emit({
      status: 'exiting',
      selectedMemory: null,
      nearbyMemory: null,
    });

    const exitDurationMs = Math.min(1400, ((this.state.song?.transitionDurationSec || 2.0) * 600));
    this.transitionTimer = window.setTimeout(() => {
      this.state = { ...INITIAL_STATE };
      this.listeners.forEach((listener) => listener(this.state));
      const callbacks = [...this.onCompleteExitCallbacks];
      this.onCompleteExitCallbacks = [];
      callbacks.forEach((cb) => cb());
    }, exitDurationMs);
  }

  public forceReset() {
    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    audioEngine.stopExperienceAudio(0.2);
    this.onCompleteExitCallbacks = [];
    this.state = { ...INITIAL_STATE };
    this.listeners.forEach((listener) => listener(this.state));
  }

  public setNearbyMemory(memory: MemoryPhotoItem | null) {
    if (this.state.nearbyMemory?.id === memory?.id) return;
    this.emit({ nearbyMemory: memory });
  }

  public setSelectedMemory(memory: MemoryPhotoItem | null) {
    this.emit({ selectedMemory: memory });
  }
}

export const songExperienceManager = new SongExperienceManager();
