let cached: string | null = null;

/** A 128px tile of monochrome noise, rendered once and shared by every paint layer.
 * Much cheaper than a feTurbulence filter per region. */
export function noiseTile(): string {
  if (cached !== null) return cached;
  cached = "";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (!ctx) return cached;
    const image = ctx.createImageData(128, 128);
    let seed = 7;
    for (let i = 0; i < image.data.length; i += 4) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const v = seed % 256;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
      image.data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    cached = canvas.toDataURL("image/png");
  } catch {
    cached = "";
  }
  return cached;
}
