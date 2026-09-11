import assert from 'node:assert/strict';
import test from 'node:test';

import { BOARD, DIRECTION } from '../../js/core/enums.js';
import {
  directionFromLogicalVector,
  directionFromScreenVector,
  updateBossDirection,
  updateHeroDirection,
} from '../../js/battle/systems/DirectionSystem.js';
import {
  isLandscapeViewport,
  logicalToViewPoint,
  logicalVectorToScreen,
  ViewportLayout,
  viewToLogicalPoint,
} from '../../js/render/ViewportLayout.js';

const closeTo = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not within ${epsilon} of ${expected}`);
};

test('directionFromScreenVector handles cardinal directions and resolves equal axes horizontally', () => {
  assert.equal(directionFromScreenVector(1, 0), DIRECTION.RIGHT);
  assert.equal(directionFromScreenVector(-1, 0), DIRECTION.LEFT);
  assert.equal(directionFromScreenVector(0, 1), DIRECTION.FRONT);
  assert.equal(directionFromScreenVector(0, -1), DIRECTION.BACK);

  assert.equal(directionFromScreenVector(1, 1), DIRECTION.RIGHT);
  assert.equal(directionFromScreenVector(1, -1), DIRECTION.RIGHT);
  assert.equal(directionFromScreenVector(-1, 1), DIRECTION.LEFT);
  assert.equal(directionFromScreenVector(-1, -1), DIRECTION.LEFT);
  assert.equal(directionFromScreenVector(4, 3.999), DIRECTION.RIGHT);
  assert.equal(directionFromScreenVector(3.999, 4), DIRECTION.FRONT);

  assert.equal(directionFromScreenVector(0, 0, DIRECTION.BACK), DIRECTION.BACK);
  assert.equal(directionFromScreenVector(Number.NaN, 1, DIRECTION.LEFT), DIRECTION.LEFT);
  assert.equal(directionFromScreenVector(1, Number.POSITIVE_INFINITY, DIRECTION.RIGHT), DIRECTION.RIGHT);
});

test('landscape direction uses the clockwise-rotated screen vector', () => {
  assert.deepEqual(logicalVectorToScreen(3, 5, false), { dx: 3, dy: 5 });
  assert.deepEqual(logicalVectorToScreen(3, 5, true), { dx: -5, dy: 3 });

  assert.equal(directionFromLogicalVector(1, 0, true), DIRECTION.FRONT);
  assert.equal(directionFromLogicalVector(-1, 0, true), DIRECTION.BACK);
  assert.equal(directionFromLogicalVector(0, 1, true), DIRECTION.LEFT);
  assert.equal(directionFromLogicalVector(0, -1, true), DIRECTION.RIGHT);
  assert.equal(directionFromLogicalVector(1, 1, true), DIRECTION.LEFT, 'equal logical axes become equal screen axes');
});

test('heroes face targets, while idle heroes and stunned bosses preserve their last direction', () => {
  const hero = { x: 4, y: 4, direction: DIRECTION.BACK };
  assert.equal(updateHeroDirection(hero, { x: 8, y: 4 }), DIRECTION.RIGHT);
  assert.equal(hero.direction, DIRECTION.RIGHT);
  assert.equal(updateHeroDirection(hero, null), DIRECTION.RIGHT);

  const freshHero = { x: 0, y: 0 };
  assert.equal(updateHeroDirection(freshHero, null), DIRECTION.FRONT);
  assert.equal(updateHeroDirection(freshHero, { x: 0, y: 3 }, true), DIRECTION.LEFT);

  const boss = { isBoss: true, direction: DIRECTION.FRONT, statuses: {} };
  assert.equal(updateBossDirection(boss, { dx: 1, dy: 0 }), DIRECTION.RIGHT);
  boss.statuses.stun = { remaining: 1 };
  assert.equal(updateBossDirection(boss, { dx: -1, dy: 0 }), DIRECTION.RIGHT);
  delete boss.statuses.stun;
  assert.equal(updateBossDirection(boss, { dx: 0, dy: -1 }, true), DIRECTION.RIGHT);

  const normalEnemy = { isBoss: false, direction: DIRECTION.BACK };
  assert.equal(updateBossDirection(normalEnemy, { dx: 1, dy: 0 }), DIRECTION.BACK);
});

test('hero facing compares enemy centers against the center of its placement cell', () => {
  const portraitHero = { x: 4, y: 4, direction: DIRECTION.FRONT };
  const fractionalEnemyCenter = { x: 3.9, y: 4.2 };
  assert.equal(updateHeroDirection(portraitHero, fractionalEnemyCenter, false), DIRECTION.LEFT);

  const landscapeHero = { x: 4, y: 4, direction: DIRECTION.FRONT };
  assert.equal(updateHeroDirection(landscapeHero, fractionalEnemyCenter, true), DIRECTION.BACK);
});

test('logical and view coordinates are exact inverses in portrait and landscape', () => {
  const points = [
    { x: 0, y: 0 },
    { x: 0.5, y: 0.5 },
    { x: 5.25, y: 7.75 },
    { x: BOARD.columns, y: BOARD.rows },
  ];
  for (const landscape of [false, true]) {
    for (const point of points) {
      const view = logicalToViewPoint(point.x, point.y, landscape);
      const logical = viewToLogicalPoint(view.x, view.y, landscape);
      closeTo(logical.x, point.x);
      closeTo(logical.y, point.y);
    }
  }

  assert.equal(isLandscapeViewport(844, 390), true);
  assert.equal(isLandscapeViewport(390, 844), false);
  assert.equal(isLandscapeViewport(500, 500), false, 'equal axes retain portrait board orientation');
});

test('ViewportLayout caps DPR at 2 and keeps the complete board inside portrait and landscape canvases', () => {
  const canvas = {
    width: 0,
    height: 0,
    style: {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 844 }),
  };
  const layout = new ViewportLayout({ canvas, dprCap: 2 });
  let snapshot = layout.resize(390, 844, 3.5);
  assert.equal(snapshot.landscape, false);
  assert.equal(snapshot.viewColumns, 12);
  assert.equal(snapshot.viewRows, 16);
  assert.equal(snapshot.dpr, 2);
  assert.equal(canvas.width, 780);
  assert.equal(canvas.height, 1688);
  assert.equal(canvas.style.width, '390px');
  assert.equal(canvas.style.height, '844px');
  assert.ok(snapshot.boardRect.x >= 0 && snapshot.boardRect.y >= 0);
  assert.ok(snapshot.boardRect.x + snapshot.boardRect.width <= snapshot.cssWidth + 1e-9);
  assert.ok(snapshot.boardRect.y + snapshot.boardRect.height <= snapshot.cssHeight + 1e-9);

  snapshot = layout.resize(844, 390, 4);
  assert.equal(snapshot.landscape, true);
  assert.equal(snapshot.viewColumns, 16);
  assert.equal(snapshot.viewRows, 12);
  assert.equal(snapshot.dpr, 2);
  assert.equal(canvas.width, 1688);
  assert.equal(canvas.height, 780);
  assert.ok(snapshot.boardRect.x >= 0 && snapshot.boardRect.y >= 0);
  assert.ok(snapshot.boardRect.x + snapshot.boardRect.width <= snapshot.cssWidth + 1e-9);
  assert.ok(snapshot.boardRect.y + snapshot.boardRect.height <= snapshot.cssHeight + 1e-9);

  snapshot = layout.resize(844, 390, 0.25);
  assert.equal(snapshot.dpr, 1, 'DPR is also clamped to a usable lower bound');
});

test('landscape canvas coordinates inverse-map to the intended logical cell after CSS scaling', () => {
  const layout = new ViewportLayout();
  layout.resize(800, 360, 2);
  assert.equal(layout.landscape, true);
  const logicalCell = { x: 3, y: 7 };
  const canvasPoint = layout.logicalCellCenterToCanvas(logicalCell.x, logicalCell.y);
  const bounds = { left: 100, top: 50, width: 1_600, height: 720 };
  const clientX = bounds.left + canvasPoint.x * (bounds.width / layout.cssWidth);
  const clientY = bounds.top + canvasPoint.y * (bounds.height / layout.cssHeight);
  const mapped = layout.clientToLogical(clientX, clientY, bounds);

  assert.equal(mapped.inside, true);
  assert.equal(mapped.cellX, logicalCell.x);
  assert.equal(mapped.cellY, logicalCell.y);
  closeTo(mapped.x, logicalCell.x + 0.5);
  closeTo(mapped.y, logicalCell.y + 0.5);
});

test('portrait inverse mapping, outside detection, radii and frame transforms stay in CSS pixels', () => {
  const canvas = { width: 0, height: 0, style: {} };
  const layout = new ViewportLayout({ canvas });
  layout.resize(360, 800, 2);
  const center = layout.logicalCellCenterToCanvas(11, 15);
  const mapped = layout.clientToLogical(center.x, center.y, { left: 0, top: 0, width: 360, height: 800 });
  assert.equal(mapped.inside, true);
  assert.deepEqual([mapped.cellX, mapped.cellY], [11, 15]);

  const outside = layout.clientToLogical(-100, -100, { left: 0, top: 0, width: 360, height: 800 });
  assert.equal(outside.inside, false);
  assert.deepEqual([outside.cellX, outside.cellY], [0, 0]);

  const cellWidth = layout.boardRect.width / layout.viewColumns;
  const cellHeight = layout.boardRect.height / layout.viewRows;
  closeTo(layout.logicalRadiusToCanvas(3), 3 * Math.min(cellWidth, cellHeight));

  const calls = [];
  layout.beginFrame({
    setTransform: (...args) => calls.push(['transform', ...args]),
    clearRect: (...args) => calls.push(['clear', ...args]),
  });
  assert.deepEqual(calls, [
    ['transform', 2, 0, 0, 2, 0, 0],
    ['clear', 0, 0, 360, 800],
  ]);
});
