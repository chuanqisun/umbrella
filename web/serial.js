// Web Serial API module for ESP32 communication
// Handles multiple message types: button (text), thermal (binary), audio (binary)

let port = null;
let reader = null;
let readableStreamClosed = null;

// Callbacks for different data types
let thermalDataCallback = null;
let buttonDataCallback = null;
let audioDataCallback = null;

// Binary protocol constants
// Thermal: 0xCA 0x01 + 768*2 bytes = 1538 bytes total
// Audio:   0xCA 0x02 + 64 bytes = 66 bytes total
const HEADER_MARKER = 0xca;
const THERMAL_TYPE = 0x01;
const AUDIO_TYPE = 0x02;
const THERMAL_FRAME_SIZE = 1538; // 2 (header) + 768*2 (thermal)
const AUDIO_FRAME_SIZE = 66; // 2 (header) + 64 (ADPCM packet)
const THERMAL_PIXEL_COUNT = 768;

// Buffer for accumulating incoming data
let dataBuffer = new Uint8Array(0);

export function setThermalDataCallback(callback) {
  thermalDataCallback = callback;
}

export function setButtonDataCallback(callback) {
  buttonDataCallback = callback;
}

export function setAudioDataCallback(callback) {
  audioDataCallback = callback;
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

    // Reset buffer
    dataBuffer = new Uint8Array(0);

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
 * Try to parse a text line from the buffer
 * Returns { line, consumed } if a complete line is found, null otherwise
 */
function tryParseTextLine(buffer) {
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0x0a) {
      // Found newline
      const lineBytes = buffer.slice(0, i);
      const decoder = new TextDecoder();
      const line = decoder.decode(lineBytes).trim();
      return { line, consumed: i + 1 };
    }
  }
  return null;
}

/**
 * Find the next message boundary in the buffer
 * Returns the index of a valid message start, or -1 if none found
 */
function findMessageStart(buffer) {
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i];

    // Check for binary header marker (0xCA)
    if (byte === HEADER_MARKER && i + 1 < buffer.length) {
      const type = buffer[i + 1];
      if (type === THERMAL_TYPE || type === AUDIO_TYPE) {
        return i;
      }
    }

    // Check for text message starts
    // 'b' for "btn:", 'd' for "debug:"
    if (byte === 0x62 || byte === 0x64) {
      // 'b' or 'd'
      return i;
    }
  }
  return -1;
}

/**
 * Parse thermal binary frame
 * Format: Header (0xCA 0x01) + Thermal data (768 * uint16_t little-endian)
 */
function parseThermalFrame(frameData) {
  const thermalData = new Array(THERMAL_PIXEL_COUNT);
  for (let i = 0; i < THERMAL_PIXEL_COUNT; i++) {
    const offset = 2 + i * 2; // Skip 2-byte header
    const low = frameData[offset];
    const high = frameData[offset + 1];
    const encoded = low | (high << 8);
    thermalData[i] = encoded / 10.0; // Convert back to float
  }

  if (thermalDataCallback) {
    thermalDataCallback(thermalData);
  }
}

/**
 * Parse audio binary frame
 * Format: Header (0xCA 0x02) + ADPCM packet (64 bytes)
 * Returns the ADPCM packet as ArrayBuffer (without the 2-byte protocol header)
 */
function parseAudioFrame(frameData) {
  // Extract the 64-byte ADPCM packet (skip 2-byte protocol header)
  const adpcmPacket = frameData.slice(2, 66);

  if (audioDataCallback) {
    audioDataCallback(adpcmPacket.buffer);
  }
}

/**
 * Process text messages (button state, debug)
 */
function processTextLine(line) {
  if (line.startsWith("btn:")) {
    const state = parseInt(line.substring(4), 10);
    if (buttonDataCallback && !isNaN(state)) {
      buttonDataCallback(state);
    }
  } else if (line.startsWith("debug:")) {
    console.log("[ESP32]", line.substring(6));
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
          dataBuffer = concatUint8Arrays(dataBuffer, value);

          // Process messages from buffer
          processBuffer();
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

/**
 * Process all complete messages in the buffer
 */
function processBuffer() {
  while (dataBuffer.length > 0) {
    const startIdx = findMessageStart(dataBuffer);

    if (startIdx === -1) {
      // No valid message start found, keep last few bytes for potential partial header
      if (dataBuffer.length > 10) {
        dataBuffer = dataBuffer.slice(-10);
      }
      break;
    }

    // Discard any garbage before the message start
    if (startIdx > 0) {
      dataBuffer = dataBuffer.slice(startIdx);
    }

    const firstByte = dataBuffer[0];

    // Handle binary messages (0xCA header)
    if (firstByte === HEADER_MARKER && dataBuffer.length >= 2) {
      const type = dataBuffer[1];

      if (type === THERMAL_TYPE) {
        if (dataBuffer.length < THERMAL_FRAME_SIZE) {
          break; // Wait for more data
        }
        const frameData = dataBuffer.slice(0, THERMAL_FRAME_SIZE);
        dataBuffer = dataBuffer.slice(THERMAL_FRAME_SIZE);
        parseThermalFrame(frameData);
        continue;
      }

      if (type === AUDIO_TYPE) {
        if (dataBuffer.length < AUDIO_FRAME_SIZE) {
          break; // Wait for more data
        }
        const frameData = dataBuffer.slice(0, AUDIO_FRAME_SIZE);
        dataBuffer = dataBuffer.slice(AUDIO_FRAME_SIZE);
        parseAudioFrame(frameData);
        continue;
      }

      // Unknown binary type, skip the header marker
      dataBuffer = dataBuffer.slice(1);
      continue;
    }

    // Handle text messages (btn:, debug:)
    const textResult = tryParseTextLine(dataBuffer);
    if (textResult) {
      dataBuffer = dataBuffer.slice(textResult.consumed);
      processTextLine(textResult.line);
      continue;
    }

    // No complete message yet, check if buffer is getting too large
    if (dataBuffer.length > 5000) {
      // Buffer overflow protection - discard old data
      console.warn("Serial buffer overflow, discarding data");
      dataBuffer = dataBuffer.slice(-1000);
    }
    break;
  }
}

export function isConnected() {
  return port !== null;
}
