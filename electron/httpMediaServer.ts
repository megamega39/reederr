import { createServer } from 'node:http';
import { extname } from 'node:path';
import { safeDecodeURIComponent, parseRangeHeader } from './utils/uriUtils';
import { splitArchivePath } from './vfs/utils';
import { stat, streamFile } from './vfs/composite';
import { MIME_MAP } from './vfs/constants';
import { logger } from './utils/logger';

function getMimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

export function createHttpMediaServer(mediaPathMap: Map<string, string>): Promise<{
  getMediaUrl: (id: string) => string;
  close: () => void;
}> {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end();
        return;
      }
      const parsed = new URL(req.url ?? '', `http://127.0.0.1/`);
      const id = parsed.searchParams.get('id');
      if (!id) {
        res.writeHead(400);
        res.end();
        return;
      }
      const realPath = mediaPathMap.get(safeDecodeURIComponent(id));
      if (!realPath) {
        res.writeHead(404);
        res.end();
        return;
      }

      const s = await stat(realPath);
      if (!s || s.isDirectory) {
        res.writeHead(s?.isDirectory ? 403 : 404);
        res.end(s?.isDirectory ? 'Forbidden: Path is a directory' : 'Not Found');
        return;
      }
      const fileSize = s.size;
      const contentType = getMimeType(realPath);
      const rangeHeader = req.headers.range ?? '';
      const isHead = req.method === 'HEAD';

      const sendHeaders = (status: number, headers: Record<string, string>, hasBody: boolean) => {
        const h = { 'Content-Type': contentType, 'Accept-Ranges': 'bytes', ...headers };
        res.writeHead(status, h);
        if (isHead || !hasBody) res.end();
      };

      // Check if the path is virtual (inside an archive and not extracted)
      const isVirtual = !!splitArchivePath(realPath);

      if (!rangeHeader || isVirtual) {
        sendHeaders(200, { 'Content-Length': String(fileSize) }, !isHead);
        if (!isHead) {
          const stream = streamFile(realPath);
          stream.on('error', (err) => {
            logger.error(`[HttpMediaServer] Stream error for ${realPath}:`, err);
            if (!res.headersSent) res.writeHead(500);
            res.end();
          });
          stream.pipe(res);
        }
        return;
      }

      const range = parseRangeHeader(rangeHeader, fileSize);
      if (!range) {
        sendHeaders(200, { 'Content-Length': String(fileSize) }, !isHead);
        if (!isHead) streamFile(realPath).pipe(res);
        return;
      }

      const { start, end } = range;
      const chunkSize = end - start + 1;
      sendHeaders(206, {
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      }, !isHead);
      
      if (!isHead) {
        const stream = streamFile(realPath, { start, end });
        stream.on('error', (err) => {
          logger.error(`[HttpMediaServer] Range stream error for ${realPath}:`, err);
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
        stream.pipe(res);
        req.on('close', () => {
          stream.destroy();
        });
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const port = (server.address() as { port: number })?.port ?? 0;
      const baseUrl = `http://127.0.0.1:${port}/media`;
      resolve({
        getMediaUrl: (id: string) => `${baseUrl}?id=${encodeURIComponent(id)}`,
        close: () => server.close(),
      });
    });
  });
}
