/**
 * Button state handler module with warmup/cooldown logic
 */

import { AppState } from "./state.js";

let buttonState = 0;
let buttonCallback = null;

/**
 * Set the callback function to be called when button state changes
 * @param {function(number): void} callback - Callback receiving button state
 */
export function setButtonCallback(callback) {
  buttonCallback = callback;
}

/**
 * Update the button state
 * @param {number} state - The new button state
 */
export function updateButtonState(state) {
  if (buttonState !== state) {
    buttonState = state;
    if (buttonCallback) {
      buttonCallback(state);
    }
  }
}

/**
 * Get the current button state
 * @returns {number} The current button state
 */
export function getButtonState() {
  return buttonState;
}

/**
 * Reset button state to 0
 */
export function resetButtonState() {
  buttonState = 0;
  if (buttonCallback) {
    buttonCallback(0);
  }
}

/**
 * ButtonStateHandler - Manages button-triggered state transitions with warmup/cooldown logic
 */
export class ButtonStateHandler {
  /**
   * @param {import('./state.js').StateMachine} stateMachine - The state machine to control
   * @param {object} options - Configuration options
   * @param {number} [options.holdDuration=1000] - Duration in ms for warmup/cooldown confirmation
   */
  constructor(stateMachine, options = {}) {
    this._stateMachine = stateMachine;
    this._holdDuration = options.holdDuration ?? 1000;
    this._holdTimer = null;
  }

  /**
   * Clear any pending hold timer
   */
  _clearTimer() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  /**
   * Start a timer that transitions to targetState after holdDuration
   * Only transitions if still in expectedState when timer fires
   * @param {string} expectedState - State that must still be active for transition
   * @param {string} targetState - State to transition to
   */
  _startTimer(expectedState, targetState) {
    this._holdTimer = setTimeout(() => {
      this._holdTimer = null;
      if (this._stateMachine.isInState(expectedState)) {
        this._stateMachine.transitionTo(targetState);
      }
    }, this._holdDuration);
  }

  /**
   * Handle button state changes and trigger appropriate state transitions
   * @param {number} buttonCount - Current button count
   */
  handleButtonStateChange(buttonCount) {
    const isTwo = buttonCount === 2;
    const currentState = this._stateMachine.currentState;

    // Clear any pending hold timer when button state changes
    this._clearTimer();

    switch (currentState) {
      case AppState.EMPTY:
        if (isTwo) {
          // Start warmup (begins recording but not yet committed)
          this._stateMachine.transitionTo(AppState.WARMUP);
          // After hold duration, confirm and transition to recording
          this._startTimer(AppState.WARMUP, AppState.RECORDING);
        }
        break;

      case AppState.WARMUP:
        if (!isTwo) {
          // Button released before confirmation - discard and go back to empty
          this._stateMachine.transitionTo(AppState.EMPTY);
        }
        break;

      case AppState.RECORDING:
        if (!isTwo) {
          // Start cooldown period
          this._stateMachine.transitionTo(AppState.COOLDOWN);
          // After hold duration, confirm and transition to loaded
          this._startTimer(AppState.COOLDOWN, AppState.LOADED);
        }
        break;

      case AppState.COOLDOWN:
        if (isTwo) {
          // Button pressed again before confirmation - go back to recording
          this._stateMachine.transitionTo(AppState.RECORDING);
        }
        break;

      case AppState.LOADED:
        if (isTwo) {
          // Start rewarmup
          this._stateMachine.transitionTo(AppState.REWARMUP);
          // After hold duration, confirm and transition to replay
          this._startTimer(AppState.REWARMUP, AppState.REPLAY);
        }
        break;

      case AppState.REWARMUP:
        if (!isTwo) {
          // Button released before confirmation - go back to loaded
          this._stateMachine.transitionTo(AppState.LOADED);
        }
        break;

      case AppState.REPLAY:
        if (buttonCount === 0) {
          this._stateMachine.transitionTo(AppState.EMPTY);
        }
        break;
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this._clearTimer();
  }
}
