/**
 * Button state handler module
 */

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
