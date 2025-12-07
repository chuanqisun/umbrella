/**
 * FPS (Frames Per Second) tracker utility class
 * Tracks frame rate over a configurable time window
 */
export class FpsTracker {
  /**
   * @param {number} updateInterval - Time window in ms for FPS calculation (default: 1000ms)
   */
  constructor(updateInterval = 1000) {
    this.updateInterval = updateInterval;
    this._frameCount = 0;
    this._lastTime = 0;
    this._currentFps = 0;
  }

  /**
   * Reset the FPS tracker (call when starting a new measurement period)
   */
  reset() {
    this._frameCount = 0;
    this._lastTime = performance.now();
    this._currentFps = 0;
  }

  /**
   * Record a frame tick and update FPS calculation
   * Call this method every time a frame is processed
   */
  tick() {
    this._frameCount++;
    const now = performance.now();
    const elapsed = now - this._lastTime;

    if (elapsed >= this.updateInterval) {
      this._currentFps = (this._frameCount / elapsed) * 1000;
      this._frameCount = 0;
      this._lastTime = now;
    }
  }

  /**
   * Get the current FPS value
   * @returns {number} Current frames per second
   */
  getFps() {
    return this._currentFps;
  }
}
