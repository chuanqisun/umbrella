/**
 * Tab Manager - Handles streaming video/audio to a separate player tab
 * Uses window.open() and captureStream() for cross-tab video streaming
 */

/**
 * TabManager class manages the player window and video streaming
 */
export class TabManager {
  constructor() {
    /** @type {Window|null} */
    this.playerWindow = null;

    /** @type {MediaStream|null} */
    this.videoStream = null;

    /** @type {HTMLAudioElement|null} */
    this.audioElement = null;

    // Poll interval to detect when player window is closed
    this.pollInterval = null;

    // Callback when player window is closed
    this.onPlayerClosed = null;
  }

  /**
   * Set the video stream source (from canvas.captureStream())
   * @param {MediaStream} stream - The video stream to send to player
   */
  setVideoStream(stream) {
    this.videoStream = stream;

    // If player window is already open, update its video source
    if (this.playerWindow && !this.playerWindow.closed) {
      this._updatePlayerVideo();
    }
  }

  /**
   * Bind audio element for synced playback in player window
   * @param {HTMLAudioElement} audioElement - The audio element to mirror
   */
  bindAudio(audioElement) {
    this.audioElement = audioElement;
  }

  /**
   * Open the player in a new tab
   * @returns {boolean} - Whether the window was opened successfully
   */
  openPlayer() {
    // If already open, focus it
    if (this.playerWindow && !this.playerWindow.closed) {
      this.playerWindow.focus();
      return true;
    }

    // Open a new blank window
    this.playerWindow = window.open("", "_blank");

    if (!this.playerWindow) {
      console.error("Failed to open player window. Pop-up may be blocked.");
      return false;
    }

    // Build the player page HTML
    this._buildPlayerPage();

    // Set up the video stream
    this._updatePlayerVideo();

    // Start polling to detect when window is closed
    this._startPolling();

    return true;
  }

  /**
   * Close the player window
   */
  closePlayer() {
    if (this.playerWindow && !this.playerWindow.closed) {
      this.playerWindow.close();
    }
    this.playerWindow = null;
    this._stopPolling();
  }

  /**
   * Check if player window is open
   * @returns {boolean}
   */
  isPlayerOpen() {
    return this.playerWindow !== null && !this.playerWindow.closed;
  }

  /**
   * Set callback for when player window is closed
   * @param {Function} callback
   */
  setOnPlayerClosed(callback) {
    this.onPlayerClosed = callback;
  }

  /**
   * Show the green overlay in the player window
   */
  showGreenOverlay() {
    if (!this.playerWindow || this.playerWindow.closed) return;
    const overlay = this.playerWindow.document.getElementById("greenOverlay");
    if (overlay) {
      overlay.classList.add("visible");
    }
  }

  /**
   * Hide the green overlay in the player window
   */
  hideGreenOverlay() {
    if (!this.playerWindow || this.playerWindow.closed) return;
    const overlay = this.playerWindow.document.getElementById("greenOverlay");
    if (overlay) {
      overlay.classList.remove("visible");
    }
  }

  /**
   * Build the player page HTML in the new window
   * @private
   */
  _buildPlayerPage() {
    const doc = this.playerWindow.document;

    doc.open();
    doc.write(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>YouSan Player</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>☂️</text></svg>" />
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    html, body {
      width: 100%;
      height: 100%;
      background: black;
      overflow: hidden;
      position: relative;
    }
    
    #playerVideo {
      width: 100%;
      height: 100%;
      object-fit: cover;
      background: black;
    }

    #greenOverlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #00ff00;
      display: none;
      z-index: 10;
    }

    #greenOverlay.visible {
      display: block;
    }
  </style>
</head>
<body>
  <div id="greenOverlay"></div>
  <video id="playerVideo" muted autoplay></video>
</body>
</html>
    `);
    doc.close();
  }

  /**
   * Update the video element in the player window with the stream
   * @private
   */
  _updatePlayerVideo() {
    if (!this.playerWindow || this.playerWindow.closed || !this.videoStream) {
      return;
    }

    const video = this.playerWindow.document.getElementById("playerVideo");
    if (video) {
      video.srcObject = this.videoStream;
      video.play().catch((err) => {
        console.warn("Autoplay blocked in player window:", err);
      });
    }
  }

  /**
   * Start polling to detect when the player window is closed
   * @private
   */
  _startPolling() {
    this._stopPolling();

    this.pollInterval = setInterval(() => {
      if (this.playerWindow && this.playerWindow.closed) {
        this.playerWindow = null;
        this._stopPolling();

        if (this.onPlayerClosed) {
          this.onPlayerClosed();
        }
      }
    }, 500);
  }

  /**
   * Stop polling for window close
   * @private
   */
  _stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
