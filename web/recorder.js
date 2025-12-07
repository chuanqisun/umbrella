export class Recorder {
  constructor() {
    this.frames = [];
    this.isRecording = false;
    this.startTime = 0;
  }

  startRecording() {
    this.frames = [];
    this.isRecording = true;
    this.startTime = performance.now();
  }

  stopRecording() {
    this.isRecording = false;
  }

  /**
   * Add a thermal frame with timestamp
   * @param {number[]} values - Array of temperature values
   */
  addFrame(values) {
    if (this.isRecording) {
      const timestamp = performance.now() - this.startTime;
      this.frames.push({
        timestamp,
        values: [...values], // Clone the array
      });
    }
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
   * Get frame at specific time (in milliseconds)
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
}
