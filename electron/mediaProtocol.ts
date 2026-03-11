import { protocol } from 'electron';
import { stat, streamFile } from './vfs/composite';
import { Readable } from 'node:stream';
import { extname } from 'node:path';
import { safeDecodeURIComponent } from './utils/uriUtils';

function toWebStream(stream: NodeJS.ReadableStream): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream as Readable) as ReadableStream<Uint8Array>;
}

const MIME_MAP: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.wmv': 'video/x-ms-wmv',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
};

function getMimeType(path: string): string {
  const ext = extname(path).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

function parseRangeHeader(
  rangeHeader: string,
  fileSize: number
): { start: number; end: number } | null {
  const m = rangeHeader.match(/^\s*bytes\s*=\s*(\d*)-(\d*)\s*$/);
  if (!m) return null;
  const lhs = m[1];
  const rhs = m[2];
  if (rhs !== undefined && rhs !== '' && lhs !== undefined && lhs !== '') {
    const start = parseInt(lhs, 10);
    const end = parseInt(rhs, 10);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      return {
        start: Math.max(0, start),
        end: Math.min(end, fileSize - 1),
      };
    }
  }
  if (rhs !== undefined && rhs !== '' && (lhs === undefined || lhs === '')) {
    const suffix = parseInt(rhs, 10);
    if (!isNaN(suffix) && suffix > 0) {
      return {
        start: Math.max(0, fileSize - suffix),
        end: fileSize - 1,
      };
    }
  }
  if (lhs !== undefined && lhs !== '' && (rhs === undefined || rhs === '')) {
    const start = parseInt(lhs, 10);
    if (!isNaN(start)) {
      return {
        start: Math.max(0, start),
        end: fileSize - 1,
      };
    }
  }
  return null;
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
