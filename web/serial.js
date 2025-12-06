// Web Serial API module for ESP32 communication

let port = null;
let reader = null;
let readableStreamClosed = null;
let thermalDataCallback = null;
let buttonDataCallback = null;

// Binary protocol constants
const BINARY_HEADER = new Uint8Array([0xaa, 0x55]);
const BINARY_FRAME_SIZE = 1539; // 2 (header) + 1 (button) + 768*2 (thermal)
const THERMAL_FRAME_SIZE = 768;

// Binary buffer for accumulating incoming data
let binaryBuffer = new Uint8Array(0);

export function setThermalDataCallback(callback) {
  thermalDataCallback = callback;
}

export function setButtonDataCallback(callback) {
  buttonDataCallback = callback;
}

export async function connectSerial() {
  try {
    // Request a port and open a connection
    port = await navigator.serial.requestPort();
    await port.open({ baudRate: 115200 });

    console.log("Serial port connected");

    // Start reading from the serial port
    readSerialData();

    return true;
  } catch (error) {
    console.error("Serial connection failed:", error);
    return false;
  }
}

export async function disconnectSerial() {
  try {
    if (reader) {
      await reader.cancel();
      await readableStreamClosed.catch(() => {}); // Ignore the error from cancellation
      reader = null;
      readableStreamClosed = null;
    }

    if (port) {
      await port.close();
      port = null;
    }

    // Reset binary buffer
    binaryBuffer = new Uint8Array(0);

    console.log("Serial port disconnected");
    return true;
  } catch (error) {
    console.error("Serial disconnection failed:", error);
    return false;
  }
}

/**
 * Concatenate two Uint8Arrays
 */
function concatUint8Arrays(a, b) {
  const result = new Uint8Array(a.length + b.length);
  result.set(a, 0);
  result.set(b, a.length);
  return result;
}

/**
 * Find the index of the binary header in the buffer
 */
function findHeader(buffer) {
  for (let i = 0; i <= buffer.length - 2; i++) {
    if (buffer[i] === BINARY_HEADER[0] && buffer[i + 1] === BINARY_HEADER[1]) {
      return i;
    }
  }
  return -1;
}

/**
 * Parse a complete binary frame and dispatch callbacks
 * Frame format: Header (2) + Button (1) + Thermal (768*2)
 */
function parseBinaryFrame(frameData) {
  // Skip header (2 bytes)
  const buttonState = frameData[2];

  // Parse thermal data (uint16_t little-endian, value/10 = temperature)
  const thermalData = new Array(THERMAL_FRAME_SIZE);
  for (let i = 0; i < THERMAL_FRAME_SIZE; i++) {
    const offset = 3 + i * 2;
    const low = frameData[offset];
    const high = frameData[offset + 1];
    const encoded = low | (high << 8);
    thermalData[i] = encoded / 10.0; // Convert back to float
  }

  if (buttonDataCallback) {
    buttonDataCallback(buttonState);
  }
  if (thermalDataCallback) {
    thermalDataCallback(thermalData);
  }
}

async function readSerialData() {
  while (port && port.readable) {
    reader = port.readable.getReader();
    readableStreamClosed = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          // Append incoming bytes to buffer
          binaryBuffer = concatUint8Arrays(binaryBuffer, value);

          // Process complete frames
          while (true) {
            // Find header
            const headerIndex = findHeader(binaryBuffer);
            if (headerIndex === -1) {
              // No header found, keep last byte in case it's start of header
              if (binaryBuffer.length > 1) {
                binaryBuffer = binaryBuffer.slice(-1);
              }
              break;
            }

            // Discard any bytes before the header
            if (headerIndex > 0) {
              binaryBuffer = binaryBuffer.slice(headerIndex);
            }

            // Check if we have a complete frame
            if (binaryBuffer.length < BINARY_FRAME_SIZE) {
              break; // Wait for more data
            }

            // Extract and parse the frame
            const frameData = binaryBuffer.slice(0, BINARY_FRAME_SIZE);
            binaryBuffer = binaryBuffer.slice(BINARY_FRAME_SIZE);

            parseBinaryFrame(frameData);
          }
        }
      } catch (error) {
        if (error.name !== "CanceledError") {
          console.error("Serial read error:", error);
        }
      } finally {
        reader.releaseLock();
      }
    })();

    await readableStreamClosed;
  }
}

export function isConnected() {
  return port !== null;
}
