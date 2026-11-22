import { SongItem } from '../types';

export interface ExperienceAudioCallbacks {
  onReady?: (durationSec: number, usingFallback: boolean) => void;
  onProgress?: (elapsedSec: number, durationSec: number) => void;
  onEnded?: () => void;
  onAutoplayBlocked?: () => void;
  onError?: (message: string) => void;
}

// 44-byte silent PCM WAV data URI used once to unlock HTMLAudioElement on first user gesture
const SILENT_WAV_DATA_URI =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted = false;
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying = false;

  // Persistent HTMLAudioElement unlocked on first user gesture so WASD collection plays reliably
  private sharedAudioEl: HTMLAudioElement | null = null;
  private isHtmlAudioUnlocked = false;
  private fadeTimer: number | null = null;

  // Fallback procedural synth state (only used if an MP3 file is genuinely missing/corrupt)
  private activeSynthGain: GainNode | null = null;
  private synthLoopTimer: number | null = null;
  private progressTimer: number | null = null;

  private activeSessionId = 0;
  private isPaused = false;
  private usingFallback = false;
  private fallbackDurationSec = 55;
  private fallbackElapsedSec = 0;
  private fallbackLastTickMs = 0;
  private activeCallbacks: ExperienceAudioCallbacks = {};
  private activeSong: SongItem | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private ensureSharedAudioElement(): HTMLAudioElement {
    if (!this.sharedAudioEl) {
      const el = new Audio();
      el.preload = 'auto';
      this.sharedAudioEl = el;
    }
    return this.sharedAudioEl;
  }

  public isAudioUnlocked(): boolean {
    return this.isHtmlAudioUnlocked;
  }

  /**
   * Call on any user click/tap/keydown so the shared HTMLAudioElement and AudioContext
   * stay unlocked when songs are triggered later via gameplay movement.
   */
  public unlockAudio() {
    this.initContext();
    if (this.isHtmlAudioUnlocked) return;

    const el = this.ensureSharedAudioElement();
    // Do not interrupt if a real song is already loaded
    if (this.activeSong) {
      this.isHtmlAudioUnlocked = true;
      return;
    }

    try {
      el.muted = true;
      el.src = SILENT_WAV_DATA_URI;
      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (!this.activeSong) {
              el.pause();
              el.muted = this.isMuted;
            }
            this.isHtmlAudioUnlocked = true;
          })
          .catch(() => {
            el.muted = this.isMuted;
          });
      }
    } catch {
      el.muted = this.isMuted;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(
        this.isMuted ? 0 : this.activeSong ? 0.02 : 0.12,
        this.ctx.currentTime,
        0.1
      );
    }
    if (this.sharedAudioEl) {
      this.sharedAudioEl.muted = this.isMuted;
    }
    if (this.ctx && this.activeSynthGain) {
      this.activeSynthGain.gain.setTargetAtTime(
        this.isMuted || this.isPaused ? 0 : 0.2,
        this.ctx.currentTime,
        0.08
      );
    }
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  public startAmbientSpacePad() {
    this.unlockAudio();
    if (this.isAmbientPlaying) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0, now);
      this.ambientGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.12, now + 2.5);

      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc3.type = 'sine';

      osc1.frequency.setValueAtTime(65.41, now);
      osc2.frequency.setValueAtTime(98.0, now);
      osc3.frequency.setValueAtTime(130.81, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(280, now);

      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.08, now);
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(140, now);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      osc1.connect(filter);
      osc2.connect(filter);
      osc3.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);
      lfo.start(now);

      this.isAmbientPlaying = true;
    } catch {
      // Audio context blocked until user interaction
    }
  }

  private setAmbientDucked(ducked: boolean) {
    if (!this.ctx || !this.ambientGain) return;
    const target = this.isMuted ? 0 : ducked ? 0.015 : 0.12;
    this.ambientGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.35);
  }

  private clearHtmlAudioListeners(el: HTMLAudioElement) {
    el.onloadedmetadata = null;
    el.ondurationchange = null;
    el.ontimeupdate = null;
    el.onended = null;
    el.onerror = null;
  }

  public playExperienceAudio(song: SongItem, callbacks: ExperienceAudioCallbacks = {}) {
    this.initContext();
    this.stopExperienceAudio(0.15, false);

    const sessionId = ++this.activeSessionId;
    this.activeSong = song;
    this.activeCallbacks = callbacks;
    this.isPaused = false;
    this.usingFallback = false;
    this.fallbackDurationSec = song.fallbackDurationSec || 55;
    this.fallbackElapsedSec = 0;

    this.setAmbientDucked(true);
    this.startDirectHtmlAudio(song, sessionId);
  }

  private startDirectHtmlAudio(song: SongItem, sessionId: number) {
    const audio = this.ensureSharedAudioElement();
    this.clearHtmlAudioListeners(audio);

    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    audio.pause();
    audio.src = song.audioPath;
    audio.muted = this.isMuted;
    audio.volume = 0.05;

    const getValidDuration = () =>
      Number.isFinite(audio.duration) && audio.duration > 0
        ? audio.duration
        : song.fallbackDurationSec || 60;

    audio.onloadedmetadata = () => {
      if (sessionId !== this.activeSessionId) return;
      this.activeCallbacks.onReady?.(getValidDuration(), false);
    };

    audio.ondurationchange = () => {
      if (sessionId !== this.activeSessionId) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.activeCallbacks.onReady?.(audio.duration, false);
      }
    };

    audio.onended = () => {
      if (sessionId !== this.activeSessionId) return;
      const cb = this.activeCallbacks.onEnded;
      this.stopExperienceAudio(0.15);
      cb?.();
    };

    audio.onerror = () => {
      if (sessionId !== this.activeSessionId) return;
      this.clearHtmlAudioListeners(audio);
      this.activeCallbacks.onError?.(
        `Could not load ${song.audioPath}; playing ambient musical score.`
      );
      this.startProceduralScore(song, sessionId);
    };

    // Call play() synchronously inside playExperienceAudio to preserve gesture activation
    const playPromise = audio.play();
    this.startProgressLoop(sessionId);

    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          if (sessionId !== this.activeSessionId) {
            audio.pause();
            return;
          }
          this.isHtmlAudioUnlocked = true;
          this.usingFallback = false;

          if (this.isPaused) {
            audio.pause();
          }

          this.activeCallbacks.onReady?.(getValidDuration(), false);

          // Smooth fade-in to 0.88
          let vol = 0.05;
          this.fadeTimer = window.setInterval(() => {
            if (sessionId !== this.activeSessionId) {
              if (this.fadeTimer !== null) {
                window.clearInterval(this.fadeTimer);
                this.fadeTimer = null;
              }
              return;
            }
            vol = Math.min(0.88, vol + 0.09);
            try {
              audio.volume = vol;
            } catch {
              // Some mobile browsers treat volume as read-only
            }
            if (vol >= 0.88 && this.fadeTimer !== null) {
              window.clearInterval(this.fadeTimer);
              this.fadeTimer = null;
            }
          }, 40);
        })
        .catch((err: unknown) => {
          if (sessionId !== this.activeSessionId) return;
          const errName = err instanceof Error ? err.name : '';

          if (errName === 'NotAllowedError') {
            // Autoplay blocked by browser before user click: stay on the real MP3 and let user click Resume
            this.isPaused = true;
            this.usingFallback = false;
            this.activeCallbacks.onReady?.(getValidDuration(), false);
            this.activeCallbacks.onAutoplayBlocked?.();
          } else if (errName !== 'AbortError') {
            // Missing or unsupported audio file -> graceful synth score fallback
            this.clearHtmlAudioListeners(audio);
            this.activeCallbacks.onError?.(
              `Unable to play ${song.audioPath}; using ambient musical score.`
            );
            this.startProceduralScore(song, sessionId);
          }
        });
    }
  }

  private startProceduralScore(song: SongItem, sessionId: number) {
    if (sessionId !== this.activeSessionId) return;

    this.usingFallback = true;
    this.fallbackElapsedSec = 0;
    this.fallbackLastTickMs = performance.now();
    this.activeCallbacks.onReady?.(this.fallbackDurationSec, true);

    if (this.ctx) {
      const now = this.ctx.currentTime;
      const master = this.ctx.createGain();
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.2, now + 1.0);
      master.connect(this.ctx.destination);
      this.activeSynthGain = master;

      const notes = song.synthNotes.length > 0 ? song.synthNotes : [261.63, 329.63, 392.0, 523.25];
      const stepMs = Math.max(380, Math.round((60 / (song.bpm || 96)) * 1000));
      let stepIndex = 0;

      const triggerNote = () => {
        if (sessionId !== this.activeSessionId || !this.ctx || !this.activeSynthGain) return;
        if (this.isPaused) return;

        const t = this.ctx.currentTime;
        const freq = notes[stepIndex % notes.length];
        const harmonyFreq = notes[(stepIndex + 2) % notes.length] * 0.5;
        stepIndex++;

        const osc = this.ctx.createOscillator();
        const subOsc = this.ctx.createOscillator();
        osc.type = song.bgStyle === 'cosmic-synth' ? 'triangle' : 'sine';
        subOsc.type = 'sine';

        osc.frequency.setValueAtTime(freq, t);
        subOsc.frequency.setValueAtTime(harmonyFreq, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, t);

        const noteGain = this.ctx.createGain();
        noteGain.gain.setValueAtTime(0.0001, t);
        noteGain.gain.linearRampToValueAtTime(0.24, t + 0.08);
        noteGain.gain.exponentialRampToValueAtTime(0.001, t + (stepMs / 1000) * 1.4);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(noteGain);
        noteGain.connect(this.activeSynthGain);

        osc.start(t);
        subOsc.start(t);
        osc.stop(t + (stepMs / 1000) * 1.5);
        subOsc.stop(t + (stepMs / 1000) * 1.5);
      };

      triggerNote();
      this.synthLoopTimer = window.setInterval(triggerNote, stepMs);
    }

    this.startProgressLoop(sessionId);
  }

  private startProgressLoop(sessionId: number) {
    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    this.fallbackLastTickMs = performance.now();

    this.progressTimer = window.setInterval(() => {
      if (sessionId !== this.activeSessionId) {
        if (this.progressTimer !== null) {
          window.clearInterval(this.progressTimer);
          this.progressTimer = null;
        }
        return;
      }

      if (this.usingFallback) {
        const nowMs = performance.now();
        if (!this.isPaused) {
          this.fallbackElapsedSec += (nowMs - this.fallbackLastTickMs) / 1000;
        }
        this.fallbackLastTickMs = nowMs;

        const clamped = Math.min(this.fallbackDurationSec, this.fallbackElapsedSec);
        this.activeCallbacks.onProgress?.(clamped, this.fallbackDurationSec);

        if (this.fallbackElapsedSec >= this.fallbackDurationSec) {
          const cb = this.activeCallbacks.onEnded;
          this.stopExperienceAudio(0.3);
          cb?.();
        }
      } else if (this.sharedAudioEl && this.activeSong) {
        const dur =
          Number.isFinite(this.sharedAudioEl.duration) && this.sharedAudioEl.duration > 0
            ? this.sharedAudioEl.duration
            : this.activeSong.fallbackDurationSec || 60;
        const cur = this.sharedAudioEl.currentTime || 0;
        this.activeCallbacks.onProgress?.(cur, dur);
      }
    }, 100);
  }

  public seekExperienceAudio(timeSec: number) {
    if (!this.activeSong) return;
    if (this.usingFallback) {
      this.fallbackElapsedSec = Math.max(0, Math.min(this.fallbackDurationSec, timeSec));
      this.activeCallbacks.onProgress?.(this.fallbackElapsedSec, this.fallbackDurationSec);
      return;
    }
    if (this.sharedAudioEl) {
      const dur =
        Number.isFinite(this.sharedAudioEl.duration) && this.sharedAudioEl.duration > 0
          ? this.sharedAudioEl.duration
          : this.activeSong.fallbackDurationSec || 60;
      const clamped = Math.max(0, Math.min(dur - 0.1, timeSec));
      this.sharedAudioEl.currentTime = clamped;
      this.activeCallbacks.onProgress?.(clamped, dur);
    }
  }

  public pauseExperienceAudio() {
    if (this.isPaused) return;
    this.isPaused = true;

    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (!this.usingFallback && this.sharedAudioEl && !this.sharedAudioEl.paused) {
      this.sharedAudioEl.pause();
    }
    if (this.ctx && this.activeSynthGain) {
      this.activeSynthGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  public resumeExperienceAudio() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.fallbackLastTickMs = performance.now();
    this.initContext();

    if (!this.usingFallback && this.sharedAudioEl) {
      this.sharedAudioEl.muted = this.isMuted;
      try {
        this.sharedAudioEl.volume = 0.88;
      } catch {
        // Ignore read-only volume
      }
      this.sharedAudioEl.play().catch(() => {});
    }
    if (this.ctx && this.activeSynthGain) {
      this.activeSynthGain.gain.setTargetAtTime(
        this.isMuted ? 0 : 0.2,
        this.ctx.currentTime,
        0.08
      );
    }
  }

  public stopExperienceAudio(fadeOutDurationSec = 0.25, clearHtmlSrc = true) {
    this.activeSessionId++;
    this.isPaused = false;
    this.activeSong = null;

    if (this.fadeTimer !== null) {
      window.clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    if (this.progressTimer !== null) {
      window.clearInterval(this.progressTimer);
      this.progressTimer = null;
    }

    if (this.synthLoopTimer !== null) {
      window.clearInterval(this.synthLoopTimer);
      this.synthLoopTimer = null;
    }

    if (this.sharedAudioEl) {
      this.clearHtmlAudioListeners(this.sharedAudioEl);
      this.sharedAudioEl.pause();
      if (clearHtmlSrc) {
        this.sharedAudioEl.removeAttribute('src');
        this.sharedAudioEl.load();
      }
    }

    if (this.ctx && this.activeSynthGain) {
      const now = this.ctx.currentTime;
      const gainToStop = this.activeSynthGain;
      this.activeSynthGain = null;
      gainToStop.gain.cancelScheduledValues(now);
      gainToStop.gain.setValueAtTime(gainToStop.gain.value, now);
      gainToStop.gain.linearRampToValueAtTime(0.0001, now + fadeOutDurationSec);
      window.setTimeout(() => {
        try {
          gainToStop.disconnect();
        } catch {
          // Ignore disconnect cleanup error
        }
      }, fadeOutDurationSec * 1000 + 60);
    }

    this.setAmbientDucked(false);
  }

  public playSongPreview(song: SongItem, onEnded?: () => void) {
    this.playExperienceAudio(song, { onEnded });
  }

  public playCollectChime() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
      gain.connect(this.ctx.destination);

      const frequencies = [1046.5, 1318.51, 1567.98, 2093.0];
      frequencies.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        const oscGain = this.ctx!.createGain();
        oscGain.gain.setValueAtTime(0.2, now + idx * 0.06);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.8);

        osc.connect(oscGain);
        oscGain.connect(gain);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.9);
      });
    } catch {
      // Ignore chime error
    }
  }

  public playBridgeRisingSound() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.26, now + 1.5);
      gain.gain.linearRampToValueAtTime(0.001, now + 4.5);
      gain.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 3);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.linearRampToValueAtTime(1200, now + 3);

      osc.connect(filter);
      filter.connect(gain);

      osc.start(now);
      osc.stop(now + 4.6);
    } catch {
      // Ignore bridge sound error
    }
  }
}

export const audioEngine = new AudioEngine();
