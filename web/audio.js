/**
 * AudioProcessor - Handles ADPCM decoding, audio recording and WAV file generation
 * Implements time-independent decoding: dropped packets don't create gaps,
 * they just result in slightly compressed audio.
 */

// IMA ADPCM step size table (same as encoder)
const STEP_TABLE = new Int16Array([
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130, 143, 157, 173, 190, 209, 230, 253,
  279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660,
  4026, 4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
]);

// IMA ADPCM index adjustment table
const INDEX_TABLE = new Int8Array([-1, -1, -1, -1, 2, 4, 6, 8, -1, -1, -1, -1, 2, 4, 6, 8]);

class AudioProcessor {
  // Number of samples per ADPCM packet (59 bytes × 2 nibbles)
  static SAMPLES_PER_PACKET = 118;

  constructor(sampleRate = 16000, numChannels = 1, bitsPerSample = 16) {
    this.sampleRate = sampleRate;
    this.numChannels = numChannels;
    this.bitsPerSample = bitsPerSample;
    this.recordedSamples = [];
    this.isRecording = false;

    // ADPCM decoder state
    this.adpcmPredicted = 0;
    this.adpcmIndex = 0;

    // Packet tracking for time-independent decoding
    this.expectedSeq = 0;
    this.lastSample = 0;
    this.droppedPackets = 0;
    this.totalPackets = 0;
    this.totalSamplesDecoded = 0;
  }

