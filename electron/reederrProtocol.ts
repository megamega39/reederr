import { protocol, net } from 'electron';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { readFile, stat, streamFile } from './vfs';
import { splitArchivePath } from './vfs/utils';

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

                // url.searchParams.get already decodes once. No need for second decodeURIComponent.
                const vpath = vpathRaw;

                // Optimization: for standard local files or archive entries
                try {
                    const stats = await stat(vpath);
                    const fileSize = stats?.size ?? 0;
                    const contentType = getMimeType(vpath);
                    const isMediaStream = contentType.startsWith('video/') || contentType.startsWith('audio/');
                    const isArchive = !!splitArchivePath(vpath);

                    const baseHeaders: Record<string, string> = {
                        'Content-Type': contentType,
                        'Accept-Ranges': 'bytes',
                        'Access-Control-Allow-Origin': '*',
                    };

                    // For video/audio, use streaming. 
                    // vfs.streamFile handles both local files and 7-Zip pipes for archives.
                    if (isMediaStream) {
                        const rangeHeader = request.headers.get('range') ?? request.headers.get('Range') ?? '';

                        // If we don't have a file size (common for some archive streams), 
                        // we still try to stream but without full Range support (instant start only).
                        if (!rangeHeader || fileSize === 0) {
                            const stream = streamFile(vpath);
                            return new Response(Readable.toWeb(stream) as ReadableStream, {
                                status: 200,
                                headers: {
                                    ...baseHeaders,
                                    ...(fileSize > 0 ? { 'Content-Length': String(fileSize) } : {}),
                                },
                            });
                        }

                        const range = parseRangeHeader(rangeHeader, fileSize);
                        if (!range) {
                            const stream = streamFile(vpath);
                            return new Response(Readable.toWeb(stream) as ReadableStream, {
                                status: 200,
                                headers: {
                                    ...baseHeaders,
                                    'Content-Length': String(fileSize),
                                },
                            });
                        }

                        // Local files support seeking. Archive streams are sequential (instant start).
                        if (!isArchive) {
                            const { start, end } = range;
                            const chunkSize = end - start + 1;
                            const stream = createReadStream(vpath, { start, end });

                            return new Response(Readable.toWeb(stream) as ReadableStream, {
                                status: 206, // Partial Content
                                headers: {
                                    ...baseHeaders,
                                    'Content-Length': String(chunkSize),
                                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                                },
                            });
                        } else {
                            // Archive stream: 7z pipe doesn't support seeking well.
                            // We just start from beginning for "instant playback".
                            const stream = streamFile(vpath);
                            return new Response(Readable.toWeb(stream) as ReadableStream, {
                                status: 200,
                                headers: {
                                    ...baseHeaders,
                                    'Content-Length': String(fileSize),
                                },
                            });
                        }
                    } else {
                        // For images and other small files, read into memory buffer.
                        // This is more robust for <img> tags in Chromium custom protocols.
                        const buf = await readFile(vpath);
                        return new Response(buf, {
                            status: 200,
                            headers: {
                                ...baseHeaders,
                                'Content-Length': String(buf.byteLength),
                            },
                        });
                    }
                } catch (err) {
                    console.error(`[reederrProtocol] Failed to handle path: ${vpath}`, err);
                }

                return new Response('Internal Server Error', { status: 500 });
            }

            return new Response('Not Found', { status: 404 });
        } catch (err) {
            console.error('[reederrProtocol] Error handling request:', err);
            return new Response('Internal Server Error', { status: 500 });
        }
    });
}
