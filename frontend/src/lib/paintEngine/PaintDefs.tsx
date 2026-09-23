import { memo } from "react";

import { noiseTile } from "./noise";

/** Filters, noise and masks shared by every paint layer in the document.
 * Rendered once at the app root; referenced by id from each board's SVG. */
export const PaintDefs = memo(function PaintDefs() {
  const noise = noiseTile();
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        <filter id="es-blur-sm" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" />
        </filter>
        <filter id="es-blur-md" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="es-blur-lg" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <pattern id="es-noise" patternUnits="userSpaceOnUse" width="128" height="128">
          {noise && <image href={noise} width="128" height="128" />}
        </pattern>
        <mask id="es-tooth" maskUnits="userSpaceOnUse" x="-4000" y="-4000" width="8000" height="8000">
          <rect x="-4000" y="-4000" width="8000" height="8000" fill="#999" />
          <rect x="-4000" y="-4000" width="8000" height="8000" fill="url(#es-noise)" style={{ mixBlendMode: "screen" }} />
        </mask>
      </defs>
    </svg>
  );
});