  startRecording() {
    this.recordedSamples = [];
    this.isRecording = true;
    // Reset decoder state
    this.adpcmPredicted = 0;
    this.adpcmIndex = 0;
    this.expectedSeq = 0;
    this.lastSample = 0;
    this.droppedPackets = 0;
    this.totalPackets = 0;
    this.totalSamplesDecoded = 0;
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

  getTotalSamplesDecoded() {
    return this.totalSamplesDecoded;
  }

  getStats() {
    return {
      droppedPackets: this.droppedPackets,
      totalPackets: this.totalPackets,
      lossRate: this.totalPackets > 0 ? ((this.droppedPackets / this.totalPackets) * 100).toFixed(1) + "%" : "0%",
    };
  }

  /**
   * Decode a single ADPCM nibble to 16-bit PCM sample
   * @param {number} nibble - 4-bit ADPCM value
   * @returns {number} 16-bit PCM sample
   */
  _decodeADPCMNibble(nibble) {
    const step = STEP_TABLE[this.adpcmIndex];

    // Calculate difference
    let delta = step >> 3;
    if (nibble & 4) delta += step;
    if (nibble & 2) delta += step >> 1;
    if (nibble & 1) delta += step >> 2;

    // Apply sign and update predictor
    if (nibble & 8) {
      this.adpcmPredicted -= delta;
    } else {
      this.adpcmPredicted += delta;
    }

    // Clamp predictor
    if (this.adpcmPredicted > 32767) this.adpcmPredicted = 32767;
    if (this.adpcmPredicted < -32768) this.adpcmPredicted = -32768;

    // Update index
    this.adpcmIndex += INDEX_TABLE[nibble];
    if (this.adpcmIndex < 0) this.adpcmIndex = 0;
    if (this.adpcmIndex > 88) this.adpcmIndex = 88;

    return this.adpcmPredicted;
  }

  /**
   * Generate interpolated samples to fill gaps from dropped packets
   * Uses cosine interpolation with comfort noise for more natural sound
   * @param {number} gapPackets - Number of dropped packets
   * @param {number} nextFirstSample - First sample of the next received packet
   * @returns {number[]} Interpolated samples to fill the gap
   */
  _interpolateGap(gapPackets, nextFirstSample) {
    const missingSamples = gapPackets * AudioProcessor.SAMPLES_PER_PACKET;
    const interpolated = new Array(missingSamples);

    const startSample = this.lastSample;
    const endSample = nextFirstSample;

    // Estimate the signal amplitude for comfort noise
    const amplitude = Math.abs(startSample - endSample) / 2;
    const noiseLevel = Math.min(amplitude * 0.3, 500); // 30% of transition or max 500

    // Cosine interpolation with comfort noise for more natural sound
    for (let i = 0; i < missingSamples; i++) {
      const t = (i + 1) / (missingSamples + 1); // 0 < t < 1

      // Cosine interpolation (smoother than linear)
      const cosT = (1 - Math.cos(t * Math.PI)) / 2;
      let sample = startSample * (1 - cosT) + endSample * cosT;

      // Add comfort noise (reduces the "underwater" effect)
      // Noise is higher in the middle, fades at edges
      const noiseEnvelope = Math.sin(t * Math.PI); // 0 at edges, 1 in middle
      const noise = (Math.random() - 0.5) * 2 * noiseLevel * noiseEnvelope;
      sample += noise;

      // Clamp to valid range
      interpolated[i] = Math.round(Math.max(-32768, Math.min(32767, sample)));
    }

    return interpolated;
  }

  /**
   * Parse ADPCM packet with time-independent decoding
   * Packet structure (64 bytes):
   * [0-1]: sequence number (uint16, little-endian)
   * [2-3]: ADPCM predicted value (int16, little-endian)
   * [4]:   ADPCM step index (uint8)
   * [5-63]: ADPCM data (59 bytes = 118 samples)
   *
   * When packets are dropped, interpolated samples are generated to maintain
   * correct playback duration (time-independent of packet loss).
   *
   * @param {ArrayBuffer} buffer - Raw ADPCM packet from BLE
   * @returns {number[]} Array of decoded 16-bit PCM samples (including interpolated samples for gaps)
   */
  parseSamples(buffer) {
    const dataView = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    // Parse header
    const seq = dataView.getUint16(0, true); // Little-endian
    const packetPredicted = dataView.getInt16(2, true);
    const packetIndex = dataView.getUint8(4);

    this.totalPackets++;

    // Decode ADPCM data first to get samples (59 bytes = 118 samples)
    const HEADER_SIZE = 5;

    // Temporarily save decoder state, then sync to packet state for decoding
    this.adpcmPredicted = packetPredicted;
    this.adpcmIndex = packetIndex;

    const decodedSamples = [];
    for (let i = HEADER_SIZE; i < buffer.byteLength; i++) {
      const byte = uint8View[i];

      // Low nibble first
      const lowNibble = byte & 0x0f;
      decodedSamples.push(this._decodeADPCMNibble(lowNibble));

      // High nibble second
      const highNibble = (byte >> 4) & 0x0f;
      decodedSamples.push(this._decodeADPCMNibble(highNibble));
    }

    // Now handle packet loss and interpolation
    let samples = [];

    // Handle packet loss - generate interpolated samples to maintain timing
    if (this.totalPackets > 1) {
      const expectedSeq = this.expectedSeq;
      const gap = (seq - expectedSeq + 65536) % 65536;

      if (gap === 0) {
        // Normal case: received expected packet, no loss
        // Continue processing
      } else if (gap > 0 && gap < 1000) {
        // Packets were dropped - interpolate to fill the time gap
        this.droppedPackets += gap;
        console.log(`Dropped ${gap} packets (${this.getStats().lossRate} total loss), interpolating ${gap * AudioProcessor.SAMPLES_PER_PACKET} samples`);

        // Generate interpolated samples using first sample of new packet as target
        const firstNewSample = decodedSamples.length > 0 ? decodedSamples[0] : this.lastSample;
        const interpolatedSamples = this._interpolateGap(gap, firstNewSample);
        samples.push(...interpolatedSamples);
      } else if (gap >= 65536 - 1000) {
        // Duplicate or out-of-order packet (seq < expectedSeq), ignore
        console.log(`Ignoring out-of-order packet: seq=${seq}, expected=${expectedSeq}`);
        return [];
      }
    }

    this.expectedSeq = (seq + 1) & 0xffff;

    // Add decoded samples
    samples.push(...decodedSamples);

    this.totalSamplesDecoded += samples.length;

    // Store last sample for interpolation of future gaps
    if (decodedSamples.length > 0) {
      this.lastSample = decodedSamples[decodedSamples.length - 1];
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
