#include <ESP_I2S.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// External thermal sensor functions (defined in lib-01-thermal.ino)
extern bool thermalInit();
extern bool thermalIsReady();
extern int thermalGetFrameSize();
extern int thermalGetFPS();
extern bool thermalReadFrame();
extern float* thermalGetFrameData();
extern void thermalSendFrame(int buttonState);

// External audio functions (defined in lib-02-audio.ino)
extern void audioResetState();
extern bool audioProcessSample(int16_t sample, BLECharacteristic* pCharacteristic);
extern void audioPrintDebugStats(unsigned long intervalMs);

// External button functions (defined in lib-03-button.ino)
extern void buttonInit();
extern int buttonRead();

// Nordic UART Service UUIDs
#define UART_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UART_TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // notify: ESP32 -> browser

I2SClass I2S;

BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Task handles
TaskHandle_t thermalTaskHandle = NULL;
TaskHandle_t audioTaskHandle = NULL;

// Thermal task runs on Core 0 
void thermalTask(void *pvParameters) {
  for (;;) {
    if (thermalIsReady()) {
      if (thermalReadFrame()) {
        int buttonState = buttonRead();
        thermalSendFrame(buttonState);
      }
    }
  }
}

// Audio task runs on Core 1 (time-critical, 16kHz sampling)
void audioTask(void *pvParameters) {
  for (;;) {
    if (I2S.available()) {
      int32_t sample = I2S.read();
      if (deviceConnected) {
        audioProcessSample((int16_t)sample, pTxCharacteristic);
      }
    }
  }
}

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
        deviceConnected = true;
        Serial.println("debug:Client connected");
    }

    void onDisconnect(BLEServer* pServer) {
        deviceConnected = false;
        Serial.println("debug:Client disconnected");
    }
};

void setup() {
  Serial.begin(115200);

  // Initialize BLE
  BLEDevice::init("YANGSAN");
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService* pService = pServer->createService(UART_SERVICE_UUID);

  pTxCharacteristic = pService->createCharacteristic(
      UART_TX_UUID,
      BLECharacteristic::PROPERTY_NOTIFY
  );
  pTxCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(UART_SERVICE_UUID);
  pAdvertising->setScanResponse(false);
  pAdvertising->setMinPreferred(0x0);
  BLEDevice::startAdvertising();

  Serial.println("debug:BLE advertising started");

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

  // Create thermal task on Core 0 (lower priority, 1 fps)
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

void loop() {
  // Handle reconnection
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("debug:Restarting advertising");
    oldDeviceConnected = deviceConnected;
    // Reset audio encoder state on disconnect
    audioResetState();
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // Debug output: packets per second (should be ~135 for 16kHz / 118 samples)
  if (deviceConnected) {
    audioPrintDebugStats(5000);
  }

  // Main loop can handle other lightweight tasks
  vTaskDelay(10 / portTICK_PERIOD_MS);
}