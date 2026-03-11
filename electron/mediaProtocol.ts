import { protocol } from 'electron';
import { stat, streamFile } from './vfs/composite';
import { Readable } from 'node:stream';
import { extname } from 'node:path';
import { safeDecodeURIComponent, parseRangeHeader } from './utils/uriUtils';
import { MIME_MAP } from './vfs/constants';

function toWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

function getMimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

export function registerMediaProtocol(mediaPathMap: Map<string, string>): void {
  protocol.handle('media', async (request: Request) => {
    const url = new URL(request.url);
    const id = safeDecodeURIComponent(url.hostname || url.pathname.replace(/^\//, '') || '');
    const realPath = mediaPathMap.get(id);
    if (!realPath) {
      return new Response('Not Found', { status: 404 });
    }

    const s = await stat(realPath);
    if (!s) {
      return new Response('Not Found', { status: 404 });
    }
    const fileSize = s.size;
    const contentType = getMimeType(realPath);
    const rangeHeader = request.headers.get('range') ?? request.headers.get('Range') ?? '';

    const baseHeaders: Record<string, string> = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    };

    if (!rangeHeader) {
      const stream = streamFile(realPath);
      return new Response(toWebStream(stream), {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': String(fileSize),
        },
      });
    }

    const range = parseRangeHeader(rangeHeader, fileSize);
    
    // Check if the path is virtual (inside an archive and not extracted)
    const isVirtual = !!require('./vfs/utils').splitArchivePath(realPath);

    if (!range || isVirtual) {
      const stream = streamFile(realPath);
      return new Response(toWebStream(stream), {
        status: 200,
        headers: {
          ...baseHeaders,
          'Content-Length': String(fileSize),
        },
      });
    }

    const { start, end } = range;
    const chunkSize = end - start + 1;
    
    // For physical files, we can now use Range-based streaming
    const stream = streamFile(realPath, { start, end });
    
    return new Response(toWebStream(stream), {
      status: 206,
      headers: {
        ...baseHeaders,
        'Content-Length': String(chunkSize),
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      },
    });
  });
}
