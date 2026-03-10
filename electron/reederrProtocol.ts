import { protocol, net } from 'electron';
import { extname } from 'node:path';
import { readFile } from './vfs';

const MIME_MAP: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.jpe': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.tiff': 'image/tiff',
    '.tif': 'image/tiff',
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
    const m = rangeHeader.match(/^\s*bytes\s*=\s*(\d*)-(\d*)\s*$/);
    if (!m) return null;
    const lhs = m[1];
    const rhs = m[2];
    if (rhs !== undefined && rhs !== '' && lhs !== undefined && lhs !== '') {
        const start = parseInt(lhs, 10);
        const end = parseInt(rhs, 10);
        if (!isNaN(start) && !isNaN(end) && start <= end) {
            return { start: Math.max(0, start), end: Math.min(end, fileSize - 1) };
        }
    }
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
    return null;
}

export function registerReederrProtocol(): void {
    protocol.handle('reederr', async (request: Request) => {
        try {
            const url = new URL(request.url);

            if (url.hostname === 'get-media') {
                const vpathRaw = url.searchParams.get('path');
                if (!vpathRaw) return new Response('Bad Request: missing path', { status: 400 });

                // decodeURIComponent might throw URI malformed if the path contains raw %
                // or other invalid sequences. We try to decode but fallback to raw.
                // Note: URLSearchParams might have already decoded it partially.
                let vpath = vpathRaw;
                try {
                    // If vpathRaw contains %, it might be encoded. 
                    // But if it's already a valid file path with %, decodeURIComponent will fail.
                    if (vpathRaw.includes('%')) {
                        vpath = decodeURIComponent(vpathRaw);
                    }
                } catch {
                    vpath = vpathRaw;
                }

                const buf = await readFile(vpath);
                const fileSize = buf.byteLength;
                const contentType = getMimeType(vpath);

                const rangeHeader = request.headers.get('range') ?? request.headers.get('Range') ?? '';

                const baseHeaders: Record<string, string> = {
                    'Content-Type': contentType,
                    'Accept-Ranges': 'bytes',
                    'Access-Control-Allow-Origin': '*',
                };

                if (!rangeHeader) {
                    return new Response(buf, {
                        status: 200,
                        headers: {
                            ...baseHeaders,
                            'Content-Length': String(fileSize),
                        },
                    });
                }

                const range = parseRangeHeader(rangeHeader, fileSize);
                if (!range) {
                    return new Response(buf, {
                        status: 200,
                        headers: {
                            ...baseHeaders,
                            'Content-Length': String(fileSize),
                        },
                    });
                }

                const { start, end } = range;
                const chunkSize = end - start + 1;
                const slicedBuf = buf.slice(start, end + 1);

                return new Response(slicedBuf, {
                    status: 206,
                    headers: {
                        ...baseHeaders,
                        'Content-Length': String(chunkSize),
                        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    },
                });
            }

            return new Response('Not Found', { status: 404 });
        } catch (err) {
            console.error('[reederrProtocol] Error handling request:', err);
            return new Response('Internal Server Error', { status: 500 });
        }
    });
}
