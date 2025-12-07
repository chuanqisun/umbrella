import { AudioProcessor } from "./audio.js";
import { setButtonCallback, updateButtonState } from "./btn.js";
import { connectSerial, disconnectSerial, isConnected, setAudioDataCallback, setButtonDataCallback, setThermalDataCallback } from "./serial.js";
import { ThermalPlayer } from "./thermal-player.js";
import { ThermalRecorder } from "./thermal-recorder.js";
import { ThermalRenderer } from "./thermal.js";

/**
 * AudioRecorderApp - Main application controller
 * Uses Serial port for all communication (thermal, audio, button)
 */
class AudioRecorderApp {
  constructor() {
    this.audio = new AudioProcessor();

    // DOM elements
    this.elements = {
      serialConnectBtn: document.getElementById("serialConnectBtn"),
      serialDisconnectBtn: document.getElementById("serialDisconnectBtn"),
      recordBtn: document.getElementById("recordBtn"),
      stopBtn: document.getElementById("stopBtn"),
      serialStatus: document.getElementById("serialStatus"),
      sampleCount: document.getElementById("sampleCount"),
      samplesReceived: document.getElementById("samplesReceived"),
      packetsReceived: document.getElementById("packetsReceived"),
      packetsPerSec: document.getElementById("packetsPerSec"),
      packetLoss: document.getElementById("packetLoss"),
      frameCount: document.getElementById("frameCount"),
      buttonCount: document.getElementById("buttonCount"),
      audioPlayer: document.getElementById("audioPlayer"),
      thermalCanvas: document.getElementById("thermalCanvas"),
      playbackCanvas: document.getElementById("playbackCanvas"),
      minTempInput: document.getElementById("minTempInput"),
      maxTempInput: document.getElementById("maxTempInput"),
      rotateBtn: document.getElementById("rotateBtn"),
    };

    // Packet rate tracking
    this.packetsThisSecond = 0;
    this.totalPacketsReceived = 0;
    this.lastPacketRateUpdate = Date.now();
    setInterval(() => this._updatePacketRate(), 1000);

    // Initialize thermal renderer for live view
    this.thermal = new ThermalRenderer(this.elements.thermalCanvas, {
      width: 32,
      height: 24,
      cellSize: 8,
      minTemp: parseFloat(this.elements.minTempInput.value),
      maxTemp: parseFloat(this.elements.maxTempInput.value),
    });

    // Initialize thermal recorder
    this.thermalRecorder = new ThermalRecorder();

    // Initialize playback renderer
    this.playbackRenderer = new ThermalRenderer(this.elements.playbackCanvas, {
      width: 32,
      height: 24,
      cellSize: 8,
      minTemp: parseFloat(this.elements.minTempInput.value),
      maxTemp: parseFloat(this.elements.maxTempInput.value),
    });

    // Initialize thermal player
    this.thermalPlayer = new ThermalPlayer(this.playbackRenderer, this.thermalRecorder);
    this.thermalPlayer.bindAudio(this.elements.audioPlayer);

    // Setup button callback to update UI
    setButtonCallback((state) => {
      this.elements.buttonCount.textContent = state;
    });

    this._setupEventListeners();
    this._setupSerialCallbacks();
  }

  _setupEventListeners() {
    this.elements.serialConnectBtn.addEventListener("click", () => this.connectSerialPort());
    this.elements.serialDisconnectBtn.addEventListener("click", () => this.disconnectSerialPort());
    this.elements.recordBtn.addEventListener("click", () => this.startRecording());
    this.elements.stopBtn.addEventListener("click", () => this.stopRecording());
    this.elements.minTempInput.addEventListener("input", () => this._updateTempRange());
    this.elements.maxTempInput.addEventListener("input", () => this._updateTempRange());
    this.elements.rotateBtn.addEventListener("click", () => this._rotateBoth());
  }

  _rotateBoth() {
    this.thermal.rotate();
    this.playbackRenderer.rotate();
  }

