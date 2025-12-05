import { AudioProcessor } from "./audio.js";
import { BLEConnection } from "./ble.js";

/**
 * AudioRecorderApp - Main application controller
 */
class AudioRecorderApp {
  constructor() {
    this.ble = new BLEConnection();
    this.audio = new AudioProcessor();

    // DOM elements
    this.elements = {
      connectBtn: document.getElementById("connectBtn"),
      disconnectBtn: document.getElementById("disconnectBtn"),
      recordBtn: document.getElementById("recordBtn"),
      stopBtn: document.getElementById("stopBtn"),
      status: document.getElementById("status"),
      sampleCount: document.getElementById("sampleCount"),
      audioPlayer: document.getElementById("audioPlayer"),
    };

    this._setupEventListeners();
    this._setupBLECallbacks();
  }

  _setupEventListeners() {
    this.elements.connectBtn.addEventListener("click", () => this.connect());
    this.elements.disconnectBtn.addEventListener("click", () => this.disconnect());
    this.elements.recordBtn.addEventListener("click", () => this.startRecording());
    this.elements.stopBtn.addEventListener("click", () => this.stopRecording());
  }

  _setupBLECallbacks() {
    this.ble.setDataCallback((buffer) => this._handleAudioData(buffer));
    this.ble.setDisconnectCallback(() => this._handleDisconnect());
  }

  async connect() {
    try {
      await this.ble.connect((status) => this._updateStatus(status));
      this._setUIState("connected");
    } catch (err) {
      console.error("Error:", err);
      this._updateStatus("Error: " + err.message);
    }
  }

  disconnect() {
    this.ble.disconnect();
    this._handleDisconnect();
  }

  startRecording() {
    this.audio.startRecording();
    this.elements.sampleCount.textContent = "0";
    this.elements.audioPlayer.src = "";
    this._setUIState("recording");
    this._updateStatus("Recording...");
  }

  stopRecording() {
    this.audio.stopRecording();
    this._setUIState("connected");
    this._updateStatus("Stopped. Processing audio...");
    this._processAudio();
  }

  _handleAudioData(buffer) {
    const samples = this.audio.parseSamples(buffer);
    const previousCount = this.audio.getSampleCount();

    this.audio.addSamples(samples);

    // Update UI periodically (every ~1000 samples)
    if (this.audio.isRecording && this.audio.getSampleCount() % 1000 < samples.length) {
      this.elements.sampleCount.textContent = this.audio.getSampleCount();
    }
  }

  _handleDisconnect() {
    this.audio.stopRecording();
    this._setUIState("disconnected");
    this._updateStatus("Disconnected");
  }

  _processAudio() {
    const url = this.audio.createWavUrl();
    this.elements.audioPlayer.src = url;
    this._updateStatus("Audio loaded");
  }

  _updateStatus(message) {
    this.elements.status.textContent = message;
  }

  _setUIState(state) {
    const { connectBtn, disconnectBtn, recordBtn, stopBtn } = this.elements;

    switch (state) {
      case "disconnected":
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        recordBtn.disabled = true;
        stopBtn.disabled = true;
        break;
      case "connected":
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        recordBtn.disabled = false;
        stopBtn.disabled = true;
        break;
      case "recording":
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        recordBtn.disabled = true;
        stopBtn.disabled = false;
        break;
    }
  }
}

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new AudioRecorderApp();
});
