import { ratingPinColor } from "@/lib/collections/rating-pin-color";
import type { SpotRating } from "@/lib/spot/types";

const PIN_WIDTH = 28;
const PIN_HEIGHT = 36;
const SELECTED_PIN_WIDTH = 34;
const SELECTED_PIN_HEIGHT = 44;
const VIEWBOX_WIDTH = 28;
const VIEWBOX_HEIGHT = 36;

type MapPinIcon = {
  url: string;
  scaledSize: { width: number; height: number };
  anchor: { x: number; y: number };
};

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function pinSvg(color: string, selected: boolean): string {
  const displayWidth = selected ? SELECTED_PIN_WIDTH : PIN_WIDTH;
  const displayHeight = selected ? SELECTED_PIN_HEIGHT : PIN_HEIGHT;
  const stroke = selected ? "#111827" : "#ffffff";
  const strokeWidth = selected ? 2 : 1.5;
  const ring = selected
    ? `<path d="M14 1.5C8.2 1.5 3.5 6.4 3.5 12.2c0 8.6 10.5 22.3 10.5 22.3S24.5 20.8 24.5 12.2C24.5 6.4 19.8 1.5 14 1.5z" fill="none" stroke="${color}" stroke-opacity="0.35" stroke-width="2"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth}" height="${displayHeight}" viewBox="0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}">
  <defs>
    <filter id="shadow" x="-30%" y="-20%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#111827" flood-opacity="0.18"/>
    </filter>
  </defs>
  ${ring}
  <path d="M14 2C8.5 2 4 6.5 4 12c0 8 10 22 10 22s10-14 10-22c0-5.5-4.5-10-10-10z" fill="${color}" stroke="${stroke}" stroke-width="${strokeWidth}" filter="url(#shadow)"/>
</svg>`;
}

export function mapPinIconUrl(rating: SpotRating, selected = false): string {
  return svgToDataUrl(pinSvg(ratingPinColor(rating), selected));
}

export function mapPinIcon(rating: SpotRating, selected = false): MapPinIcon {
  const width = selected ? SELECTED_PIN_WIDTH : PIN_WIDTH;
  const height = selected ? SELECTED_PIN_HEIGHT : PIN_HEIGHT;

  return {
    url: mapPinIconUrl(rating, selected),
    scaledSize: { width, height },
    anchor: { x: width / 2, y: height },
  };
}
