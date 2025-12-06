Reference implementation for sending button state and thermal sensor data via Serial.

```cpp
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#include <Wire.h>
#include <Adafruit_MLX90640.h>

// ==================== BLE PART (Placeholder) ====================

// Nordic UART Service UUIDs
#define UART_SERVICE_UUID "6e400001-b5a3-f393-e0a9-e50e24dcca9e"
#define UART_TX_UUID      "6e400003-b5a3-f393-e0a9-e50e24dcca9e"  // notify: ESP32 -> browser

BLEServer* pServer = NULL;
BLECharacteristic* pTxCharacteristic = NULL;
bool deviceConnected = false;
bool oldDeviceConnected = false;

// ==================== HEAT SENSOR + BUTTON PART ====================

// Touch pins (copper pads)
#define TOUCH_PIN1  1   // GPIO1 -> XIAO D0
#define TOUCH_PIN2  2   // GPIO2 -> XIAO D1

int touchThreshold1 = 0;
int touchThreshold2 = 0;

// MLX90640
Adafruit_MLX90640 mlx;
bool mlxReady = false;
float mlxFrame[32 * 24];   // 768 pixels (°C)

// Control thermal frame serial transmission frequency (in ms)
const unsigned long FRAME_INTERVAL_MS = 1000;  // ~1 FPS
unsigned long lastFrameTime = 0;

// ---------------- BLE Callbacks ----------------
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

// ==================== Touch Calibration ====================
void calibrateTouchButtons() {
  long sum1 = 0, sum2 = 0;
  const int N = 40;

  for (int i = 0; i < N; i++) {
    sum1 += touchRead(TOUCH_PIN1);
    sum2 += touchRead(TOUCH_PIN2);
    delay(20);
  }

  int base1 = sum1 / N;
  int base2 = sum2 / N;

  // Threshold = base * 0.7; value > threshold is considered TOUCH
  touchThreshold1 = base1 * 0.7;
  touchThreshold2 = base2 * 0.7;

  Serial.print("BASE1 "); Serial.println(base1);
  Serial.print("BASE2 "); Serial.println(base2);
  Serial.print("TH1 ");   Serial.println(touchThreshold1);
  Serial.print("TH2 ");   Serial.println(touchThreshold2);
}

// ==================== Heat + Buttons Initialization ====================
void initHeatAndButtons() {
  Serial.println("debug:Calibrating touch buttons, please release both copper pads...");
  calibrateTouchButtons();
  Serial.println("debug:Touch calibration done.");

  // I2C for MLX90640
  Wire.begin();              // XIAO default SDA=D4, SCL=D5
  Wire.setClock(800000);     // I2C 800kHz for better frame rate

  if (!mlx.begin(0x33, &Wire)) {
    Serial.println("debug:ERR MLX90640 not found at 0x33");
    mlxReady = false;
  } else {
    Serial.println("debug:MLX90640 OK");
    mlx.setMode(MLX90640_CHESS);
    mlx.setResolution(MLX90640_ADC_18BIT);
    // Set MLX refresh rate to 1 Hz (or the lowest available rate that is <= 1 FPS)
    // MLX90640_1_HZ is the lowest standard rate.
    mlx.setRefreshRate(MLX90640_1_HZ);
    mlxReady = true;
  }
}

// ==================== setup ====================
void setup() {
  Serial.begin(115200);  // Serial baud rate

  // --- Initialize BLE ---
  BLEDevice::init("YUSAN");
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

  // --- Initialize Thermal Sensor + Buttons ---
  initHeatAndButtons();
}

// ==================== loop ====================
void loop() {
  // -------- BLE Reconnection Handling --------
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("debug:Restarting advertising");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // -------- Button State (Touch Pads) --------
  int v1 = touchRead(TOUCH_PIN1);
  int v2 = touchRead(TOUCH_PIN2);

  bool b1 = (v1 > touchThreshold1);  // D0 touched?
  bool b2 = (v2 > touchThreshold2);  // D1 touched?

  int btnCount = (b1 ? 1 : 0) + (b2 ? 1 : 0);   // 0 / 1 / 2

  // -------- Thermal Frame Transmission (Serial data:<btn>,...) --------
  unsigned long currentTime = millis();
  if (mlxReady && (currentTime - lastFrameTime >= FRAME_INTERVAL_MS)) {
    lastFrameTime = currentTime;

    if (mlx.getFrame(mlxFrame) == 0) {
      // One line per frame, format:
      // data:<buttonCount>,t0,t1,...,t767
      Serial.print("data:");
      Serial.print(btnCount);
      Serial.print(',');

      for (int i = 0; i < 32 * 24; i++) {
        Serial.print(mlxFrame[i], 1);  // One decimal place
        if (i < 32 * 24 - 1) {
          Serial.print(',');
        }
      }
      Serial.println();
    } else {
      // Optional debug output
      // Serial.println("debug:MLX frame read error");
    }
  }
}
```
