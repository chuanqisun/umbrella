import { AudioProcessor } from "./audio.js";
import { setButtonCallback, updateButtonState } from "./btn.js";
import { Player } from "./player.js";
import { Recorder } from "./recorder.js";
import { connectSerial, disconnectSerial, setAudioDataCallback, setButtonDataCallback, setThermalDataCallback } from "./serial.js";
import { ThermalRenderer } from "./thermal.js";

/**
 * App State Machine
 * States: empty, warmup, recording, cooldown, loaded, rewarmup, replay
 * Transitions:
 *   empty -> warmup: when button count becomes 2 (starts recording)
 *   warmup -> recording: after 1 second hold
 *   warmup -> empty: if button released before 1 second (discards recording)
 *   recording -> cooldown: when button count becomes < 2
 *   cooldown -> loaded: after 1 second with button count < 2
 *   cooldown -> recording: if button count becomes 2 before 1 second
 *   loaded -> rewarmup: when button count becomes 2
 *   rewarmup -> replay: after 1 second hold
 *   rewarmup -> loaded: if button released before 1 second
 *   replay -> empty: when button count is 0 or audio ends
 */
const AppState = {
  EMPTY: "empty",
  WARMUP: "warmup",
  RECORDING: "recording",
  COOLDOWN: "cooldown",
  LOADED: "loaded",
  REWARMUP: "rewarmup",
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
      recorderFps: document.getElementById("recorderFps"),
      playerFps: document.getElementById("playerFps"),
      volumeSlider: document.getElementById("volumeSlider"),
      volumeValue: document.getElementById("volumeValue"),
    };

    // Web Audio API for volume overamplification
    this.audioContext = null;
    this.gainNode = null;
    this.mediaSource = null;

    // Button hold timer for state transitions
    this._buttonHoldTimer = null;
    this._buttonHoldDuration = 1000; // 1 second

    // App state management
    this.currentState = AppState.EMPTY;
    this._updateStateDisplay();

    // Packet rate tracking
    this.packetsThisSecond = 0;
    this.totalPacketsReceived = 0;
    this.lastPacketRateUpdate = Date.now();
    setInterval(() => this._updatePacketRate(), 1000);

    // FPS display update (more frequent for smoother display)
    setInterval(() => this._updateFpsDisplay(), 250);

    // Initialize thermal renderer for live view
    this.thermal = new ThermalRenderer(this.elements.thermalCanvas, {
      width: 32,
      height: 24,
      cellSize: 8,
      minTemp: parseFloat(this.elements.minTempInput.value),
      maxTemp: parseFloat(this.elements.maxTempInput.value),
    });

    // Initialize thermal recorder
    this.thermalRecorder = new Recorder();

    // Initialize playback renderer
    this.playbackRenderer = new ThermalRenderer(this.elements.playbackCanvas, {
      width: 32,
      height: 24,
      cellSize: 8,
      minTemp: parseFloat(this.elements.minTempInput.value),
      maxTemp: parseFloat(this.elements.maxTempInput.value),
    });

    // Initialize thermal player
    this.thermalPlayer = new Player(this.playbackRenderer, this.thermalRecorder);
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
    this.elements.recordBtn.addEventListener("click", () => this._startManualRecording());
    this.elements.stopBtn.addEventListener("click", () => this._transitionTo(AppState.LOADED));
    this.elements.minTempInput.addEventListener("input", () => this._updateTempRange());
    this.elements.maxTempInput.addEventListener("input", () => this._updateTempRange());
    this.elements.rotateBtn.addEventListener("click", () => this._rotateBoth());
    this.elements.resetStateBtn.addEventListener("click", () => this._resetState());
    this.elements.volumeSlider.addEventListener("input", () => this._updateVolume());

    // Initialize audio context on first user interaction
    this.elements.audioPlayer.addEventListener("play", () => this._initAudioContext(), { once: true });

    // Exit replay state when audio ends
    this.elements.audioPlayer.addEventListener("ended", () => {
      if (this.currentState === AppState.REPLAY) {
        this._transitionTo(AppState.EMPTY);
      }
    });
  }

  /**
   * Initialize Web Audio API for volume overamplification
   */
  _initAudioContext() {
    if (this.audioContext) return;

    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    this.mediaSource = this.audioContext.createMediaElementSource(this.elements.audioPlayer);
    this.gainNode = this.audioContext.createGain();

    this.mediaSource.connect(this.gainNode);
    this.gainNode.connect(this.audioContext.destination);

    // Apply current volume setting
    this._updateVolume();
  }

  /**
   * Update volume based on slider value (supports overamplification)
   */
  _updateVolume() {
    const value = parseInt(this.elements.volumeSlider.value);
    this.elements.volumeValue.textContent = `${value}%`;

    if (this.gainNode) {
      this.gainNode.gain.value = value / 100;
    }
  }

  _rotateBoth() {
    this.thermal.rotate();
    this.playbackRenderer.rotate();
    // Video is now full-screen background, no need to update dimensions
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
   * Uses WARMUP state for the 1-second confirmation period
   * @param {number} buttonCount - Current button count
   */
  _handleButtonStateChange(buttonCount) {
    const isTwo = buttonCount === 2;

    // Clear any pending hold timer when button state changes
    if (this._buttonHoldTimer) {
      clearTimeout(this._buttonHoldTimer);
      this._buttonHoldTimer = null;
    }

    switch (this.currentState) {
      case AppState.EMPTY:
        if (isTwo) {
          // Start warmup (begins recording but not yet committed)
          this._transitionTo(AppState.WARMUP);

          // After 1 second, confirm and transition to recording
          this._buttonHoldTimer = setTimeout(() => {
            this._buttonHoldTimer = null;
            // Only transition if still in warmup state (not cancelled by button release)
            if (this.currentState === AppState.WARMUP) {
              this._transitionTo(AppState.RECORDING);
            }
          }, this._buttonHoldDuration);
        }
        break;
      case AppState.WARMUP:
        if (!isTwo) {
          // Button released before 1 second - discard and go back to empty
          this._transitionTo(AppState.EMPTY);
        }
        break;
      case AppState.RECORDING:
        if (!isTwo) {
          // Start cooldown period
          this._transitionTo(AppState.COOLDOWN);

          // After 1 second, confirm and transition to loaded
          this._buttonHoldTimer = setTimeout(() => {
            this._buttonHoldTimer = null;
            // Only transition if still in cooldown state (not cancelled by button press)
            if (this.currentState === AppState.COOLDOWN) {
              this._transitionTo(AppState.LOADED);
            }
          }, this._buttonHoldDuration);
        }
        break;
      case AppState.COOLDOWN:
        if (isTwo) {
          // Button pressed again before 1 second - go back to recording
          this._transitionTo(AppState.RECORDING);
        }
        break;
      case AppState.LOADED:
        if (isTwo) {
          // Start rewarmup
          this._transitionTo(AppState.REWARMUP);

          // After 1 second, confirm and transition to replay
          this._buttonHoldTimer = setTimeout(() => {
            this._buttonHoldTimer = null;
            // Only transition if still in rewarmup state (not cancelled by button release)
            if (this.currentState === AppState.REWARMUP) {
              this._transitionTo(AppState.REPLAY);
            }
          }, this._buttonHoldDuration);
        }
        break;
      case AppState.REWARMUP:
        if (!isTwo) {
          // Button released before 1 second - go back to loaded
          this._transitionTo(AppState.LOADED);
        }
        break;
      case AppState.REPLAY:
        if (buttonCount === 0) {
          this._transitionTo(AppState.EMPTY);
        }
        break;
    }
  } /**
   * Discard the current recording without committing
   */
  _discardRecording() {
    this.audio.stopRecording();
    this.audio.clearRecording();
    this.thermalRecorder.stopRecording();
    this.thermalRecorder.clear();
    this.elements.sampleCount.textContent = "0";
    this.elements.frameCount.textContent = "0";
    this.elements.recordBtn.disabled = false;
    this.elements.stopBtn.disabled = true;
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
        // If coming from WARMUP, discard the recording
        if (oldState === AppState.WARMUP) {
          this._discardRecording();
        } else {
          this._stopRecording();
        }
        this._stopReplay();
        break;
      case AppState.WARMUP:
        this._stopReplay();
        this._startRecording();
        break;
      case AppState.RECORDING:
        // Start recording if coming from EMPTY (manual trigger)
        // Do nothing if coming from WARMUP (already started)
        if (oldState === AppState.EMPTY) {
          this._stopReplay();
          this._startRecording();
        }
        break;
      case AppState.COOLDOWN:
        // Still recording during cooldown, waiting for confirmation
        break;
      case AppState.LOADED:
        this._stopRecording();
        this._stopReplay();
        break;
      case AppState.REWARMUP:
        // Waiting for 1 second hold before replay, nothing to do yet
        break;
      case AppState.REPLAY:
        this._stopRecording();
        this._startReplay();
        break;
    }
  }

  /**
   * Start recording manually from UI (bypasses warmup state)
   */
  _startManualRecording() {
    if (this.currentState === AppState.EMPTY) {
      this._transitionTo(AppState.RECORDING);
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
  }

  stopRecording() {
    this.audio.stopRecording();
    this.thermalRecorder.stopRecording();
    this.elements.recordBtn.disabled = false;
    this.elements.stopBtn.disabled = true;
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

  _updateFpsDisplay() {
    // Update recorder FPS
    const recorderFps = this.thermalRecorder.getFps();
    this.elements.recorderFps.textContent = recorderFps.toFixed(1);

    // Update player FPS
    const playerFps = this.thermalPlayer.getFps();
    this.elements.playerFps.textContent = playerFps.toFixed(1);
  }

  _processAudio() {
    const url = this.audio.createWavUrl();
    this.elements.audioPlayer.src = url;
    this.elements.frameCount.textContent = this.thermalRecorder.getFrameCount();
    // Show first frame in playback canvas
    this.thermalPlayer.renderFirstFrame();
  }
}

// Initialize the app when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  new AudioRecorderApp();
});
