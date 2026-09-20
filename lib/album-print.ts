// Kept self-contained so downloaded HTML has the same print checks as the preview.
export const ALBUM_PRINT_SCRIPT = `
window.albumReady = (async function () {
  const images = Array.from(document.images);
  await Promise.all(images.map(async function (image) {
    image.loading = 'eager';
    try {
      await image.decode();
    } catch {
      // A failed portrait may have switched to its embedded fallback in onerror.
      if (image.dataset.fallback) {
        image.onerror = null;
        image.src = image.dataset.fallback;
        try { await image.decode(); } catch { /* checked below */ }
      }
    }
  }));
  await document.fonts.ready;
  const ready = images.every(function (image) { return image.complete && image.naturalWidth > 0; });
  document.documentElement.dataset.albumReady = ready ? 'true' : 'false';
  const button = document.getElementById('album-print');
  if (button) {
    button.disabled = !ready;
    button.textContent = ready ? 'PRINT / SAVE AS PDF' : 'IMAGES FAILED TO LOAD - RELOAD ALBUM';
  }
  return ready;
})();
window.printAlbum = async function () {
  if (await window.albumReady) window.print();
};
`;

export type AlbumPrintWindow = Window & {
  albumReady?: Promise<boolean>;
  printAlbum?: () => Promise<void>;
};
