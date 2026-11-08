/** Client-only helper: εικόνα → data URL, μικραίνει τις μεγάλες. */
/** Read an image file as a data URL, shrinking raster images to `maxPx` on the long side. */
export async function fileToDataUrl(file: File, maxPx: number, square = false): Promise<string> {
  const raw: string = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error('Το αρχείο δεν διαβάστηκε.'));
    r.readAsDataURL(file);
  });
  if (file.type === 'image/svg+xml' && !square) return raw; // vectors stay sharp at any size
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error('Η εικόνα δεν αναγνωρίστηκε.'));
    i.src = raw;
  });
  const ratio = Math.min(1, maxPx / Math.max(img.width, img.height));
  const w = square ? maxPx : Math.max(1, Math.round(img.width * ratio));
  const h = square ? maxPx : Math.max(1, Math.round(img.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  if (square) {
    const s = Math.min(w / img.width, h / img.height);
    const dw = img.width * s, dh = img.height * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    ctx.drawImage(img, 0, 0, w, h);
  }
  return canvas.toDataURL('image/png');
}
