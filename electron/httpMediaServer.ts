import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname } from 'node:path';
import { safeDecodeURIComponent } from './utils/uriUtils';

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

function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const m = rangeHeader.trim().match(/bytes\s*=\s*(\d*)\s*-\s*(\d*)/);
  if (!m) return null;
  const lhs = m[1];
  const rhs = m[2];
  if (rhs !== undefined && rhs !== '' && (lhs === undefined || lhs === '')) {
    const suffix = parseInt(rhs, 10);
    if (!isNaN(suffix) && suffix > 0) {
      return { start: Math.max(0, fileSize - suffix), end: fileSize - 1 };
    }
  }
  if (lhs !== undefined && lhs !== '' && (rhs === undefined || rhs === '')) {
    const start = parseInt(lhs, 10);
    if (!isNaN(start)) {
      return { start: Math.max(0, start), end: fileSize - 1 };
    }
  }
  if (lhs !== '' && rhs !== '') {
    const start = parseInt(lhs, 10);
    const end = parseInt(rhs, 10);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      return { start: Math.max(0, start), end: Math.min(end, fileSize - 1) };
    }
  }
  return null;
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

      const { stat, streamFile } = require('./vfs/composite');
      const s = await stat(realPath);
      if (!s) {
        res.writeHead(404);
        res.end();
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

      if (!rangeHeader) {
        sendHeaders(200, { 'Content-Length': String(fileSize) }, !isHead);
        if (!isHead) streamFile(realPath).pipe(res);
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
        // アーカイブ内ファイルの場合、部分的なストリーム出力は未対応(全体を出す)
        // 本物のファイルなら fs.createReadStream({start, end}) が理想だが、
        // ここでは streamFile(realPath) をそのまま pipe する。
        streamFile(realPath).pipe(res);
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
