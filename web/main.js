import { AudioProcessor } from "./audio.js";
import { setButtonCallback, updateButtonState } from "./btn.js";
import { connectSerial, disconnectSerial, setAudioDataCallback, setButtonDataCallback, setThermalDataCallback } from "./serial.js";
import { ThermalPlayer } from "./thermal-player.js";
import { ThermalRecorder } from "./thermal-recorder.js";
import { ThermalRenderer } from "./thermal.js";

/**
 * App State Machine
 * States: empty, recording, loaded, replay
 * Transitions:
 *   empty -> recording: when button count becomes 2
 *   recording -> loaded: when button count is NOT 2
 *   loaded -> replay: when button count is 2
 *   replay -> empty: when button count is NOT 2
 */
const AppState = {
  EMPTY: "empty",
  RECORDING: "recording",
  LOADED: "loaded",
  REPLAY: "replay",
};

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
      playbackVideo: document.getElementById("playbackVideo"),
      minTempInput: document.getElementById("minTempInput"),
      maxTempInput: document.getElementById("maxTempInput"),
      rotateBtn: document.getElementById("rotateBtn"),
      appState: document.getElementById("appState"),
      resetStateBtn: document.getElementById("resetStateBtn"),
    };

    // App state management
    this.currentState = AppState.EMPTY;
    this._updateStateDisplay();

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

    // Set up canvas-to-video streaming for playback
    this._setupVideoStream();

    // Setup button callback to update UI and handle state transitions
    setButtonCallback((buttonCount) => {
      this.elements.buttonCount.textContent = buttonCount;
      this._handleButtonStateChange(buttonCount);
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
    this.elements.resetStateBtn.addEventListener("click", () => this._resetState());
  }

  _rotateBoth() {
    this.thermal.rotate();
    this.playbackRenderer.rotate();
    // Update video dimensions to match rotated canvas
    this.elements.playbackVideo.width = this.elements.playbackCanvas.width;
    this.elements.playbackVideo.height = this.elements.playbackCanvas.height;
  }

  /**
   * Set up canvas-to-video streaming
   * Captures the playback canvas as a MediaStream and displays it in the video element
   */
  _setupVideoStream() {
    // Capture canvas as a stream (30fps is enough for thermal data)
    const stream = this.elements.playbackCanvas.captureStream(30);
    this.elements.playbackVideo.srcObject = stream;

    // Start playing the video stream (muted, so no user interaction needed)
    this.elements.playbackVideo.play().catch(() => {
      // Autoplay may be blocked, but that's okay - the video will start when user interacts
    });

    // Initialize with black frame
    this._renderBlackFrame();
  }

  /**
   * Render a black frame to the playback canvas (shows black in video)
   */
  _renderBlackFrame() {
    const ctx = this.elements.playbackCanvas.getContext("2d");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.elements.playbackCanvas.width, this.elements.playbackCanvas.height);
  }

  /**
   * Handle button state changes and trigger state transitions
   * @param {number} buttonCount - Current button count
   */
  _handleButtonStateChange(buttonCount) {
    const isTwo = buttonCount === 2;

    switch (this.currentState) {
      case AppState.EMPTY:
        if (isTwo) {
          this._transitionTo(AppState.RECORDING);
        }
        break;
      case AppState.RECORDING:
        if (!isTwo) {
          this._transitionTo(AppState.LOADED);
        }
        break;
      case AppState.LOADED:
        if (isTwo) {
          this._transitionTo(AppState.REPLAY);
        }
        break;
      case AppState.REPLAY:
        if (!isTwo) {
          this._transitionTo(AppState.EMPTY);
        }
        break;
    }
  }

  /**
   * Transition to a new state and execute appropriate actions
   * @param {string} newState - The state to transition to
   */
  _transitionTo(newState) {
    const oldState = this.currentState;
    this.currentState = newState;
    this._updateStateDisplay();

    console.log(`State transition: ${oldState} -> ${newState}`);

    // Execute actions based on new state
    switch (newState) {
      case AppState.EMPTY:
        this._stopRecording();
        this._stopReplay();
        break;
      case AppState.RECORDING:
        this._stopReplay();
        this._startRecording();
        break;
      case AppState.LOADED:
        this._stopRecording();
        this._stopReplay();
        break;
      case AppState.REPLAY:
        this._stopRecording();
        this._startReplay();
        break;
    }
  }

  /**
   * Update the state display in the UI
   */
  _updateStateDisplay() {
    this.elements.appState.textContent = this.currentState;
  }

  /**
   * Reset to empty state
   */
  _resetState() {
    this._transitionTo(AppState.EMPTY);
  }

  /**
   * Internal method to start recording (called by state machine)
   */
  _startRecording() {
    if (this.elements.recordBtn.disabled) return; // Can't record if not connected
    this.startRecording();
  }

  /**
   * Internal method to stop recording (called by state machine)
   */
  _stopRecording() {
    if (this.audio.isRecording) {
      this.stopRecording();
    }
  }

  /**
   * Internal method to start replay (called by state machine)
   */
  _startReplay() {
    if (this.elements.audioPlayer.src) {
      this.elements.audioPlayer.currentTime = 0;
      this.elements.audioPlayer.play();
    }
  }

  /**
   * Internal method to stop replay (called by state machine)
   */
  _stopReplay() {
    this.elements.audioPlayer.pause();
    this.elements.audioPlayer.currentTime = 0;
    // Show black frame when not playing
    this._renderBlackFrame();
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
