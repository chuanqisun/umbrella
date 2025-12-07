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
    this.smoothing = options.smoothing !== false; // Enable smooth interpolation by default

    // Pre-compute color lookup table for performance (256 entries)
    this._colorLUT = this._buildColorLUT(256);

    // Pre-allocate ImageData for performance
    this._updateCanvasSize();
  }

  /**
   * Build a color lookup table for fast temperature-to-color conversion
   * @param {number} size - Number of entries in the LUT
   * @returns {Uint8Array} - RGBA values packed into array
   */
  _buildColorLUT(size) {
    const lut = new Uint8Array(size * 4);

    // Color stops: black(0) → purple(0.25) → red(0.5) → orange(0.75) → yellow(1)
    const stops = [
      { pos: 0, r: 0, g: 0, b: 0 },
      { pos: 0.25, r: 128, g: 0, b: 128 },
      { pos: 0.5, r: 255, g: 0, b: 0 },
      { pos: 0.75, r: 255, g: 165, b: 0 },
      { pos: 1, r: 255, g: 255, b: 0 },
    ];

    for (let i = 0; i < size; i++) {
      const t = i / (size - 1);

      // Find the two stops to interpolate between
      let lower = stops[0];
      let upper = stops[stops.length - 1];
      for (let j = 0; j < stops.length - 1; j++) {
        if (t >= stops[j].pos && t <= stops[j + 1].pos) {
          lower = stops[j];
          upper = stops[j + 1];
          break;
        }
      }

      const range = upper.pos - lower.pos;
      const localT = range === 0 ? 0 : (t - lower.pos) / range;

      const idx = i * 4;
      lut[idx] = Math.round(lower.r + (upper.r - lower.r) * localT);
      lut[idx + 1] = Math.round(lower.g + (upper.g - lower.g) * localT);
      lut[idx + 2] = Math.round(lower.b + (upper.b - lower.b) * localT);
      lut[idx + 3] = 255; // Alpha
    }

    return lut;
  }

  /**
   * Update canvas size and ImageData buffer
   */
  _updateCanvasSize() {
    const outWidth = this.rotation === 90 || this.rotation === 270 ? this.height * this.cellSize : this.width * this.cellSize;
    const outHeight = this.rotation === 90 || this.rotation === 270 ? this.width * this.cellSize : this.height * this.cellSize;

    this.canvas.width = outWidth;
    this.canvas.height = outHeight;
    this._imageData = this.ctx.createImageData(outWidth, outHeight);
  }

  /**
   * Rotate the view by 90 degrees clockwise
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this._updateCanvasSize();
  }

  /**
   * Get interpolated temperature value using bilinear interpolation
   * @param {number[]} values - Source temperature array
   * @param {number} x - X coordinate (can be fractional)
   * @param {number} y - Y coordinate (can be fractional)
   * @returns {number} - Interpolated temperature
   */
  _bilinearInterpolate(values, x, y) {
    const { width, height } = this;

    // Clamp coordinates
    x = Math.max(0, Math.min(width - 1, x));
    y = Math.max(0, Math.min(height - 1, y));

    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = Math.min(x0 + 1, width - 1);
    const y1 = Math.min(y0 + 1, height - 1);

    const fx = x - x0;
    const fy = y - y0;

    // Get four corner values
    const v00 = values[y0 * width + x0];
    const v10 = values[y0 * width + x1];
    const v01 = values[y1 * width + x0];
    const v11 = values[y1 * width + x1];

    // Bilinear interpolation
    const v0 = v00 + (v10 - v00) * fx;
    const v1 = v01 + (v11 - v01) * fx;

    return v0 + (v1 - v0) * fy;
  }

  /**
   * Convert temperature to LUT index
   * @param {number} value - Temperature value
   * @returns {number} - LUT index (0-255)
   */
  _tempToLUTIndex(value) {
    if (value <= this.minTemp) return 0;
    if (value >= this.maxTemp) return 255;
    return Math.round(((value - this.minTemp) / (this.maxTemp - this.minTemp)) * 255);
  }

  /**
   * Render thermal data to the canvas with smooth interpolation
   * @param {number[]} values - Array of temperature values
   */
  render(values) {
    if (this.smoothing) {
      this._renderSmooth(values);
    } else {
      this._renderPixelated(values);
    }
  }

  /**
   * High-performance smooth rendering using bilinear interpolation
   * @param {number[]} values - Array of temperature values
   */
  _renderSmooth(values) {
    const { width, height, cellSize, rotation, _imageData, _colorLUT } = this;
    const data = _imageData.data;

    const outWidth = _imageData.width;
    const outHeight = _imageData.height;

    // Process each output pixel
    for (let outY = 0; outY < outHeight; outY++) {
      for (let outX = 0; outX < outWidth; outX++) {
        // Map output pixel back to source coordinates based on rotation
        let srcX, srcY;

        switch (rotation) {
          case 0:
            srcX = (outX + 0.5) / cellSize - 0.5;
            srcY = (outY + 0.5) / cellSize - 0.5;
            break;
          case 90:
            srcX = (outY + 0.5) / cellSize - 0.5;
            srcY = height - 1 - ((outX + 0.5) / cellSize - 0.5);
            break;
          case 180:
            srcX = width - 1 - ((outX + 0.5) / cellSize - 0.5);
            srcY = height - 1 - ((outY + 0.5) / cellSize - 0.5);
            break;
          case 270:
            srcX = width - 1 - ((outY + 0.5) / cellSize - 0.5);
            srcY = (outX + 0.5) / cellSize - 0.5;
            break;
        }

        // Get interpolated temperature
        const temp = this._bilinearInterpolate(values, srcX, srcY);

        // Convert to color using LUT
        const lutIdx = this._tempToLUTIndex(temp) * 4;
        const pixelIdx = (outY * outWidth + outX) * 4;

        data[pixelIdx] = _colorLUT[lutIdx];
        data[pixelIdx + 1] = _colorLUT[lutIdx + 1];
        data[pixelIdx + 2] = _colorLUT[lutIdx + 2];
        data[pixelIdx + 3] = 255;
      }
    }

    this.ctx.putImageData(_imageData, 0, 0);
  }

  /**
   * Original pixelated rendering (optimized with ImageData)
   * @param {number[]} values - Array of temperature values
   */
  _renderPixelated(values) {
    const { width, height, cellSize, rotation, _imageData, _colorLUT } = this;
    const data = _imageData.data;

    const outWidth = _imageData.width;
    const outHeight = _imageData.height;

    for (let i = 0; i < values.length && i < width * height; i++) {
      const srcX = i % width;
      const srcY = Math.floor(i / width);

      const lutIdx = this._tempToLUTIndex(values[i]) * 4;
      const r = _colorLUT[lutIdx];
      const g = _colorLUT[lutIdx + 1];
      const b = _colorLUT[lutIdx + 2];

      let startX, startY, endX, endY;
      switch (rotation) {
        case 0:
          startX = srcX * cellSize;
          startY = srcY * cellSize;
          endX = startX + cellSize;
          endY = startY + cellSize;
          break;
        case 90:
          startX = (height - 1 - srcY) * cellSize;
          startY = srcX * cellSize;
          endX = startX + cellSize;
          endY = startY + cellSize;
          break;
        case 180:
          startX = (width - 1 - srcX) * cellSize;
          startY = (height - 1 - srcY) * cellSize;
          endX = startX + cellSize;
          endY = startY + cellSize;
          break;
        case 270:
          startX = srcY * cellSize;
          startY = (width - 1 - srcX) * cellSize;
          endX = startX + cellSize;
          endY = startY + cellSize;
          break;
      }

      // Fill the cell
      for (let py = startY; py < endY; py++) {
        for (let px = startX; px < endX; px++) {
          const pixelIdx = (py * outWidth + px) * 4;
          data[pixelIdx] = r;
          data[pixelIdx + 1] = g;
          data[pixelIdx + 2] = b;
          data[pixelIdx + 3] = 255;
        }
      }
    }

    this.ctx.putImageData(_imageData, 0, 0);
  }

  /**
   * Convert temperature value to color
   * Gradient: black (cold) → purple → red → orange → yellow (hot)
   * @param {number} value - Temperature value
   * @returns {string} CSS color string
   */
  _valueToColor(value) {
    const lutIdx = this._tempToLUTIndex(value) * 4;
    return `rgb(${this._colorLUT[lutIdx]}, ${this._colorLUT[lutIdx + 1]}, ${this._colorLUT[lutIdx + 2]})`;
  }

  /**
   * Toggle smoothing on/off
   * @param {boolean} enabled - Whether smoothing should be enabled
   */
  setSmoothing(enabled) {
    this.smoothing = enabled;
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
