/**
 * Fearless Footballer — Web Audio API Synthesizer
 * Provides an offline-capable ambient stadium soundscape (warm bass drone, binaural chord, and gentle chime)
 * to demonstrate real multi-layered audio playback without external CDN dependencies.
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private musicEnabled: boolean = true;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(this.musicEnabled ? 0.35 : 0, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (this.musicGain && this.ctx) {
      const targetGain = enabled ? 0.35 : 0.001;
      this.musicGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.3);
    }
  }

  public startPlayback() {
    this.initContext();
    if (!this.ctx || !this.musicGain) return;
    if (this.isPlaying) return;

    this.isPlaying = true;

    // Create a stadium-like binaural warm drone (F minor chord at 108Hz and 162Hz)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = "sine";
    this.droneOsc1.frequency.setValueAtTime(108, this.ctx.currentTime); // F2

    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = "triangle";
    this.droneOsc2.frequency.setValueAtTime(162, this.ctx.currentTime); // C3

    // Low-pass filter for warm cinematic feel
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.setValueAtTime(420, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.droneOsc1.connect(this.filter);
    this.droneOsc2.connect(this.filter);
    this.filter.connect(this.musicGain);

    this.droneOsc1.start();
    this.droneOsc2.start();

    // Play a gentle welcoming mindfulness chime
    this.playChime(523.25); // High C
  }

  public pausePlayback() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    try {
      if (this.droneOsc1) {
        this.droneOsc1.stop();
        this.droneOsc1.disconnect();
        this.droneOsc1 = null;
      }
      if (this.droneOsc2) {
        this.droneOsc2.stop();
        this.droneOsc2.disconnect();
        this.droneOsc2 = null;
      }
    } catch {
      // Ignore stop errors if already stopped
    }
  }

  public playChime(freq = 440) {
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const osc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      chimeGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      chimeGain.gain.exponentialRampToValueAtTime(0.2, this.ctx.currentTime + 0.05);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.2);

      osc.connect(chimeGain);
      chimeGain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 1.3);
    } catch {
      // Audio might be blocked by browser autoplay policy until user gesture
    }
  }
}

export const audioEngine = new AudioEngine();
