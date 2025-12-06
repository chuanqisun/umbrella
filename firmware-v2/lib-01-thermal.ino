// Thermal sensor library for MLX90640
// Provides modular interface for thermal frame reading

#include <Wire.h>
#include <Adafruit_MLX90640.h>

// MLX90640 sensor instance
Adafruit_MLX90640 mlx;
bool mlxReady = false;

// Thermal frame buffer (768 pixels = 32x24)
const int thermalFrameSize = 32 * 24;
float thermalFrame[32 * 24];

// Serial output buffer to avoid interleaved output with other tasks
// Format: "data:X," + 768 values * ~6 chars each (e.g., "25.3,") + newline
// Estimated max: 7 + 768*7 = ~5400 chars, allocate 6000 to be safe
const int serialBufferSize = 6000;
char serialBuffer[serialBufferSize];

// Initialize MLX90640 thermal sensor
// Returns true if initialization successful
bool thermalInit() {
  // I2C for MLX90640
  Wire.begin();              // XIAO default SDA=D4, SCL=D5
  Wire.setClock(800000);     // I2C 800kHz for better frame rate

  if (!mlx.begin(0x33, &Wire)) {
    Serial.println("debug:ERR MLX90640 not found at 0x33");
    mlxReady = false;
    return false;
  }
  
  Serial.println("debug:MLX90640 OK");
  mlx.setMode(MLX90640_CHESS);
  mlx.setResolution(MLX90640_ADC_18BIT);
  // https://github.com/adafruit/Adafruit_MLX90640/blob/master/Adafruit_MLX90640.h
  mlx.setRefreshRate(MLX90640_32_HZ);
  mlxReady = true;
  return true;
}

// Check if thermal sensor is ready
bool thermalIsReady() {
  return mlxReady;
}

// Get thermal frame size (number of pixels)
int thermalGetFrameSize() {
  return thermalFrameSize;
}


// Read a new thermal frame
// Returns true if frame read successful
bool thermalReadFrame() {
  if (!mlxReady) {
    return false;
  }
  return (mlx.getFrame(thermalFrame) == 0);
}

// Get pointer to thermal frame data
float* thermalGetFrameData() {
  return thermalFrame;
}

// Send thermal frame over serial with button state prefix
// Format: data:<buttonCount>,t0,t1,...,t767
// Uses pre-built buffer to avoid interleaved output with other tasks
void thermalSendFrame(int buttonState) {
  if (!mlxReady) {
    return;
  }
  
  // Build entire output string in buffer first
  int pos = 0;
  pos += snprintf(serialBuffer + pos, serialBufferSize - pos, "data:%d", buttonState);

  for (int i = 0; i < thermalFrameSize; i++) {
    pos += snprintf(serialBuffer + pos, serialBufferSize - pos, ",%.1f", thermalFrame[i]);
  }
  
  // Send entire frame atomically with println
  Serial.println(serialBuffer);
}
