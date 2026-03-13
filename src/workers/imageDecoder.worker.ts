/**
 * Image Decoder Worker
 * Dedicated worker for decoding images off the main thread using createImageBitmap.
 */

self.onmessage = async (e: MessageEvent<{ url: string; id: number }>) => {
  const { url, id } = e.data;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
    
    const blob = await response.blob();
    
    // Decoding off-thread
    const bitmap = await createImageBitmap(blob);
    
    // We don't actually need the bitmap on the main thread for preloading,
    // just the fact that it's decoded and in the browser's GPU/image cache.
    // However, we close it to free resources immediately.
    bitmap.close();
    
    self.postMessage({ id, success: true });
  } catch (err) {
    self.postMessage({ id, success: false, error: String(err) });
  }
};
