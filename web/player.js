export class Player {
  constructor(renderer, recorder) {
    this.renderer = renderer;
    this.recorder = recorder;
    this.audioElement = null;
    this.isPlaying = false;
    this.animationFrameId = null;
    this.lastFrameIndex = -1;
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
    const frame = this.recorder.getFrameAtTime(currentTimeMs);

    if (frame) {
      // Only render if it's a different frame
      const frameIndex = this.recorder.getFrames().indexOf(frame);
      if (frameIndex !== this.lastFrameIndex) {
        this.renderer.render(frame.values);
        this.lastFrameIndex = frameIndex;
      }
    }
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
