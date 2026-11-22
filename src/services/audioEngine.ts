import { SongItem } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private currentPreviewGain: GainNode | null = null;
  private currentOscillators: OscillatorNode[] = [];
  private currentAudioElement: HTMLAudioElement | null = null;
  private isMuted: boolean = false;
  private ambientGain: GainNode | null = null;
  private isAmbientPlaying: boolean = false;
  private previewTimeout: number | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.ctx && this.ambientGain) {
      this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.15, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  public getMutedState(): boolean {
    return this.isMuted;
  }

  // Play ambient space drone
  public startAmbientSpacePad() {
    if (this.isAmbientPlaying) return;
    try {
      this.initContext();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(0, now);
      this.ambientGain.gain.linearRampToValueAtTime(this.isMuted ? 0 : 0.12, now + 3);

      // Low warmth drone
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      
      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc3.type = 'sine';

      osc1.frequency.setValueAtTime(65.41, now); // C2
      osc2.frequency.setValueAtTime(98.00, now); // G2
      osc3.frequency.setValueAtTime(130.81, now); // C3

      // LFO filter for cosmic sweeping
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);

      const lfo = this.ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.1, now); // Very slow breath
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(150, now);

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
    } catch (e) {
      console.warn("AudioContext ambient start warning:", e);
    }
  }

  // Stop currently playing song preview with smooth fade out
  public stopCurrentPreview(fadeOutDurationSec = 0.4) {
    if (this.previewTimeout) {
      window.clearTimeout(this.previewTimeout);
      this.previewTimeout = null;
    }

    if (this.currentAudioElement) {
      const audioEl = this.currentAudioElement;
      let vol = audioEl.volume;
      const fadeInterval = setInterval(() => {
        vol = Math.max(0, vol - 0.1);
        audioEl.volume = vol;
        if (vol <= 0) {
          clearInterval(fadeInterval);
          audioEl.pause();
        }
      }, (fadeOutDurationSec * 1000) / 10);
      this.currentAudioElement = null;
    }

    if (this.ctx && this.currentPreviewGain) {
      const now = this.ctx.currentTime;
      this.currentPreviewGain.gain.cancelScheduledValues(now);
      this.currentPreviewGain.gain.setValueAtTime(this.currentPreviewGain.gain.value, now);
      this.currentPreviewGain.gain.linearRampToValueAtTime(0.0001, now + fadeOutDurationSec);

      const oscsToStop = [...this.currentOscillators];
      this.currentOscillators = [];
      const gainToDisconnect = this.currentPreviewGain;
      this.currentPreviewGain = null;

      setTimeout(() => {
        oscsToStop.forEach(osc => {
          try {
            osc.stop();
            osc.disconnect();
          } catch {
            // Already stopped
          }
        });
        try {
          gainToDisconnect.disconnect();
        } catch {
          // Ignore
        }
      }, fadeOutDurationSec * 1000 + 50);
    }
  }

  // Play a 5-10 second preview for a collected song
  public playSongPreview(song: SongItem, onEnded?: () => void) {
    this.initContext();

    // 1. Fade out current preview if any is playing
    this.stopCurrentPreview(0.3);

    if (this.isMuted) return;

    // Check if custom audio URL exists
    if (song.customAudioUrl) {
      try {
        const audio = new Audio(song.customAudioUrl);
        audio.volume = 0;
        audio.play().then(() => {
          this.currentAudioElement = audio;
          // Fade in
          let vol = 0;
          const fadeInInterval = setInterval(() => {
            vol = Math.min(0.8, vol + 0.1);
            audio.volume = vol;
            if (vol >= 0.8) clearInterval(fadeInInterval);
          }, 50);

          // Fade out near end of preview duration
          this.previewTimeout = window.setTimeout(() => {
            this.stopCurrentPreview(0.8);
            if (onEnded) onEnded();
          }, song.previewDurationSec * 1000);
        }).catch(() => {
          // Fallback to synth preview if file fails
          this.playSynthPreview(song, onEnded);
        });
        return;
      } catch {
        // Fallback
      }
    }

    // Play synthetic preview
    this.playSynthPreview(song, onEnded);
  }

  private playSynthPreview(song: SongItem, onEnded?: () => void) {
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = song.previewDurationSec || 8;

    const masterGain = this.ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.25, now + 0.6); // Smooth fade in
    masterGain.gain.setValueAtTime(0.25, now + duration - 0.8);
    masterGain.gain.linearRampToValueAtTime(0.0001, now + duration); // Smooth fade out

    masterGain.connect(this.ctx.destination);
    this.currentPreviewGain = masterGain;

    const notes = song.synthNotes || [261.63, 329.63, 392.00, 523.25];
    const oscs: OscillatorNode[] = [];

    // Create an arpeggio pattern over the duration
    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const oscGain = this.ctx!.createGain();

      // Alternate waveform based on song style
      if (song.bgStyle === 'cosmic-synth') osc.type = 'sawtooth';
      else if (song.bgStyle === 'indie-folk') osc.type = 'triangle';
      else if (song.bgStyle === 'space-lofi') osc.type = 'sine';
      else osc.type = 'sine';

      // Slight octave detune for stereo depth
      osc.frequency.setValueAtTime(freq, now);

      // Lowpass filter for smooth vintage tone
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800 + idx * 200, now);

      // Rhythm pulse
      const rhythmGain = this.ctx!.createGain();
      rhythmGain.gain.setValueAtTime(0.15, now);

      // Arpeggiate notes
      const stepTime = 0.4;
      for (let t = 0; t < duration; t += stepTime * notes.length) {
        const noteStartTime = now + t + idx * stepTime;
        if (noteStartTime < now + duration) {
          rhythmGain.gain.setValueAtTime(0.01, noteStartTime);
          rhythmGain.gain.exponentialRampToValueAtTime(0.3, noteStartTime + 0.05);
          rhythmGain.gain.exponentialRampToValueAtTime(0.05, noteStartTime + stepTime);
        }
      }

      osc.connect(filter);
      filter.connect(rhythmGain);
      rhythmGain.connect(masterGain);

      osc.start(now);
      osc.stop(now + duration + 0.1);
      oscs.push(osc);
    });

    this.currentOscillators = oscs;

    this.previewTimeout = window.setTimeout(() => {
      this.stopCurrentPreview(0.2);
      if (onEnded) onEnded();
    }, duration * 1000);
  }

  // Collection chime sound effect
  public playCollectChime() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      gain.connect(this.ctx.destination);

      // Bright major triad chime (C6, E6, G6, C7)
      const frequencies = [1046.50, 1318.51, 1567.98, 2093.00];
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
    } catch (e) {
      console.warn("Chime play error", e);
    }
  }

  // Sound for bridge rising in space
  public playBridgeRisingSound() {
    this.initContext();
    if (!this.ctx || this.isMuted) return;

    try {
      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 1.5);
      gain.gain.linearRampToValueAtTime(0.001, now + 4.5);
      gain.connect(this.ctx.destination);

      const osc = this.ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now); // A2
      osc.frequency.exponentialRampToValueAtTime(440, now + 3); // Rise to A4

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(200, now);
      filter.frequency.linearRampToValueAtTime(1200, now + 3);

      osc.connect(filter);
      filter.connect(gain);

      osc.start(now);
      osc.stop(now + 4.6);
    } catch (e) {
      console.warn("Bridge sound error", e);
    }
  }
}

export const audioEngine = new AudioEngine();
