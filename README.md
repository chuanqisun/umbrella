# You San technical design

## Hardware

- A store bought umbrella, with handle removed
- PLA 3D printed umbrella handle as electronics housing
- A PC for running the demo program
- ESP32 S3 Sense as microcontroller and microphone, connected to PC via USB cable
- A portable projector, modifiied with 205 deg fish eye lens for wide, short-throw projection, connected to PC via HDMI cable
- Two copper tape rings as capacitive touch sensors
- Adafruit_MLX90640 thermal camera for human presence capture

## Software

- Utililize duo-core ESP32 S3 for parallel processing of audio and thermal input. Necessary to prevent starvation of audio processing when thermal camera is active.
- Single wire with custom binary protocol to transimit audio, video, touch, and debug info from ESP32 S3 to PC.
- Audio is ADPCM encoded to conserve bandwidth
- Thermal data is 32x24 image, 16-bit per pixel, encoded as uint16 array to conserve bandwidth
- PC program decodes and stores audio samples, video frames for replay
- Post processing adds fade in/out visual effect
- Interfaction tracked by a state machine
- Custom web UI for monitoring, debugging, and parameter tuning
