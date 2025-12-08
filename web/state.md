# State Machine System

The application uses a declarative finite state machine (FSM) architecture to manage the recording and playback lifecycle. The state machine is designed with clean separation of concerns: state definition, transition logic, and side effects are handled by different modules.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AudioRecorderApp                              │
│                             (main.js)                                   │
│                                                                         │
│  ┌─────────────────┐    ┌───────────────────┐    ┌─────────────────┐   │
│  │  StateMachine   │◄───│ ButtonStateHandler │◄───│  Button Input   │   │
│  │   (state.js)    │    │     (btn.js)       │    │   (serial.js)   │   │
│  └────────┬────────┘    └───────────────────┘    └─────────────────┘   │
│           │                                                             │
│           ▼                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    Side Effects (main.js)                        │   │
│  │  • Audio recording/playback                                      │   │
│  │  • Thermal frame capture                                         │   │
│  │  • UI updates                                                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## State Definitions

The application defines 7 distinct states in `web/state.js`:

| State       | Description                                                                            |
| ----------- | -------------------------------------------------------------------------------------- |
| `EMPTY`     | Initial state. No recording loaded, ready to start recording.                          |
| `WARMUP`    | User is holding the button, waiting for hold duration confirmation to start recording. |
| `RECORDING` | Actively capturing audio and thermal data.                                             |
| `COOLDOWN`  | User released button during recording, waiting for hold duration to confirm stop.      |
| `LOADED`    | Recording complete and loaded for playback.                                            |
| `REWARMUP`  | User is holding the button, waiting for hold duration confirmation to start playback.  |
| `REPLAY`    | Playing back the recorded audio and thermal data.                                      |

## State Transition Diagram

```
                    ┌─────────────────────────────────────┐
                    │                                     │
                    ▼                                     │
              ┌──────────┐                                │
              │  EMPTY   │◄───────────────────────────────┤
              └────┬─────┘                                │
                   │                                      │
                   │ BUTTON_TWO                           │
                   │ (2 buttons pressed)                  │
                   ▼                                      │
              ┌──────────┐                                │
         ┌────│  WARMUP  │────┐                           │
         │    └──────────┘    │                           │
         │                    │                           │
         │ BUTTON_RELEASE     │ timeout                   │
         │ (before timeout)   │ (1 second)                │
         │                    │                           │
         ▼                    ▼                           │
    [DISCARD]           ┌───────────┐                     │
    to EMPTY            │ RECORDING │                     │
                        └─────┬─────┘                     │
                              │                           │
                              │ BUTTON_RELEASE            │
                              │ (< 2 buttons)             │
                              ▼                           │
                        ┌───────────┐                     │
                   ┌────│ COOLDOWN  │────┐                │
                   │    └───────────┘    │                │
                   │                     │                │
                   │ BUTTON_TWO          │ timeout        │
                   │ (resume recording)  │ (1 second)     │
                   │                     │                │
                   ▼                     ▼                │
              ┌───────────┐        ┌──────────┐           │
              │ RECORDING │        │  LOADED  │           │
              └───────────┘        └────┬─────┘           │
                                        │                 │
                                        │ BUTTON_TWO      │
                                        ▼                 │
                                  ┌───────────┐           │
                             ┌────│ REWARMUP  │────┐      │
                             │    └───────────┘    │      │
                             │                     │      │
                             │ BUTTON_RELEASE      │ timeout
                             │ (before timeout)    │ (1 second)
                             │                     │      │
                             ▼                     ▼      │
                        ┌──────────┐         ┌────────┐   │
                        │  LOADED  │         │ REPLAY │───┘
                        └──────────┘         └────────┘
                                                  │
                                                  │ BUTTON_ZERO
                                                  │ or audio ends
                                                  ▼
                                             ┌──────────┐
                                             │  EMPTY   │
                                             └──────────┘
```
