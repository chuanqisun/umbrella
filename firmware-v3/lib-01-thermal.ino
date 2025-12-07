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

// Binary serial output buffer
// Protocol: Header (0xCA 0x01) + Thermal data (768 * 2 bytes)
// Total: 2 + 1536 = 1538 bytes
const uint8_t THERMAL_HEADER[2] = {0xCA, 0x01};
const int thermalBinaryBufferSize = 1538;
uint8_t thermalBinaryBuffer[thermalBinaryBufferSize];

// External serial write function with mutex protection
extern void serialWriteProtected(const uint8_t* data, size_t len);

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

// Send thermal frame over serial as binary data
// Protocol: Header (0xCA 0x01) + Thermal data (768 * uint16_t)
// Temperature is encoded as uint16_t: value = temp * 10 (0.0-40.0 -> 0-400)
// Uses mutex-protected write for thread safety
void thermalSendFrame() {
  if (!mlxReady) {
    return;
  }
  
  // Build binary buffer
  int pos = 0;
  
  // Header bytes (0xCA = 'cam' marker, 0x01 = thermal type)
  thermalBinaryBuffer[pos++] = THERMAL_HEADER[0];
  thermalBinaryBuffer[pos++] = THERMAL_HEADER[1];
  
  // Thermal data as uint16_t little-endian
  for (int i = 0; i < thermalFrameSize; i++) {
    // Clamp to 0.0-40.0 range and convert to uint16_t (value * 10)
    float temp = thermalFrame[i];
    if (temp < 0.0f) temp = 0.0f;
    if (temp > 40.0f) temp = 40.0f;
    uint16_t encoded = (uint16_t)(temp * 10.0f + 0.5f); // Round to nearest
    
    // Little-endian: low byte first
    thermalBinaryBuffer[pos++] = encoded & 0xFF;
    thermalBinaryBuffer[pos++] = (encoded >> 8) & 0xFF;
  }
  
  // Send entire frame atomically with mutex protection
  serialWriteProtected(thermalBinaryBuffer, thermalBinaryBufferSize);
}
