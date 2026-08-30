/**
 * Convert an image file to WebP format using browser Canvas API.
 * Returns a new File with the same name (extension changed to .webp) and
 * the original file if the input is not an image or the conversion fails.
 *
 * Quality: 0.85 gives ~30-50% size reduction for PNG/JPEG with no visible loss.
 */
export async function convertImageToWebP(file: File, quality: number = 0.85): Promise<File> {
  // Only convert image types
  if (!file.type.startsWith('image/')) return file;
  // Skip if already webp
  if (file.type === 'image/webp') return file;
  // Skip GIFs (animation would be lost)
  if (file.type === 'image/gif') return file;
  // Skip SVGs (vector format)
  if (file.type === 'image/svg+xml') return file;

  try {
    const blob = await readFileAsDataURL(file);
    const img = await loadImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);

    const webpBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/webp', quality)
    );

    if (!webpBlob) return file;

    // Build new file name: replace extension with .webp
    const originalName = file.name;
    const dotIdx = originalName.lastIndexOf('.');
    const baseName = dotIdx > 0 ? originalName.substring(0, dotIdx) : originalName;
    const newName = `${baseName}.webp`;

    return new File([webpBlob], newName, {
      type: 'image/webp',
      lastModified: Date.now(),
    });
  } catch (e) {
    console.warn('WebP conversion failed, using original:', e);
    return file;
  }
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
