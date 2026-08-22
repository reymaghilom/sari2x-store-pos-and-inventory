import assert from 'node:assert/strict';
import {
  clampCropTransform,
  cropOutputSize,
  cropRectangleForTransform,
  MAX_CROP_ZOOM,
  translationBounds,
} from '../src/utils/imageCrop.ts';

const frame = 320;

const landscapeCenter = cropRectangleForTransform(4000, 2000, frame, { translateX: 0, translateY: 0, zoom: 1 });
assert.deepEqual(landscapeCenter, { originX: 1000, originY: 0, width: 2000, height: 2000 });

const landscapeBounds = translationBounds(4000, 2000, frame, 1);
const landscapeRight = cropRectangleForTransform(4000, 2000, frame, { translateX: landscapeBounds.x, translateY: 500, zoom: 1 });
assert.deepEqual(landscapeRight, { originX: 0, originY: 0, width: 2000, height: 2000 });

const portraitCenter = cropRectangleForTransform(2000, 4000, frame, { translateX: 0, translateY: 0, zoom: 1 });
assert.deepEqual(portraitCenter, { originX: 0, originY: 1000, width: 2000, height: 2000 });

const portraitBounds = translationBounds(2000, 4000, frame, 1);
const portraitTop = cropRectangleForTransform(2000, 4000, frame, { translateX: 500, translateY: portraitBounds.y, zoom: 1 });
assert.deepEqual(portraitTop, { originX: 0, originY: 0, width: 2000, height: 2000 });

const square = cropRectangleForTransform(2048, 2048, frame, { translateX: 0, translateY: 0, zoom: 1 });
assert.deepEqual(square, { originX: 0, originY: 0, width: 2048, height: 2048 });

const clampedMinimum = clampCropTransform({ translateX: 99999, translateY: -99999, zoom: 0.01 }, 4000, 2000, frame);
assert.equal(clampedMinimum.zoom, 1);
assert.equal(clampedMinimum.translateX, landscapeBounds.x);
assert.equal(clampedMinimum.translateY, 0);

const maximum = clampCropTransform({ translateX: 99999, translateY: -99999, zoom: 99 }, 4000, 2000, frame);
assert.equal(maximum.zoom, MAX_CROP_ZOOM);
const maximumCrop = cropRectangleForTransform(4000, 2000, frame, maximum);
assert.equal(maximumCrop.width, 400);
assert.equal(maximumCrop.height, 400);
assert.ok(maximumCrop.originX >= 0 && maximumCrop.originX + maximumCrop.width <= 4000);
assert.ok(maximumCrop.originY >= 0 && maximumCrop.originY + maximumCrop.height <= 2000);

assert.equal(cropOutputSize({ originX: 0, originY: 0, width: 2400, height: 2400 }), 1024);
assert.equal(cropOutputSize({ originX: 0, originY: 0, width: 640, height: 640 }), 640);

console.log('Image crop geometry checks passed: landscape, portrait, square, bounds, min/max zoom, and output sizing.');
