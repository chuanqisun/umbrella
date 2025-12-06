# Communication protocol

## BLE

ESP32 should transmit I2S audio data via BLE

## Serial

ESP32 should continous transmit both button state and heat sensor data.

One each line, the data is prefixed with `data:`, followed by number of button pressed, and heat sensor data.

One frame (32 \* 24 = 768 numbers) per line, comma separated.

Format: `data:<button_state>,<heat_sensor_data_1>,<heat_sensor_data_2>,...,<heat_sensor_data_768>`

Where `<button_state>` is an integer representing the state of buttons (e.g., 0 for no button pressed, 1 for button 1 pressed, etc.), and `<heat_sensor_data_n>` is the heat sensor reading at position n.

Examples

```
data:0,25.9,26.1,25.8,26.0,...,25.7
```
