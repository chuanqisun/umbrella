/**
 * App State Machine
 * States: empty, warmup, recording, cooldown, loaded, rewarmup, replay
 * Transitions:
 *   empty -> warmup: when button count becomes 2 (starts recording)
 *   warmup -> recording: after 1 second hold
 *   warmup -> empty: if button released before 1 second (discards recording)
 *   recording -> cooldown: when button count becomes < 2
 *   cooldown -> loaded: after 1 second with button count < 2
 *   cooldown -> recording: if button count becomes 2 before 1 second
 *   loaded -> rewarmup: when button count becomes 2
 *   rewarmup -> replay: after 1 second hold
 *   rewarmup -> loaded: if button released before 1 second
 *   replay -> empty: when button count is 0 or audio ends
 */

export const AppState = {
  EMPTY: "empty",
  WARMUP: "warmup",
  RECORDING: "recording",
  COOLDOWN: "cooldown",
  LOADED: "loaded",
  REWARMUP: "rewarmup",
  REPLAY: "replay",
};

/**
 * State Machine for managing app states and transitions
 */
export class StateMachine {
  /**
   * @param {function(string, string): void} onTransition - Callback when state changes (newState, oldState)
   */
  constructor(onTransition) {
    this._currentState = AppState.EMPTY;
    this._onTransition = onTransition;
  }

  /**
   * Get the current state
   * @returns {string}
   */
  get currentState() {
    return this._currentState;
  }

  /**
   * Transition to a new state
   * @param {string} newState - The state to transition to
   */
  transitionTo(newState) {
    const oldState = this._currentState;
    if (oldState === newState) return;

    this._currentState = newState;
    console.log(`State transition: ${oldState} -> ${newState}`);

    if (this._onTransition) {
      this._onTransition(newState, oldState);
    }
  }

  /**
   * Check if currently in a specific state
   * @param {string} state
   * @returns {boolean}
   */
  isInState(state) {
    return this._currentState === state;
  }

  /**
   * Reset to empty state
   */
  reset() {
    this.transitionTo(AppState.EMPTY);
  }
}
