const SIZE = 18;

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const userLocationSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 18 18">
  <circle cx="9" cy="9" r="7" fill="#2563EB" fill-opacity="0.18"/>
  <circle cx="9" cy="9" r="4.5" fill="#2563EB" stroke="#ffffff" stroke-width="2"/>
</svg>`;

export function userLocationMarkerIcon() {
  return {
    url: svgToDataUrl(userLocationSvg),
    scaledSize: { width: SIZE, height: SIZE },
    anchor: { x: SIZE / 2, y: SIZE / 2 },
  };
}
