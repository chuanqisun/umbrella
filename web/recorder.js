import { FpsTracker } from "./fps.js";

export class Recorder {
  constructor() {
    this.frames = []; // Original recorded frames
    this.interpolatedFrames = []; // Pre-calculated 60fps frames
    this.isRecording = false;
    this.startTime = 0;
    this.targetFps = 60;
    this.frameInterval = 1000 / 60; // ~16.67ms per frame at 60fps

    // FPS tracking
    this._fpsTracker = new FpsTracker();
  }

  startRecording() {
    this.frames = [];
    this.interpolatedFrames = [];
    this.isRecording = true;
    this.startTime = performance.now();

    // Reset FPS tracking
    this._fpsTracker.reset();
  }

  stopRecording() {
    this.isRecording = false;
    // Finalize interpolation for any remaining gap
    this._finalizeInterpolation();
  }

  /**
   * Add a thermal frame with timestamp
   * @param {number[]} values - Array of temperature values
   */
  addFrame(values) {
    if (this.isRecording) {
      const timestamp = performance.now() - this.startTime;
      const frame = {
        timestamp,
        values: [...values], // Clone the array
      };
      this.frames.push(frame);

      // Update FPS calculation
      this._fpsTracker.tick();

      // Pre-calculate interpolated frames as soon as we have 2+ frames
      if (this.frames.length >= 2) {
        this._interpolateBetweenLastFrames();
      } else {
        // First frame - add it to interpolated frames directly
        this.interpolatedFrames.push({ ...frame, values: [...frame.values] });
      }
    }
  }

  /**
   * Interpolate frames between the last two recorded frames to achieve 60fps
   * @private
   */
  _interpolateBetweenLastFrames() {
    const prevFrame = this.frames[this.frames.length - 2];
    const currFrame = this.frames[this.frames.length - 1];
    const duration = currFrame.timestamp - prevFrame.timestamp;

    // Calculate how many 60fps frames fit in this gap
    // Start from the next frame interval after prevFrame
    const lastInterpolatedTime = this.interpolatedFrames.length > 0 ? this.interpolatedFrames[this.interpolatedFrames.length - 1].timestamp : 0;

    // Generate frames at regular 60fps intervals
    let nextFrameTime = Math.ceil(prevFrame.timestamp / this.frameInterval) * this.frameInterval;
    if (nextFrameTime <= lastInterpolatedTime) {
      nextFrameTime = lastInterpolatedTime + this.frameInterval;
    }

    while (nextFrameTime < currFrame.timestamp) {
      const t = (nextFrameTime - prevFrame.timestamp) / duration;
      const interpolatedValues = this._lerpFrameValues(prevFrame.values, currFrame.values, t);

      this.interpolatedFrames.push({
        timestamp: nextFrameTime,
        values: interpolatedValues,
      });

      nextFrameTime += this.frameInterval;
    }

    // Add the current frame at its exact timestamp
    this.interpolatedFrames.push({ ...currFrame, values: [...currFrame.values] });
  }

  /**
   * Finalize interpolation after recording stops
   * @private
   */
  _finalizeInterpolation() {
    // Already handled incrementally, but ensure last frame is included
    if (this.frames.length > 0 && this.interpolatedFrames.length > 0) {
      const lastFrame = this.frames[this.frames.length - 1];
      const lastInterpolated = this.interpolatedFrames[this.interpolatedFrames.length - 1];
      if (lastInterpolated.timestamp < lastFrame.timestamp) {
        this.interpolatedFrames.push({ ...lastFrame, values: [...lastFrame.values] });
      }
    }
  }

  /**
   * Linear interpolation between two frame value arrays
   * @param {number[]} valuesA - First frame values
   * @param {number[]} valuesB - Second frame values
   * @param {number} t - Interpolation factor (0-1)
   * @returns {number[]} Interpolated values
   */
  _lerpFrameValues(valuesA, valuesB, t) {
    const result = new Array(valuesA.length);
    for (let i = 0; i < valuesA.length; i++) {
      result[i] = valuesA[i] + (valuesB[i] - valuesA[i]) * t;
    }
    return result;
  }

  /**
   * Get current recording FPS (frames received per second)
   * @returns {number} Current FPS
   */
  getFps() {
    return this._fpsTracker.getFps();
  }

  getFrameCount() {
    return this.frames.length;
  }

  getFrames() {
    return this.frames;
  }

  getDuration() {
    if (this.frames.length === 0) return 0;
    return this.frames[this.frames.length - 1].timestamp;
  }

  /**
   * Get the pre-interpolated frames (60fps)
   * @returns {object[]} Array of interpolated frames
   */
  getInterpolatedFrames() {
    return this.interpolatedFrames;
  }

  /**
   * Get frame at specific time (in milliseconds) from original frames
   * @param {number} timeMs - Time in milliseconds
   * @returns {object|null} Frame data or null
   */
  getFrameAtTime(timeMs) {
    if (this.frames.length === 0) return null;

    // Binary search for the closest frame
    let left = 0;
    let right = this.frames.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      if (this.frames[mid].timestamp <= timeMs) {
        left = mid;
      } else {
        right = mid - 1;
      }
    }

    return this.frames[left];
  }

  /**
   * Get the two nearest interpolated frames for a given time,
   * plus the interpolation factor between them.
   * Used for real-time playback interpolation.
   * @param {number} timeMs - Time in milliseconds
   * @returns {object|null} { frameA, frameB, t } or null
   */
  getInterpolatedFramePair(timeMs) {
    const frames = this.interpolatedFrames;
    if (frames.length === 0) return null;
    if (frames.length === 1) return { frameA: frames[0], frameB: frames[0], t: 0 };

    // Clamp to valid range
    if (timeMs <= frames[0].timestamp) {
      return { frameA: frames[0], frameB: frames[0], t: 0 };
    }
    if (timeMs >= frames[frames.length - 1].timestamp) {
      const last = frames[frames.length - 1];
      return { frameA: last, frameB: last, t: 0 };
    }

    // Binary search for the frame just before timeMs
    let left = 0;
    let right = frames.length - 1;

    while (left < right) {
      const mid = Math.floor((left + right + 1) / 2);
      if (frames[mid].timestamp <= timeMs) {
        left = mid;
      } else {
        right = mid - 1;
      }
    }

    const frameA = frames[left];
    const frameB = frames[Math.min(left + 1, frames.length - 1)];

    // Calculate interpolation factor
    const duration = frameB.timestamp - frameA.timestamp;
    const t = duration > 0 ? (timeMs - frameA.timestamp) / duration : 0;

    return { frameA, frameB, t };
  }
}
