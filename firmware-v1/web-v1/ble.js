/**
 * BLEConnection - Handles Bluetooth Low Energy communication
 */
class BLEConnection {
  static SERVICE_UUID = "6e400001-b5a3-f393-e0a9-e50e24dcca9e";
  static TX_CHAR_UUID = "6e400003-b5a3-f393-e0a9-e50e24dcca9e"; // notify: ESP32 -> browser

  constructor() {
    this.device = null;
    this.characteristic = null;
    this.onDataReceived = null;
    this.onDisconnected = null;
  }

  /**
   * Check if Web Bluetooth is supported
   * @returns {boolean}
   */
  static isSupported() {
    return !!navigator.bluetooth;
  }

  /**
   * Check if currently connected
   * @returns {boolean}
   */
  isConnected() {
    return this.device && this.device.gatt.connected;
  }

  /**
   * Connect to a BLE device
   * @param {Function} onStatusChange - Callback for status updates
   * @returns {Promise<void>}
   */
  async connect(onStatusChange) {
    if (!BLEConnection.isSupported()) {
      throw new Error("Web Bluetooth not supported");
    }

    onStatusChange?.("Requesting device...");
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [BLEConnection.SERVICE_UUID] }],
    });

    onStatusChange?.("Connecting...");
    const server = await this.device.gatt.connect();
    const service = await server.getPrimaryService(BLEConnection.SERVICE_UUID);

    this.characteristic = await service.getCharacteristic(BLEConnection.TX_CHAR_UUID);

    await this.characteristic.startNotifications();
    this.characteristic.addEventListener("characteristicvaluechanged", this._handleNotification.bind(this));

    this.device.addEventListener("gattserverdisconnected", () => {
      this.onDisconnected?.();
    });

    onStatusChange?.("Connected");
  }

  /**
   * Disconnect from the BLE device
   */
  disconnect() {
    if (this.isConnected()) {
      this.device.gatt.disconnect();
    }
  }

  /**
   * Set callback for data received
   * @param {Function} callback - Function to call with ArrayBuffer data
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

  _handleNotification(event) {
    const buffer = event.target.value.buffer;
    this.onDataReceived?.(buffer);
  }
}

export { BLEConnection };
