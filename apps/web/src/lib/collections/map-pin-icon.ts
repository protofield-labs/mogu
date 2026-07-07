import { ratingPinColor } from "@/lib/collections/rating-pin-color";
import type { SpotRating } from "@/lib/spot/types";

const PIN_SIZE = 32;
const SELECTED_PIN_SIZE = 38;
const VIEWBOX = 32;

type MapPinIcon = {
  url: string;
  scaledSize: { width: number; height: number };
  anchor: { x: number; y: number };
};

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function pinShell(selected: boolean, accent: string, innerSvg: string): string {
  const displaySize = selected ? SELECTED_PIN_SIZE : PIN_SIZE;
  const center = VIEWBOX / 2;
  const radius = center - 2;
  const stroke = selected ? "#111827" : "#ffffff";
  const strokeWidth = selected ? 2.5 : 2;
  const ring = selected
    ? `<circle cx="${center}" cy="${center}" r="${radius + 2}" fill="none" stroke="${accent}" stroke-opacity="0.35" stroke-width="2"/>`
    : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${displaySize}" height="${displaySize}" viewBox="0 0 ${VIEWBOX} ${VIEWBOX}">
  <defs>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#111827" flood-opacity="0.18"/>
    </filter>
  </defs>
  ${ring}
  <circle cx="${center}" cy="${center}" r="${radius}" fill="#ffffff" stroke="${stroke}" stroke-width="${strokeWidth}" filter="url(#shadow)"/>
  ${innerSvg}
</svg>`;
}

function heartIcon(color: string): string {
  return `<path d="M12 21s-6.7-4.35-9-7.35C1.2 11.55 1.2 8.45 3.3 6.55 5.4 4.65 8.1 5.05 10 6.85c1.9-1.8 4.6-2.2 6.7-.3 2.1 1.9 2.1 5 0 7.1C18.7 16.65 12 21 12 21z" fill="${color}" transform="translate(4 3.5) scale(0.92)"/>`;
}

function eitherIcon(color: string): string {
  return `<rect x="9" y="15" width="14" height="2.5" rx="1.25" fill="${color}"/>`;
}

function noIcon(color: string): string {
  return `<path d="M11 11l10 10M21 11l-10 10" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
}

function innerIcon(rating: SpotRating, color: string): string {
  switch (rating) {
    case "again":
      return heartIcon(color);
    case "either":
      return eitherIcon(color);
    case "no":
      return noIcon(color);
  }
}

export function mapPinIconUrl(rating: SpotRating, selected = false): string {
  const color = ratingPinColor(rating);
  const svg = pinShell(selected, color, innerIcon(rating, color));
  return svgToDataUrl(svg);
}

export function mapPinIcon(rating: SpotRating, selected = false): MapPinIcon {
  const size = selected ? SELECTED_PIN_SIZE : PIN_SIZE;
  const center = size / 2;

  return {
    url: mapPinIconUrl(rating, selected),
    scaledSize: { width: size, height: size },
    anchor: { x: center, y: center },
  };
}
