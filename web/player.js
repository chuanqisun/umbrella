import { FpsTracker } from "./fps.js";

export class Player {
  constructor(renderer, recorder) {
    this.renderer = renderer;
    this.recorder = recorder;
    this.audioElement = null;
    this.isPlaying = false;
    this.animationFrameId = null;
    this.lastFrameIndex = -1;
    this.lastRenderTime = -1;

    // Pre-allocated interpolation buffer for performance
    this._interpolationBuffer = null;

    // FPS tracking for playback
    this._fpsTracker = new FpsTracker();
  }

  /**
   * Bind to an audio element for synchronized playback
   * @param {HTMLAudioElement} audioElement
   */
  bindAudio(audioElement) {
    // Remove old listeners if rebinding
    if (this.audioElement) {
      this.audioElement.removeEventListener("play", this._onPlay);
      this.audioElement.removeEventListener("pause", this._onPause);
      this.audioElement.removeEventListener("seeked", this._onSeeked);
      this.audioElement.removeEventListener("ended", this._onEnded);
    }

    this.audioElement = audioElement;

    this._onPlay = () => this._startPlayback();
    this._onPause = () => this._stopPlayback();
    this._onSeeked = () => this._renderCurrentFrame();
    this._onEnded = () => this._stopPlayback();

    this.audioElement.addEventListener("play", this._onPlay);
    this.audioElement.addEventListener("pause", this._onPause);
    this.audioElement.addEventListener("seeked", this._onSeeked);
    this.audioElement.addEventListener("ended", this._onEnded);
  }

  _startPlayback() {
    this.isPlaying = true;
    this.lastFrameIndex = -1;

    // Reset FPS tracking
    this._fpsTracker.reset();

    this._animate();
  }

  _stopPlayback() {
    this.isPlaying = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  _animate() {
    if (!this.isPlaying) return;

    this._renderCurrentFrame();
    this.animationFrameId = requestAnimationFrame(() => this._animate());
  }

  _renderCurrentFrame() {
    if (!this.audioElement || this.recorder.getFrameCount() === 0) return;

    const currentTimeMs = this.audioElement.currentTime * 1000;

    // Get the two nearest pre-interpolated frames and interpolate between them
    // This gives us smooth 60fps+ playback
    const framePair = this.recorder.getInterpolatedFramePair(currentTimeMs);

    if (framePair) {
      const { frameA, frameB, t } = framePair;

      // If both frames are the same or t is 0, just render frameA
      if (frameA === frameB || t === 0) {
        this.renderer.render(frameA.values);
      } else {
        // Real-time interpolation between the two nearest pre-calculated frames
        const interpolatedValues = this._lerpValues(frameA.values, frameB.values, t);
        this.renderer.render(interpolatedValues);
      }

      // Apply fade-in effect during first second (black overlay fading out)
      this._applyFadeIn(currentTimeMs);

      // Apply fade-out effect during last second (black overlay fading in)
      this._applyFadeOut(currentTimeMs);

      this.lastRenderTime = currentTimeMs;

      // Update FPS calculation
      this._fpsTracker.tick();
    }
  }

  /**
   * Apply fade-in effect by overlaying black with decreasing opacity
   * @param {number} currentTimeMs - Current playback time in milliseconds
   */
  _applyFadeIn(currentTimeMs) {
    const fadeInDuration = 1000; // 1 second fade-in
    if (currentTimeMs < fadeInDuration) {
      const opacity = 1 - currentTimeMs / fadeInDuration; // 1.0 → 0.0 over 1 second
      this._drawBlackOverlay(opacity);
    }
  }

  /**
   * Apply fade-out effect by overlaying black with increasing opacity
   * @param {number} currentTimeMs - Current playback time in milliseconds
   */
  _applyFadeOut(currentTimeMs) {
    const fadeOutDuration = 1000; // 1 second fade-out
    const totalDuration = this.recorder.getDuration();
    const fadeOutStart = totalDuration - fadeOutDuration;

    if (currentTimeMs > fadeOutStart && totalDuration > fadeOutDuration) {
      const elapsed = currentTimeMs - fadeOutStart;
      const opacity = elapsed / fadeOutDuration; // 0.0 → 1.0 over last second
      this._drawBlackOverlay(opacity);
    }
  }

  /**
   * Draw a black overlay with the specified opacity
   * @param {number} opacity - Opacity value (0-1)
   */
  _drawBlackOverlay(opacity) {
    const ctx = this.renderer.canvas.getContext("2d");
    ctx.fillStyle = `rgba(0, 0, 0, ${opacity})`;
    ctx.fillRect(0, 0, this.renderer.canvas.width, this.renderer.canvas.height);
  }

  /**
   * Linear interpolation between two value arrays
   * @param {number[]} valuesA - First frame values
   * @param {number[]} valuesB - Second frame values
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number[]} Interpolated values
   */
  _lerpValues(valuesA, valuesB, t) {
    // Reuse buffer for performance
    if (!this._interpolationBuffer || this._interpolationBuffer.length !== valuesA.length) {
      this._interpolationBuffer = new Float32Array(valuesA.length);
    }

    const result = this._interpolationBuffer;
    for (let i = 0; i < valuesA.length; i++) {
      result[i] = valuesA[i] + (valuesB[i] - valuesA[i]) * t;
    }
    return result;
  }

  /**
   * Get current playback FPS (frames rendered per second)
   * @returns {number} Current FPS
   */
  getFps() {
    return this._fpsTracker.getFps();
  }

  /**
   * Render the first frame (for preview when not playing)
   */
  renderFirstFrame() {
    const frames = this.recorder.getFrames();
    if (frames.length > 0) {
      this.renderer.render(frames[0].values);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this._stopPlayback();
    if (this.audioElement) {
      this.audioElement.removeEventListener("play", this._onPlay);
      this.audioElement.removeEventListener("pause", this._onPause);
      this.audioElement.removeEventListener("seeked", this._onSeeked);
      this.audioElement.removeEventListener("ended", this._onEnded);
    }
  }
}
