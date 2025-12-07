// Touch button library for capacitive touch pads
// Provides modular interface for touch button reading

// Touch pins (copper pads)
#define TOUCH_PIN1  1   // GPIO1 -> XIAO D0
#define TOUCH_PIN2  2   // GPIO2 -> XIAO D1

// Touch thresholds (calibrated at startup)
int touchThreshold1 = 0;
int touchThreshold2 = 0;

// External serial write function with mutex protection
extern void serialPrintlnProtected(const char* msg);

// Send button state over serial
// Format: "btn:<state>" where state is 0, 1, or 2
void buttonSendState(int state) {
  char msg[16];
  snprintf(msg, sizeof(msg), "btn:%d", state);
  serialPrintlnProtected(msg);
}

// Calibrate touch buttons by measuring baseline values
// Should be called at startup with buttons NOT pressed
void buttonCalibrate() {
  Serial.println("debug:Calibrating touch buttons, please release both copper pads...");
  
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

  Serial.print("debug:BASE1 "); Serial.println(base1);
  Serial.print("debug:BASE2 "); Serial.println(base2);
  Serial.print("debug:TH1 ");   Serial.println(touchThreshold1);
  Serial.print("debug:TH2 ");   Serial.println(touchThreshold2);
  Serial.println("debug:Touch calibration done.");
}

// Initialize touch buttons (calls calibration)
void buttonInit() {
  buttonCalibrate();
}

// Read current button state
// Returns count of buttons pressed (0, 1, or 2)
int buttonRead() {
  int v1 = touchRead(TOUCH_PIN1);
  int v2 = touchRead(TOUCH_PIN2);

  bool b1 = (v1 > touchThreshold1);  // D0 touched?
  bool b2 = (v2 > touchThreshold2);  // D1 touched?

  return (b1 ? 1 : 0) + (b2 ? 1 : 0);  // 0 / 1 / 2
}

// Check if button 1 (D0) is pressed
bool buttonIsPressed1() {
  return (touchRead(TOUCH_PIN1) > touchThreshold1);
}

// Check if button 2 (D1) is pressed
bool buttonIsPressed2() {
  return (touchRead(TOUCH_PIN2) > touchThreshold2);
}
