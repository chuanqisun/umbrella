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

      const color = this._valueToColor(values[i]);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellSize, cellSize);
    }
  }

  /**
   * Convert temperature value to color
   * Gradient: black (cold) → purple → red → orange → yellow (hot)
   * @param {number} value - Temperature value
   * @returns {string} CSS color string
   */
  _valueToColor(value) {
    // Normalize value to 0-1 range
    let t;
    if (value <= this.minTemp) {
      t = 0;
    } else if (value >= this.maxTemp) {
      t = 1;
    } else {
      t = (value - this.minTemp) / (this.maxTemp - this.minTemp);
    }

    // Color stops: black(0) → purple(0.25) → red(0.5) → orange(0.75) → yellow(1)
    const stops = [
      { pos: 0, r: 0, g: 0, b: 0 }, // black
      { pos: 0.25, r: 128, g: 0, b: 128 }, // purple
      { pos: 0.5, r: 255, g: 0, b: 0 }, // red
      { pos: 0.75, r: 255, g: 165, b: 0 }, // orange
      { pos: 1, r: 255, g: 255, b: 0 }, // yellow
    ];

    // Find the two stops to interpolate between
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].pos && t <= stops[i + 1].pos) {
        lower = stops[i];
        upper = stops[i + 1];
        break;
      }
    }

    // Interpolate between the two stops
    const range = upper.pos - lower.pos;
    const localT = range === 0 ? 0 : (t - lower.pos) / range;

    const r = Math.round(lower.r + (upper.r - lower.r) * localT);
    const g = Math.round(lower.g + (upper.g - lower.g) * localT);
    const b = Math.round(lower.b + (upper.b - lower.b) * localT);

    return `rgb(${r}, ${g}, ${b})`;
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
