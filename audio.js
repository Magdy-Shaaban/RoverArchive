/**
 * Soundscape & Spatial Audio Synthesizer Engine
 * Pure Web Audio API implementation - Zero external asset latency or 404 risk.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = true;
    this.isInitialized = false;

    // Node references
    this.masterGain = null;
    this.droneGain = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.filter = null;
    this.lfo = null;
    this.lfoGain = null;

    // Visualizer callbacks
    this.analyser = null;
    this.dataArray = null;
  }

  init() {
    if (this.isInitialized) return;

    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();

      // Master output
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      // Analyser for UI visualizer
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.smoothingTimeConstant = 0.8;
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);

      this.setupCosmicDrone();
      this.isInitialized = true;
    } catch (e) {
      console.warn("Web Audio API not supported or blocked", e);
    }
  }

  setupCosmicDrone() {
    if (!this.ctx) return;

    // Deep cosmic low-frequency drone (sub-bass 55Hz & 82.5Hz harmonic fifth)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc1.type = 'sawtooth';
    this.droneOsc2.type = 'sine';

    this.droneOsc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1
    this.droneOsc2.frequency.setValueAtTime(82.41, this.ctx.currentTime); // E2

    // Warm resonant low-pass filter
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.setValueAtTime(180, this.ctx.currentTime);
    this.filter.Q.setValueAtTime(4.0, this.ctx.currentTime);

    // LFO for slow breathing atmospheric modulation
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.setValueAtTime(0.12, this.ctx.currentTime); // 8-second cycle
    this.lfoGain = this.ctx.createGain();
    this.lfoGain.gain.setValueAtTime(60, this.ctx.currentTime);

    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(this.filter.frequency);

    // Drone volume
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    this.droneOsc1.connect(this.filter);
    this.droneOsc2.connect(this.filter);
    this.filter.connect(this.droneGain);
    this.droneGain.connect(this.masterGain);

    this.droneOsc1.start();
    this.droneOsc2.start();
    this.lfo.start();
  }

  toggleMute() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.isMuted ? 0.0001 : 0.65;
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetGain), this.ctx.currentTime + 0.6);
    }
    return !this.isMuted;
  }

  unmute() {
    if (this.isMuted) {
      this.toggleMute();
    }
  }

  // Hover tone (ethereal glass blip)
  playHover() {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      const freq = 600 + Math.random() * 200;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }

  // Click confirmation sound (haptic sub-click)
  playClick() {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 0.06);

      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.09);
    } catch (e) {}
  }

  // Camera fly-to whoosh (synthesized noise sweep)
  playWhoosh() {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const bufferSize = this.ctx.sampleRate * 0.8;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 3.0;
      filter.frequency.setValueAtTime(200, this.ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(2400, this.ctx.currentTime + 0.4);
      filter.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.8);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start();
      noise.stop(this.ctx.currentTime + 0.85);
    } catch (e) {}
  }

  // Relic Scanner / HUD Lock-in chime
  playScanChirp() {
    if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const t = this.ctx.currentTime;
      const freqs = [880, 1320, 1760]; // A5, E6, A6 triad
      
      freqs.forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t + i * 0.06);

        gain.gain.setValueAtTime(0.0001, t + i * 0.06);
        gain.gain.linearRampToValueAtTime(0.08, t + i * 0.06 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.35);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t + i * 0.06);
        osc.stop(t + i * 0.06 + 0.4);
      });
    } catch (e) {}
  }

  // Get live frequency data for audio visualizer bars
  getFrequencyData() {
    if (!this.analyser || this.isMuted) return null;
    this.analyser.getByteFrequencyData(this.dataArray);
    return this.dataArray;
  }
}

window.soundEngine = new AudioEngine();

