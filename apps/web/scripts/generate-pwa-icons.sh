#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/public/icons/icon.svg"
OUT="$ROOT/public/icons"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "rsvg-convert is required (brew install librsvg)" >&2
  exit 1
fi

rsvg-convert -w 512 -h 512 "$SRC" -o "$OUT/icon-512.png"
rsvg-convert -w 192 -h 192 "$SRC" -o "$OUT/icon-192.png"
rsvg-convert -w 180 -h 180 "$SRC" -o "$OUT/apple-touch-icon.png"

echo "Generated PWA icons in $OUT"
