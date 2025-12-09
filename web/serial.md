# Umbrella

## Serial Communication Protocol (ESP32 ↔ Web)

The ESP32 firmware communicates with the web application via USB Serial at **115200 baud**. The protocol supports three message types: thermal frames, audio packets, and button state changes.

### Message Types Overview

| Type    | Direction   | Format | Header      | Total Size |
| ------- | ----------- | ------ | ----------- | ---------- |
| Thermal | ESP32 → Web | Binary | `0xCA 0x01` | 1538 bytes |
| Audio   | ESP32 → Web | Binary | `0xCA 0x02` | 66 bytes   |
| Button  | ESP32 → Web | Text   | `btn:`      | Variable   |
| Debug   | ESP32 → Web | Text   | `debug:`    | Variable   |

---

### Binary Message Format

```
┌─────────────────────────────────────────────────────────────────┐
│                    Binary Message Structure                      │
├─────────────────────────────────────────────────────────────────┤
│  Byte 0   │  Byte 1   │  Byte 2...N                             │
│  0xCA     │  Type     │  Payload                                │
│  (marker) │           │                                         │
└─────────────────────────────────────────────────────────────────┘

Type Values:
  0x01 = Thermal frame
  0x02 = Audio packet
```

---

### Thermal Frame (0xCA 0x01)

Transmits a 32×24 thermal camera frame from the MLX90640 sensor.

**Total Size:** 1538 bytes (2 header + 1536 data)

```
┌────────┬────────┬────────────────────────────────────────────────┐
│ Byte 0 │ Byte 1 │ Bytes 2-1537                                   │
├────────┼────────┼────────────────────────────────────────────────┤
│  0xCA  │  0x01  │ 768 × uint16_t (little-endian)                 │
│        │        │ Temperature values: encoded = temp × 10        │
│        │        │ Range: 0.0°C–40.0°C → 0–400                    │
└────────┴────────┴────────────────────────────────────────────────┘

Pixel Data Layout (768 pixels = 32×24):
┌─────────────────────────────────────────────────────────────────┐
│ Pixel 0          │ Pixel 1          │ ... │ Pixel 767          │
├──────────────────┼──────────────────┼─────┼────────────────────┤
│ Low    │ High    │ Low    │ High    │     │ Low     │ High     │
│ Byte   │ Byte    │ Byte   │ Byte    │     │ Byte    │ Byte     │
└──────────────────┴──────────────────┴─────┴────────────────────┘

Decoding (JavaScript):
  const low = data[offset];
  const high = data[offset + 1];
  const encoded = low | (high << 8);
  const temperature = encoded / 10.0;  // °C
```

---

### Audio Packet (0xCA 0x02)

Transmits IMA ADPCM encoded audio sampled at 16kHz. Each packet contains 118 samples compressed to 59 bytes.

**Total Size:** 66 bytes (2 header + 64 payload)

```
┌────────┬────────┬───────────────────────────────────────────────┐
│ Byte 0 │ Byte 1 │ Bytes 2-65 (ADPCM Packet)                     │
├────────┼────────┼───────────────────────────────────────────────┤
│  0xCA  │  0x02  │ 64-byte ADPCM packet                          │
└────────┴────────┴───────────────────────────────────────────────┘

ADPCM Packet Structure (64 bytes):
┌─────────────────────────────────────────────────────────────────┐
│ Bytes 0-1 │ Bytes 2-3  │ Byte 4    │ Bytes 5-63               │
├───────────┼────────────┼───────────┼──────────────────────────┤
│ Sequence  │ Predicted  │ Step      │ ADPCM Data               │
│ Number    │ Value      │ Index     │ (59 bytes = 118 samples) │
│ uint16 LE │ int16 LE   │ uint8     │ 4-bit nibbles packed     │
└───────────┴────────────┴───────────┴──────────────────────────┘

Nibble Packing (2 samples per byte):
┌──────────────────────────────────────┐
│        Single Byte                   │
├──────────────────┬───────────────────┤
│ Bits 0-3 (Low)   │ Bits 4-7 (High)   │
│ Sample N         │ Sample N+1        │
└──────────────────┴───────────────────┘

ADPCM Header Fields:
  - Sequence Number: Packet counter for detecting drops (uint16 LE)
  - Predicted Value: Decoder state before encoding (int16 LE)
  - Step Index: ADPCM step table index before encoding (uint8, 0-88)
```

---

### Text Messages

Text messages are newline-terminated (`\n`) ASCII strings.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Text Message Format                          │
├─────────────────────────────────────────────────────────────────┤
│ prefix:value\n                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Button State (`btn:`)

Sent when touch button state changes.

```
btn:<state>\n

State values:
  0 = No buttons pressed
  1 = One button pressed
  2 = Both buttons pressed
```

#### Debug Messages (`debug:`)

Debug/log output from ESP32.

```
debug:<message>\n

Examples:
  debug:Serial-only mode started
  debug:MLX90640 OK
  debug:packets_sent_5s=675 (135 pps)
```

---

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         ESP32                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   MLX90640  │  │  PDM Mic    │  │ Touch Pads  │              │
│  │  (32×24)    │  │  (16kHz)    │  │  (D0, D1)   │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Thermal     │  │ ADPCM       │  │ Button      │              │
│  │ Encoder     │  │ Encoder     │  │ Debounce    │              │
│  │ (×10→u16)   │  │ (4-bit)     │  │             │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                     │
│         ▼                ▼                ▼                     │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Serial TX (115200 baud)            │            │
│  │         Mutex-protected for thread safety       │            │
│  └─────────────────────────┬───────────────────────┘            │
└────────────────────────────┼────────────────────────────────────┘
                             │
                     USB Serial
                             │
                             ▼
┌────────────────────────────┴────────────────────────────────────┐
│                         Web App                                 │
│  ┌─────────────────────────────────────────────────┐            │
│  │              Serial RX (Web Serial API)         │            │
│  │                  Buffer & Parse                 │            │
│  └─────────────────────────┬───────────────────────┘            │
│         ┌──────────────────┼──────────────────┐                 │
│         ▼                  ▼                  ▼                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ 0xCA 0x01   │    │ 0xCA 0x02   │    │ btn:/debug: │          │
│  │ Thermal     │    │ Audio       │    │ Text        │          │
│  │ Decoder     │    │ Decoder     │    │ Parser      │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

### Message Detection Algorithm

The web receiver uses the following logic to parse the mixed binary/text stream:

1. **Binary Detection:** Look for `0xCA` marker followed by valid type (`0x01` or `0x02`)
2. **Text Detection:** Look for printable ASCII starting with `b` (btn:) or `d` (debug:)
3. **Frame Boundaries:** Binary frames have fixed sizes; text ends with `\n`

```
Buffer Processing Loop:
┌─────────────────────────────────────────────────────────────────┐
│  1. Find message start (0xCA+type or 'b'/'d')                   │
│  2. If 0xCA 0x01: read 1538 bytes → thermal callback            │
│  3. If 0xCA 0x02: read 66 bytes → audio callback                │
│  4. If text: read until \n → parse btn:/debug:                  │
│  5. Discard unknown bytes, repeat                               │
└─────────────────────────────────────────────────────────────────┘
```
