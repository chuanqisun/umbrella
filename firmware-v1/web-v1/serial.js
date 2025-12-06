// Web Serial API module for ESP32 communication

let port = null;
let reader = null;
let readableStreamClosed = null;
let thermalDataCallback = null;
let buttonDataCallback = null;
let lineBuffer = "";

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

    console.log("Serial port disconnected");
    return true;
  } catch (error) {
    console.error("Serial disconnection failed:", error);
    return false;
  }
}

async function readSerialData() {
  const decoder = new TextDecoder();

  while (port && port.readable) {
    reader = port.readable.getReader();
    readableStreamClosed = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }

          // Decode bytes to string and add to buffer
          lineBuffer += decoder.decode(value, { stream: true });

          // Process complete lines
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop(); // Keep incomplete line in buffer

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("data:")) {
              const dataStr = trimmedLine.substring(5); // Remove "data:" prefix
              const values = dataStr.split(",").map(Number);

              // First value is button state, rest is thermal data
              // Format: data:<button_state>,<heat_sensor_data_1>,...,<heat_sensor_data_768>
              if (values.length > 1) {
                const buttonState = values[0];
                const thermalData = values.slice(1);

                if (buttonDataCallback) {
                  buttonDataCallback(buttonState);
                }
                if (thermalDataCallback && thermalData.length > 0) {
                  thermalDataCallback(thermalData);
                }
              }
            } else if (trimmedLine.startsWith("debug:")) {
              console.log("[ESP32]", trimmedLine.substring(6));
            }
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
