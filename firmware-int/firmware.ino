#include <ESP_I2S.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// External mock data declarations (defined in lib-01-mock-data.ino)
extern const int mockDataFrameSize;
extern const int mockDataFrameCount;
extern float mockData[];

// External audio functions (defined in lib-02-audio.ino)
extern void audioResetState();
extern bool audioProcessSample(int16_t sample, BLECharacteristic* pCharacteristic);
extern void audioPrintDebugStats(unsigned long intervalMs);

// Nordic UART Service UUIDs
#define UART_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UART_TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // notify: ESP32 -> browser

I2SClass I2S;

BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Mock data streaming state
int currentMockFrame = 0;
int currentSampleInFrame = 0;
unsigned long lastFrameTime = 0;
const unsigned long FRAME_INTERVAL_MS = 1000; // 1 fps

// Mock button state (cycles 0-3)
int mockButtonState = 0;

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

  // ESP32 S3 built-in pins
  // setup 42 PDM clock and 41 PDM data pins
  I2S.setPinsPdmRx(42, 41);

  // start I2S at 16 kHz with 16-bits per sample
  if (!I2S.begin(I2S_MODE_PDM_RX, 16000, I2S_DATA_BIT_WIDTH_16BIT, I2S_SLOT_MODE_MONO)) {
    Serial.println("debug:Failed to initialize I2S!");
    while (1); // do nothing
  }
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

  // Send mock data over serial at ~1 fps
  unsigned long currentTime = millis();
  if (currentTime - lastFrameTime >= FRAME_INTERVAL_MS) {
    lastFrameTime = currentTime;
    // Send frame data with "data:" prefix
    // Format: data:<button_state>,<heat_sensor_data_1>,...,<heat_sensor_data_768>
    Serial.print("data:");
    Serial.print(mockButtonState);
    Serial.print(",");
    int frameStart = currentMockFrame * mockDataFrameSize;
    for (int i = 0; i < mockDataFrameSize; i++) {
      Serial.print(mockData[frameStart + i], 2);
      if (i < mockDataFrameSize - 1) {
        Serial.print(",");
      }
    }
    Serial.println();
    
    // Move to next frame, loop around
    currentMockFrame = (currentMockFrame + 1) % mockDataFrameCount;
    
    // Cycle mock button state (0-3)
    mockButtonState = (mockButtonState + 1) % 3;
  }

  // read a sample
  int sample = I2S.read();

  if (sample && sample != -1 && sample != 1) {
    if (deviceConnected) {
      audioProcessSample((int16_t)sample, pTxCharacteristic);
    }
  }
  
  // Debug output: packets per second (should be ~135 for 16kHz / 118 samples)
  if (deviceConnected) {
    audioPrintDebugStats(5000);
  }
}