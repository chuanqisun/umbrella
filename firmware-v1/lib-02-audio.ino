// lib-02-audio.ino
// IMA ADPCM audio encoding for BLE transmission

// IMA ADPCM step size table
const int16_t adpcmStepTable[89] = {
    7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31,
    34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118, 130,
    143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449,
    494, 544, 598, 658, 724, 796, 876, 963, 1060, 1166, 1282, 1411,
    1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026,
    4428, 4871, 5358, 5894, 6484, 7132, 7845, 8630, 9493, 10442, 11487,
    12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767
};

// IMA ADPCM index adjustment table
const int8_t adpcmIndexTable[16] = {
    -1, -1, -1, -1, 2, 4, 6, 8,
    -1, -1, -1, -1, 2, 4, 6, 8
};

// ADPCM encoder state
int16_t adpcmPredicted = 0;
int8_t adpcmIndex = 0;

// Packet structure constants
// [0-1]: sequence number (uint16, little-endian)
// [2-3]: ADPCM state BEFORE encoding: predicted value (int16, little-endian)
// [4]:   ADPCM state BEFORE encoding: step index (uint8)
// [5-63]: ADPCM data (59 bytes = 118 samples as 4-bit nibbles)
const size_t AUDIO_HEADER_SIZE = 5;
const size_t AUDIO_ADPCM_DATA_SIZE = 59;  // 118 samples packed as nibbles
const size_t AUDIO_BUFFER_SIZE = AUDIO_HEADER_SIZE + AUDIO_ADPCM_DATA_SIZE;  // 64 bytes
const size_t AUDIO_SAMPLES_PER_PACKET = 118;

// Audio transmission state
uint8_t audioTxBuffer[AUDIO_BUFFER_SIZE];
size_t audioSampleIndex = 0;  // Count of ADPCM bytes (2 samples per byte)
uint16_t audioSequenceNumber = 0;
uint8_t audioCurrentByte = 0;  // Holds nibbles being packed
bool audioHighNibble = false;  // Toggle for packing nibbles

// Store ADPCM state at start of packet for decoder sync
int16_t audioPacketStartPredicted = 0;
int8_t audioPacketStartIndex = 0;

// Debug: packet counter for monitoring
unsigned long audioLastDebugTime = 0;
uint32_t audioPacketsSentSinceLastDebug = 0;

/**
 * Encode a single 16-bit sample to 4-bit ADPCM nibble
 */
uint8_t encodeADPCMSample(int16_t sample) {
    int16_t step = adpcmStepTable[adpcmIndex];
    int diff = sample - adpcmPredicted;
    
    uint8_t nibble = 0;
    if (diff < 0) {
        nibble = 8;
        diff = -diff;
    }
    
    if (diff >= step) { nibble |= 4; diff -= step; }
    if (diff >= step >> 1) { nibble |= 2; diff -= step >> 1; }
    if (diff >= step >> 2) { nibble |= 1; }
    
    // Update predictor
    int delta = step >> 3;
    if (nibble & 4) delta += step;
    if (nibble & 2) delta += step >> 1;
    if (nibble & 1) delta += step >> 2;
    
    if (nibble & 8) adpcmPredicted -= delta;
    else adpcmPredicted += delta;
    
    // Clamp predictor
    if (adpcmPredicted > 32767) adpcmPredicted = 32767;
    if (adpcmPredicted < -32768) adpcmPredicted = -32768;
    
    // Update index
    adpcmIndex += adpcmIndexTable[nibble];
    if (adpcmIndex < 0) adpcmIndex = 0;
    if (adpcmIndex > 88) adpcmIndex = 88;
    
    return nibble;
}

/**
 * Reset audio encoder state (call on disconnect/reconnect)
 */
void audioResetState() {
    audioSampleIndex = 0;
    audioSequenceNumber = 0;
    adpcmPredicted = 0;
    adpcmIndex = 0;
    audioHighNibble = false;
    audioPacketStartPredicted = 0;
    audioPacketStartIndex = 0;
}

/**
 * Process a single audio sample and send packet when buffer is full
 * @param sample 16-bit audio sample
 * @param pCharacteristic BLE characteristic to send data on
 * @return true if a packet was sent
 */
bool audioProcessSample(int16_t sample, BLECharacteristic* pCharacteristic) {
    // Save ADPCM state at start of new packet (for decoder sync)
    if (audioSampleIndex == 0 && !audioHighNibble) {
        audioPacketStartPredicted = adpcmPredicted;
        audioPacketStartIndex = adpcmIndex;
    }
    
    uint8_t nibble = encodeADPCMSample(sample);
    
    if (!audioHighNibble) {
        // First nibble of byte (low nibble)
        audioCurrentByte = nibble;
        audioHighNibble = true;
        return false;
    } else {
        // Second nibble of byte (high nibble) - pack and store
        audioCurrentByte |= (nibble << 4);
        audioTxBuffer[AUDIO_HEADER_SIZE + audioSampleIndex] = audioCurrentByte;
        audioSampleIndex++;
        audioHighNibble = false;
        
        // Send when ADPCM data buffer is full (118 samples = 59 bytes)
        if (audioSampleIndex >= AUDIO_ADPCM_DATA_SIZE) {
            // Write header: sequence number (little-endian)
            audioTxBuffer[0] = audioSequenceNumber & 0xFF;
            audioTxBuffer[1] = (audioSequenceNumber >> 8) & 0xFF;
            
            // Write ADPCM state BEFORE encoding (allows decoder to sync correctly)
            audioTxBuffer[2] = audioPacketStartPredicted & 0xFF;
            audioTxBuffer[3] = (audioPacketStartPredicted >> 8) & 0xFF;
            audioTxBuffer[4] = (uint8_t)audioPacketStartIndex;
            
            pCharacteristic->setValue(audioTxBuffer, AUDIO_BUFFER_SIZE);
            pCharacteristic->notify();
            
            audioSequenceNumber++;
            audioSampleIndex = 0;
            audioPacketsSentSinceLastDebug++;
            return true;
        }
        return false;
    }
}

/**
 * Print debug info about audio packets sent (call periodically)
 * @param intervalMs How often to print (in milliseconds)
 */
void audioPrintDebugStats(unsigned long intervalMs) {
    if (millis() - audioLastDebugTime >= intervalMs) {
        Serial.print("debug:packets_sent_");
        Serial.print(intervalMs / 1000);
        Serial.print("s=");
        Serial.print(audioPacketsSentSinceLastDebug);
        Serial.print(" (");
        Serial.print(audioPacketsSentSinceLastDebug * 1000 / intervalMs);
        Serial.println(" pps)");
        audioPacketsSentSinceLastDebug = 0;
        audioLastDebugTime = millis();
    }
}
