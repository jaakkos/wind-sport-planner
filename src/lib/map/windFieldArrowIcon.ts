import type { Map as MapLibreMap } from "maplibre-gl";

/** MapLibre `icon-image` id for practice-area wind field arrows. */
export const WIND_FIELD_ARROW_IMAGE_ID = "wind-field-arrow";

const CANVAS_PX = 64;
const DPR = 2;

/**
 * Raster icon: arrow points **north** (up). Pair with `icon-rotate: ["get","windTo"]` and
 * `icon-rotation-alignment: map` (same geometry as the inline SVG asset below).
 */
function drawWindFieldArrowOnCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(32, 10);
  ctx.lineTo(54, 38);
  ctx.lineTo(42, 38);
  ctx.lineTo(42, 54);
  ctx.lineTo(22, 54);
  ctx.lineTo(22, 38);
  ctx.lineTo(10, 38);
  ctx.closePath();
  ctx.fillStyle = "rgba(29, 78, 216, 0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(30, 58, 138, 0.92)";
  ctx.lineWidth = 1.25;
  ctx.lineJoin = "round";
  ctx.stroke();
}

/** Register the wind-arrow icon (sync); safe to call after every `style.load`. */
export function ensureWindFieldArrowImage(map: MapLibreMap): void {
  if (!map.isStyleLoaded()) return;
  try {
    if (map.hasImage(WIND_FIELD_ARROW_IMAGE_ID)) return;
  } catch {
    return;
  }

  const w = CANVAS_PX * DPR;
  const h = CANVAS_PX * DPR;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.scale(DPR, DPR);
  drawWindFieldArrowOnCanvas(ctx);

  const register = (image: HTMLImageElement | ImageBitmap | ImageData) => {
    try {
      if (!map.isStyleLoaded()) return;
      if (map.hasImage(WIND_FIELD_ARROW_IMAGE_ID)) return;
      const opts = image instanceof ImageData ? { pixelRatio: DPR } : undefined;
      map.addImage(WIND_FIELD_ARROW_IMAGE_ID, image, opts);
      map.triggerRepaint();
    } catch {
      /* style race or unsupported image type */
    }
  };

  try {
    register(ctx.getImageData(0, 0, w, h));
  } catch {
    const url = canvas.toDataURL("image/png");
    const img = new Image();
    img.onload = () => register(img);
    img.onerror = () => {
      /* last resort: empty 1×1 would hide arrows; skip */
    };
    img.src = url;
  }
}

/** SVG equivalent of {@link drawWindFieldArrowOnCanvas} (e.g. docs, tests, future sprite). */
export function windFieldArrowSvgMarkup(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" aria-hidden="true">
  <path d="M32 10 L54 38 H42 V54 H22 V38 H10 Z" fill="#1d4ed8" fill-opacity="0.78" stroke="#1e3a8a" stroke-width="1.25" stroke-linejoin="round"/>
</svg>`;
}
