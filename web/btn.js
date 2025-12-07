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
 * State configuration for delayed transitions
 * Each state can define:
 *   - delayedTransition: {target, delay} - auto-transition after delay
 *   - on: {EVENT: targetState} - event-based transitions
 */
const STATE_CONFIG = {
  [AppState.EMPTY]: {
    on: { BUTTON_TWO: AppState.WARMUP }
  },
  [AppState.WARMUP]: {
    delayedTransition: { target: AppState.RECORDING },
    on: { BUTTON_RELEASE: AppState.EMPTY }
  },
  [AppState.RECORDING]: {
    on: { BUTTON_RELEASE: AppState.COOLDOWN }
  },
  [AppState.COOLDOWN]: {
    delayedTransition: { target: AppState.LOADED },
    on: { BUTTON_TWO: AppState.RECORDING }
  },
  [AppState.LOADED]: {
    on: { BUTTON_TWO: AppState.REWARMUP }
  },
  [AppState.REWARMUP]: {
    delayedTransition: { target: AppState.REPLAY },
    on: { BUTTON_RELEASE: AppState.LOADED }
  },
  [AppState.REPLAY]: {
    on: { BUTTON_ZERO: AppState.EMPTY }
  }
};

/**
 * ButtonStateHandler - Manages button-triggered state transitions with warmup/cooldown logic
 *
 * Uses a declarative state configuration where:
 * - Delayed transitions are automatically started on state entry
 * - Timers are automatically cancelled on state exit
 * - This eliminates timer management bugs by design
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
    this._currentTimer = null;
  }

  /**
   * Called when exiting a state - cleans up any pending timers
   * This MUST be called before any state transition
   */
  _onStateExit() {
    if (this._currentTimer) {
      clearTimeout(this._currentTimer);
      this._currentTimer = null;
    }
  }

  /**
   * Called when entering a state - starts delayed transition if configured
   * @param {string} state - The state being entered
   */
  _onStateEnter(state) {
    const config = STATE_CONFIG[state];
    if (config?.delayedTransition) {
      const { target } = config.delayedTransition;
      this._currentTimer = setTimeout(() => {
        this._currentTimer = null;
        // Verify we're still in the expected state (defensive check)
        if (this._stateMachine.isInState(state)) {
          this._transitionTo(target);
        }
      }, this._holdDuration);
    }
  }

  /**
   * Perform a state transition with proper exit/enter lifecycle
   * @param {string} targetState - The state to transition to
   */
  _transitionTo(targetState) {
    this._onStateExit();
    this._stateMachine.transitionTo(targetState);
    this._onStateEnter(targetState);
  }

  /**
   * Convert button count to event name
   * @param {number} buttonCount - Current button count
   * @returns {string|null} Event name or null
   */
  _buttonCountToEvent(buttonCount) {
    if (buttonCount === 2) return "BUTTON_TWO";
    if (buttonCount === 1) return "BUTTON_RELEASE";
    if (buttonCount === 0) return "BUTTON_ZERO";
    return null;
  }

  /**
   * Handle button state changes and trigger appropriate state transitions
   * @param {number} buttonCount - Current button count
   */
  handleButtonStateChange(buttonCount) {
    const event = this._buttonCountToEvent(buttonCount);
    if (!event) return;

    const currentState = this._stateMachine.currentState;
    const config = STATE_CONFIG[currentState];
    const targetState = config?.on?.[event];

    if (targetState) {
      this._transitionTo(targetState);
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    this._onStateExit();
  }
}
