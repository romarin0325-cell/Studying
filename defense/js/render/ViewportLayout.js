import { BOARD } from '../core/enums.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function isLandscapeViewport(width, height) {
  return Number(width) > Number(height);
}

export function logicalToViewPoint(x, y, landscape = false) {
  return landscape ? { x: BOARD.rows - y, y: x } : { x, y };
}

export function viewToLogicalPoint(x, y, landscape = false) {
  return landscape ? { x: y, y: BOARD.rows - x } : { x, y };
}

export function logicalVectorToScreen(dx, dy, landscape = false) {
  return landscape ? { dx: -dy, dy: dx } : { dx, dy };
}

export class ViewportLayout {
  constructor({ canvas = null, dprCap = 2 } = {}) {
    this.canvas = canvas;
    this.dprCap = dprCap;
    this.landscape = false;
    this.cssWidth = 1;
    this.cssHeight = 1;
    this.dpr = 1;
    this.boardRect = { x: 0, y: 0, width: 1, height: 1 };
  }

  get viewColumns() {
    return this.landscape ? BOARD.rows : BOARD.columns;
  }

  get viewRows() {
    return this.landscape ? BOARD.columns : BOARD.rows;
  }

  resize(width, height, devicePixelRatio = globalThis.devicePixelRatio ?? 1) {
    this.cssWidth = Math.max(1, Number(width) || 1);
    this.cssHeight = Math.max(1, Number(height) || 1);
    this.landscape = isLandscapeViewport(this.cssWidth, this.cssHeight);
    this.dpr = clamp(Number(devicePixelRatio) || 1, 1, this.dprCap);

    const aspect = this.viewColumns / this.viewRows;
    let boardWidth = this.cssWidth;
    let boardHeight = boardWidth / aspect;
    if (boardHeight > this.cssHeight) {
      boardHeight = this.cssHeight;
      boardWidth = boardHeight * aspect;
    }
    this.boardRect = {
      x: (this.cssWidth - boardWidth) / 2,
      y: (this.cssHeight - boardHeight) / 2,
      width: boardWidth,
      height: boardHeight,
    };

    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.round(this.cssWidth * this.dpr));
      this.canvas.height = Math.max(1, Math.round(this.cssHeight * this.dpr));
      this.canvas.style.width = `${this.cssWidth}px`;
      this.canvas.style.height = `${this.cssHeight}px`;
    }
    return this.snapshot();
  }

  beginFrame(context) {
    context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    context.clearRect(0, 0, this.cssWidth, this.cssHeight);
  }

  logicalToCanvas(x, y) {
    const point = logicalToViewPoint(x, y, this.landscape);
    return {
      x: this.boardRect.x + (point.x / this.viewColumns) * this.boardRect.width,
      y: this.boardRect.y + (point.y / this.viewRows) * this.boardRect.height,
    };
  }

  logicalCellCenterToCanvas(x, y) {
    return this.logicalToCanvas(x + 0.5, y + 0.5);
  }

  logicalRadiusToCanvas(radius) {
    const cellWidth = this.boardRect.width / this.viewColumns;
    const cellHeight = this.boardRect.height / this.viewRows;
    return radius * Math.min(cellWidth, cellHeight);
  }

  clientToLogical(clientX, clientY, canvasBounds = this.canvas?.getBoundingClientRect?.()) {
    const bounds = canvasBounds ?? { left: 0, top: 0, width: this.cssWidth, height: this.cssHeight };
    const scaleX = this.cssWidth / Math.max(1, bounds.width);
    const scaleY = this.cssHeight / Math.max(1, bounds.height);
    const canvasX = (clientX - bounds.left) * scaleX;
    const canvasY = (clientY - bounds.top) * scaleY;
    const viewX = ((canvasX - this.boardRect.x) / this.boardRect.width) * this.viewColumns;
    const viewY = ((canvasY - this.boardRect.y) / this.boardRect.height) * this.viewRows;
    const inside = viewX >= 0 && viewY >= 0 && viewX < this.viewColumns && viewY < this.viewRows;
    const logical = viewToLogicalPoint(viewX, viewY, this.landscape);
    return {
      x: logical.x,
      y: logical.y,
      cellX: clamp(Math.floor(logical.x), 0, BOARD.columns - 1),
      cellY: clamp(Math.floor(logical.y), 0, BOARD.rows - 1),
      inside,
    };
  }

  transformVector(dx, dy) {
    return logicalVectorToScreen(dx, dy, this.landscape);
  }

  snapshot() {
    return Object.freeze({
      landscape: this.landscape,
      cssWidth: this.cssWidth,
      cssHeight: this.cssHeight,
      dpr: this.dpr,
      viewColumns: this.viewColumns,
      viewRows: this.viewRows,
      boardRect: Object.freeze({ ...this.boardRect }),
    });
  }
}

export default ViewportLayout;
