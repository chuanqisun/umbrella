/**
 * AudioProcessor - Handles audio recording and WAV file generation
 */
class AudioProcessor {
  constructor(sampleRate = 16000, numChannels = 1, bitsPerSample = 16) {
    this.sampleRate = sampleRate;
    this.numChannels = numChannels;
    this.bitsPerSample = bitsPerSample;
    this.recordedSamples = [];
    this.isRecording = false;
  }

  startRecording() {
    this.recordedSamples = [];
    this.isRecording = true;
  }

  stopRecording() {
    this.isRecording = false;
  }

  addSamples(samples) {
    if (this.isRecording) {
      this.recordedSamples.push(...samples);
    }
  }

  getSampleCount() {
    return this.recordedSamples.length;
  }

  /**
   * Parse binary data as 16-bit signed integers (little-endian)
   * @param {ArrayBuffer} buffer - Raw binary data from BLE
   * @returns {number[]} Array of audio samples
   */
  parseSamples(buffer) {
    const dataView = new DataView(buffer);
    const sampleCount = dataView.byteLength / 2;
    const samples = [];

    for (let i = 0; i < sampleCount; i++) {
      const sample = dataView.getInt16(i * 2, true); // little-endian
      samples.push(sample);
    }

    return samples;
  }

  /**
   * Create a WAV file blob from recorded samples
   * @returns {Blob} WAV file blob
   */
  createWavBlob() {
    const samples = this.recordedSamples;
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // RIFF header
    this._writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    this._writeString(view, 8, "WAVE");

    // fmt chunk
    this._writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, this.numChannels, true);
    view.setUint32(24, this.sampleRate, true);
    view.setUint32(28, this.sampleRate * this.numChannels * 2, true); // byte rate
    view.setUint16(32, this.numChannels * 2, true); // block align
    view.setUint16(34, this.bitsPerSample, true);

    // data chunk
    this._writeString(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    // Write samples
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      view.setInt16(offset, samples[i], true);
      offset += 2;
    }

    return new Blob([view], { type: "audio/wav" });
  }

  /**
   * Create a WAV file URL from recorded samples
   * @returns {string} Object URL for the WAV file
   */
  createWavUrl() {
    const blob = this.createWavBlob();
    return URL.createObjectURL(blob);
  }

  _writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export { AudioProcessor };
