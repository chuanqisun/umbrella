# Communication protocol

## BLE

ESP32 should transmit I2S audio data via BLE

## Serial

### Heat sensor data

ESP32 should continous transmit heat sensor data.
One frame (32 \* 24 = 768 numbers) per line, comma separated.

Examples

```
data:
```

### Button stats

ESP32 should transmit the number of buttons being pressed.

Examples:

```
btn:0
btn:1
btn:2
```