  _updateTempRange() {
    this.thermal.minTemp = parseFloat(this.elements.minTempInput.value);
    this.thermal.maxTemp = parseFloat(this.elements.maxTempInput.value);
    this.playbackRenderer.minTemp = parseFloat(this.elements.minTempInput.value);
    this.playbackRenderer.maxTemp = parseFloat(this.elements.maxTempInput.value);
  }

  async connectSerialPort() {
    const success = await connectSerial();
    if (success) {
      this.elements.serialStatus.textContent = "Connected";
      this.elements.serialConnectBtn.disabled = true;
      this.elements.serialDisconnectBtn.disabled = false;
      this.elements.recordBtn.disabled = false;
    }
  }

  async disconnectSerialPort() {
    const success = await disconnectSerial();
    if (success) {
      this.elements.serialStatus.textContent = "Disconnected";
      this.elements.serialConnectBtn.disabled = false;
      this.elements.serialDisconnectBtn.disabled = true;
      this.elements.recordBtn.disabled = true;
      this.elements.stopBtn.disabled = true;
    }
  }

  _setupSerialCallbacks() {
    // Thermal data callback
    setThermalDataCallback((values) => {
      this.thermal.render(values);
      // Record thermal frames when recording
      if (this.thermalRecorder.isRecording) {
        this.thermalRecorder.addFrame(values);
      }
    });

    // Button state callback
    setButtonDataCallback((state) => {
      updateButtonState(state);
    });

    // Audio data callback (replaces BLE audio)
    setAudioDataCallback((buffer) => this._handleAudioData(buffer));
  }

  startRecording() {
    this.audio.startRecording();
    this.thermalRecorder.startRecording();
    this.elements.sampleCount.textContent = "0";
    this.elements.frameCount.textContent = "0";
    this.elements.audioPlayer.src = "";
    this.elements.recordBtn.disabled = true;
    this.elements.stopBtn.disabled = false;
    this.elements.serialStatus.textContent = "Recording...";
  }

  stopRecording() {
    this.audio.stopRecording();
    this.thermalRecorder.stopRecording();
    this.elements.recordBtn.disabled = false;
    this.elements.stopBtn.disabled = true;
    this.elements.serialStatus.textContent = "Connected - Processing...";
    this._processAudio();
  }

  _handleAudioData(buffer) {
    const samples = this.audio.parseSamples(buffer);

    // Track packets received
    this.packetsThisSecond++;
    this.totalPacketsReceived++;
    this.elements.packetsReceived.textContent = this.totalPacketsReceived;

    // Track total samples decoded (regardless of recording state)
    this.elements.samplesReceived.textContent = this.audio.getTotalSamplesDecoded();

    // Update packet loss stats
    const stats = this.audio.getStats();
    this.elements.packetLoss.textContent = stats.lossRate;

    this.audio.addSamples(samples);

    // Update UI periodically (every ~1000 samples)
    if (this.audio.isRecording && this.audio.getSampleCount() % 1000 < samples.length) {
      this.elements.sampleCount.textContent = this.audio.getSampleCount();
      this.elements.frameCount.textContent = this.thermalRecorder.getFrameCount();
    }
  }

  _handleDisconnect() {
    this.audio.stopRecording();
    this.elements.serialConnectBtn.disabled = false;
    this.elements.serialDisconnectBtn.disabled = true;
    this.elements.recordBtn.disabled = true;
    this.elements.stopBtn.disabled = true;
    this.elements.serialStatus.textContent = "Disconnected";
  }

  _updatePacketRate() {
    this.elements.packetsPerSec.textContent = this.packetsThisSecond;
    this.packetsThisSecond = 0;
  }

  _processAudio() {
    const url = this.audio.createWavUrl();
    this.elements.audioPlayer.src = url;
    this.elements.frameCount.textContent = this.thermalRecorder.getFrameCount();
    // Show first frame in playback canvas
    this.thermalPlayer.renderFirstFrame();
    this.elements.serialStatus.textContent = "Connected - Audio ready";
  }
}

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new AudioRecorderApp();
});
