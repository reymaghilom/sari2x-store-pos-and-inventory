export const MIN_CROP_ZOOM = 1;
export const MAX_CROP_ZOOM = 5;

export type CropTransform = {
  translateX: number;
  translateY: number;
  zoom: number;
};

export type CropRectangle = {
  originX: number;
  originY: number;
  width: number;
  height: number;
};

export function coverSize(sourceWidth: number, sourceHeight: number, frameSize: number) {
  const scale = Math.max(frameSize / sourceWidth, frameSize / sourceHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale, scale };
}

export function translationBounds(sourceWidth: number, sourceHeight: number, frameSize: number, zoom: number) {
  const covered = coverSize(sourceWidth, sourceHeight, frameSize);
  return {
    x: Math.max(0, (covered.width * zoom - frameSize) / 2),
    y: Math.max(0, (covered.height * zoom - frameSize) / 2),
  };
}

export function clampCropTransform(
  transform: CropTransform,
  sourceWidth: number,
  sourceHeight: number,
  frameSize: number,
): CropTransform {
  const zoom = Math.min(MAX_CROP_ZOOM, Math.max(MIN_CROP_ZOOM, transform.zoom));
  const bounds = translationBounds(sourceWidth, sourceHeight, frameSize, zoom);
  const translateX = Math.min(bounds.x, Math.max(-bounds.x, transform.translateX));
  const translateY = Math.min(bounds.y, Math.max(-bounds.y, transform.translateY));
  return {
    translateX: translateX === 0 ? 0 : translateX,
    translateY: translateY === 0 ? 0 : translateY,
    zoom,
  };
}

export function cropRectangleForTransform(
  sourceWidth: number,
  sourceHeight: number,
  frameSize: number,
  requestedTransform: CropTransform,
): CropRectangle {
  if (sourceWidth <= 0 || sourceHeight <= 0 || frameSize <= 0) {
    throw new Error('The selected image has invalid dimensions.');
  }

  const transform = clampCropTransform(requestedTransform, sourceWidth, sourceHeight, frameSize);
  const covered = coverSize(sourceWidth, sourceHeight, frameSize);
  const renderedScale = covered.scale * transform.zoom;
  const rawSide = frameSize / renderedScale;
  const side = Math.max(1, Math.min(sourceWidth, sourceHeight, Math.round(rawSide)));
  const rawOriginX = sourceWidth / 2 - transform.translateX / renderedScale - rawSide / 2;
  const rawOriginY = sourceHeight / 2 - transform.translateY / renderedScale - rawSide / 2;
  const originX = Math.min(sourceWidth - side, Math.max(0, Math.round(rawOriginX)));
  const originY = Math.min(sourceHeight - side, Math.max(0, Math.round(rawOriginY)));

  return { originX, originY, width: side, height: side };
}

export function cropOutputSize(crop: CropRectangle) {
  return Math.max(1, Math.min(1024, Math.floor(Math.min(crop.width, crop.height))));
}
