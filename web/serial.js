// Web Serial API module for ESP32 communication

let port = null;
let reader = null;
let readableStreamClosed = null;

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
  while (port && port.readable) {
    reader = port.readable.getReader();
    readableStreamClosed = (async () => {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          // Log only the message length, not the content
          console.log("Serial message received, length:", value.length);
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
