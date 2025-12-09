/**
 * TestTone - Plays a pure sine wave tone for audio testing
 * Uses Web Audio API to generate a tone on demand
 */
export class TestTone {
  constructor(frequency = 440, volume = 0.5) {
    this.frequency = frequency;
    this.volume = volume;
    this.audioContext = null;
    this.oscillator = null;
    this.gainNode = null;
  }

  /**
   * Initialize audio context (must be called after user interaction)
   */
  _initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browsers may suspend audio context)
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }
  }

  /**
   * Start playing the test tone
   */
  start() {
    this._initAudioContext();

    // Don't start if already playing
    if (this.oscillator) return;

    this.oscillator = this.audioContext.createOscillator();
    this.gainNode = this.audioContext.createGain();

    this.oscillator.type = "sine";
    this.oscillator.frequency.setValueAtTime(this.frequency, this.audioContext.currentTime);
    this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);

    this.oscillator.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    this.oscillator.start();
  }

  /**
   * Stop playing the test tone
   */
  stop() {
    if (this.oscillator) {
      this.oscillator.stop();
      this.oscillator.disconnect();
      this.oscillator = null;
    }
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  /**
   * Set the frequency of the tone
   * @param {number} frequency - Frequency in Hz
   */
  setFrequency(frequency) {
    this.frequency = frequency;
    if (this.oscillator && this.audioContext) {
      this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
    }
  }

  /**
   * Set the volume of the tone
   * @param {number} volume - Volume from 0 to 1
   */
  setVolume(volume) {
    this.volume = volume;
    if (this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    }
  }
}
