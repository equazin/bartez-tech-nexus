/** Validates an image file by reading its magic bytes (not relying on file extension). */
const CHECKS: Array<(a: Uint8Array) => boolean> = [
  (a) => a[0] === 0xFF && a[1] === 0xD8 && a[2] === 0xFF,                                     // JPEG
  (a) => a[0] === 0x89 && a[1] === 0x50 && a[2] === 0x4E && a[3] === 0x47,                    // PNG
  (a) => a[0] === 0x52 && a[1] === 0x49 && a[2] === 0x46 && a[3] === 0x46 &&                  // WEBP
         a[8] === 0x57 && a[9] === 0x45 && a[10] === 0x42 && a[11] === 0x50,
  (a) => a[0] === 0x47 && a[1] === 0x49 && a[2] === 0x46 && a[3] === 0x38,                    // GIF
];

export async function isValidImageMime(file: File): Promise<boolean> {
  const buf = await file.slice(0, 12).arrayBuffer();
  const arr = new Uint8Array(buf);
  return CHECKS.some((check) => check(arr));
}
