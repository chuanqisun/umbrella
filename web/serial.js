/**
 * SerialConnection - Handles Web Serial API communication
 */
class SerialConnection {
  constructor(baudRate = 115200) {
    this.baudRate = baudRate;
    this.port = null;
    this.reader = null;
    this.readableStreamClosed = null;
    this.onDataReceived = null;
    this.onDisconnected = null;
    this._reading = false;
  }

  /**
   * Check if Web Serial is supported
   * @returns {boolean}
   */
  static isSupported() {
    return "serial" in navigator;
  }

  /**
   * Check if currently connected
   * @returns {boolean}
   */
  isConnected() {
    return this.port !== null && this._reading;
  }

  /**
   * Connect to a serial port
   * @param {Function} onStatusChange - Callback for status updates
   * @returns {Promise<void>}
   */
  async connect(onStatusChange) {
    if (!SerialConnection.isSupported()) {
      throw new Error("Web Serial not supported");
    }

    onStatusChange?.("Requesting serial port...");
    this.port = await navigator.serial.requestPort();

    onStatusChange?.("Opening serial port...");
    await this.port.open({ baudRate: this.baudRate });

    onStatusChange?.("Serial connected");
    this._startReading();
  }

  /**
   * Disconnect from the serial port
   */
  async disconnect() {
    this._reading = false;

    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }

    if (this.readableStreamClosed) {
      await this.readableStreamClosed.catch(() => {});
      this.readableStreamClosed = null;
    }

    if (this.port) {
      await this.port.close();
      this.port = null;
    }

    this.onDisconnected?.();
  }

  /**
   * Set callback for data received
   * @param {Function} callback - Function to call with Uint8Array data
   */
  setDataCallback(callback) {
    this.onDataReceived = callback;
  }

  /**
   * Set callback for disconnection
   * @param {Function} callback - Function to call on disconnect
   */
  setDisconnectCallback(callback) {
    this.onDisconnected = callback;
  }

  async _startReading() {
    this._reading = true;

    while (this.port && this.port.readable && this._reading) {
      this.reader = this.port.readable.getReader();

      try {
        while (this._reading) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value) {
            this.onDataReceived?.(value);
          }
        }
      } catch (error) {
        console.error("Serial read error:", error);
      } finally {
        this.reader.releaseLock();
        this.reader = null;
      }
    }

    this._reading = false;
  }

  stopMockData() {}
}

export { SerialConnection };
