#include <ESP_I2S.h>

// External thermal sensor functions (defined in lib-01-thermal.ino)
extern bool thermalInit();
extern bool thermalIsReady();
extern int thermalGetFrameSize();
extern int thermalGetFPS();
extern bool thermalReadFrame();
extern float* thermalGetFrameData();
extern void thermalSendFrame();

// External audio functions (defined in lib-02-audio.ino)
extern void audioResetState();
extern bool audioProcessSample(int16_t sample);
extern void audioPrintDebugStats(unsigned long intervalMs);

// External button functions (defined in lib-03-button.ino)
extern void buttonInit();
extern int buttonRead();
extern void buttonSendState(int state);

I2SClass I2S;

// Serial mutex for thread-safe writes from multiple cores
SemaphoreHandle_t serialMutex = NULL;

// Task handles
TaskHandle_t thermalTaskHandle = NULL;
TaskHandle_t audioTaskHandle = NULL;

// Thermal task runs on Core 0 
void thermalTask(void *pvParameters) {
  for (;;) {
    if (thermalIsReady()) {
      if (thermalReadFrame()) {
        thermalSendFrame();
      }
    }
  }
}

// Audio task runs on Core 1 (time-critical, 16kHz sampling)
void audioTask(void *pvParameters) {
  for (;;) {
    if (I2S.available()) {
      int32_t sample = I2S.read();
      audioProcessSample((int16_t)sample);
    }
  }
}

// Serial write helper with mutex protection
void serialWriteProtected(const uint8_t* data, size_t len) {
  if (xSemaphoreTake(serialMutex, portMAX_DELAY) == pdTRUE) {
    Serial.write(data, len);
    xSemaphoreGive(serialMutex);
  }
}

void serialPrintlnProtected(const char* msg) {
  if (xSemaphoreTake(serialMutex, portMAX_DELAY) == pdTRUE) {
    Serial.println(msg);
    xSemaphoreGive(serialMutex);
  }
}

void setup() {
  Serial.begin(115200);
  
  // Create serial mutex for thread-safe writes
  serialMutex = xSemaphoreCreateMutex();
  if (serialMutex == NULL) {
    Serial.println("debug:Failed to create serial mutex!");
    while(1);
  }

  Serial.println("debug:Serial-only mode started");

  // Initialize thermal sensor
  thermalInit();

  // Initialize touch buttons
  buttonInit();

  // ESP32 S3 built-in pins
  // setup 42 PDM clock and 41 PDM data pins
  I2S.setPinsPdmRx(42, 41);

  // start I2S at 16 kHz with 16-bits per sample
  if (!I2S.begin(I2S_MODE_PDM_RX, 16000, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO)) {
    Serial.println("debug:Failed to initialize I2S!");
    while (1); // do nothing
  }

  // Create thermal task on Core 0 (lower priority, ~32 fps)
  xTaskCreatePinnedToCore(
    thermalTask,          // Task function
    "ThermalTask",        // Task name
    4096,                 // Stack size (bytes)
    NULL,                 // Parameters
    1,                    // Priority (1 = low)
    &thermalTaskHandle,   // Task handle
    0                     // Core 0
  );

  // Create audio task on Core 1 (high priority, time-critical 16kHz)
  xTaskCreatePinnedToCore(
    audioTask,            // Task function
    "AudioTask",          // Task name
    4096,                 // Stack size (bytes)
    NULL,                 // Parameters
    2,                    // Priority (2 = higher than thermal)
    &audioTaskHandle,     // Task handle
    1                     // Core 1
  );
}

// Track button state for change detection
int lastButtonState = -1;

void loop() {
  // Read and send button state on change (runs on main loop, Core 1)
  int buttonState = buttonRead();
  if (buttonState != lastButtonState) {
    buttonSendState(buttonState);
    lastButtonState = buttonState;
  }

  // Debug output: packets per second (should be ~135 for 16kHz / 118 samples)
  audioPrintDebugStats(5000);

  // Main loop can handle other lightweight tasks
  vTaskDelay(10 / portTICK_PERIOD_MS);
}