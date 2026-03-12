import { protocol } from 'electron';
import * as fs from 'fs/promises';
import { logger } from '../utils/logger';

export function registerThumbnailProtocol(): void {
  protocol.handle('thumb', async (request: Request) => {
    try {
      const url = new URL(request.url);
      
      // The URL is formatted as thumb://cache/C:/path/to/file.png
      // The absolute path is in the pathname, including the drive letter for Windows.
      let filePath = decodeURIComponent(url.pathname);

      // On Windows/Electron, url.pathname for 'thumb://cache/C:/...' starts with '/C:/'
      if (process.platform === 'win32' && filePath.startsWith('/')) {
        filePath = filePath.slice(1);
      }

      logger.debug(`[ThumbProtocol] Request: ${request.url} -> Extracted Path: ${filePath}`);

      const data = await fs.readFile(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase();
      let mimeType = 'image/png';
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      else if (ext === 'webp') mimeType = 'image/webp';
      else if (ext === 'gif') mimeType = 'image/gif';

      logger.debug(`[ThumbProtocol] Serving ${filePath} (${data.length} bytes, ${mimeType})`);

      return new Response(data, {
        headers: { 'Content-Type': mimeType }
      });
    } catch (err) {
      logger.error('[ThumbProtocol] Error serving path:', request.url, err);
      return new Response('Not Found', { status: 404 });
    }
  });
}
