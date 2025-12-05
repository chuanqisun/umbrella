#include <ESP_I2S.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// Nordic UART Service UUIDs
#define UART_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UART_TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // notify: ESP32 -> browser

I2SClass I2S;

BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// Binary buffer for BLE transmission (16-bit samples)
const size_t BUFFER_SIZE = 64; // bytes
uint8_t txBuffer[BUFFER_SIZE];
size_t bufferIndex = 0;

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
  BLEDevice::init("ESP32-Audio");
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
    bufferIndex = 0;  // Reset buffer on disconnect
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // read a sample
  int sample = I2S.read();

  if (sample && sample != -1 && sample != 1) {
    if (deviceConnected) {
      // Store 16-bit sample as two bytes (little-endian)
      int16_t s = (int16_t)sample;
      txBuffer[bufferIndex++] = s & 0xFF;         // Low byte
      txBuffer[bufferIndex++] = (s >> 8) & 0xFF;  // High byte

      // Send when buffer is full
      if (bufferIndex >= BUFFER_SIZE) {
        pTxCharacteristic->setValue(txBuffer, BUFFER_SIZE);
        pTxCharacteristic->notify();
        bufferIndex = 0;
      }
    }
  }
}