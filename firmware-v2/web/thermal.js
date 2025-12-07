// Thermal image rendering module

export class ThermalRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.width = options.width || 32;
    this.height = options.height || 24;
    this.cellSize = options.cellSize || 8;
    this.minTemp = options.minTemp || 26;
    this.maxTemp = options.maxTemp || 34;
    this.rotation = 0; // 0, 90, 180, 270 degrees
  }

  /**
   * Rotate the view by 90 degrees clockwise
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    // Swap canvas dimensions for 90/270 degree rotations
    if (this.rotation === 90 || this.rotation === 270) {
      this.canvas.width = this.height * this.cellSize;
      this.canvas.height = this.width * this.cellSize;
    } else {
      this.canvas.width = this.width * this.cellSize;
      this.canvas.height = this.height * this.cellSize;
    }
  }

  /**
   * Render thermal data to the canvas
   * @param {number[]} values - Array of temperature values
   */
  render(values) {
    const { ctx, cellSize, width, height, rotation } = this;

    for (let i = 0; i < values.length && i < width * height; i++) {
      const srcX = i % width;
      const srcY = Math.floor(i / width);

      let x, y;
      switch (rotation) {
        case 0:
          x = srcX * cellSize;
          y = srcY * cellSize;
          break;
        case 90:
          x = (height - 1 - srcY) * cellSize;
          y = srcX * cellSize;
          break;
        case 180:
          x = (width - 1 - srcX) * cellSize;
          y = (height - 1 - srcY) * cellSize;
          break;
        case 270:
          x = srcY * cellSize;
          y = (width - 1 - srcX) * cellSize;
          break;
      }

      const gray = this._valueToGray(values[i]);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }

  /**
   * Convert temperature value to grayscale (0-255)
   * @param {number} value - Temperature value
   * @returns {number} Grayscale value 0-255
   */
  _valueToGray(value) {
    if (value <= this.minTemp) {
      return 0;
    } else if (value >= this.maxTemp) {
      return 255;
    } else {
      const range = this.maxTemp - this.minTemp;
      return Math.round(((value - this.minTemp) / range) * 255);
    }
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
