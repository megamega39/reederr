import { protocol } from 'electron';
import { extname } from 'node:path';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { readFile, stat, streamFile } from './vfs';
import { splitArchivePath } from './vfs/utils';
import { MIME_MAP } from './vfs/constants';
import { parseRangeHeader } from './utils/uriUtils';

function getMimeType(path: string): string {
    const ext = extname(path).toLowerCase();
    return MIME_MAP[ext] ?? 'application/octet-stream';
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
                    if (!stats || stats.isDirectory) {
                        return new Response(stats?.isDirectory ? 'Forbidden: Directory' : 'Not Found', { status: stats?.isDirectory ? 403 : 404 });
                    }
                    const fileSize = stats.size;
                    const contentType = getMimeType(vpath);
                    const isMediaStream = contentType.startsWith('video/') || contentType.startsWith('audio/');
                    const isArchive = !!splitArchivePath(vpath);

                    // Generate ETag based on size and mtime
                    const etag = `W/"${fileSize}-${stats.mtime || 0}"`;
                    
                    const baseHeaders: Record<string, string> = {
                        'Content-Type': contentType,
                        'Accept-Ranges': 'bytes',
                        'Access-Control-Allow-Origin': '*',
                        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
                        'ETag': etag,
                    };

                    // Handle Conditional Request (304 Not Modified)
                    const ifNoneMatch = request.headers.get('if-none-match') ?? request.headers.get('If-None-Match');
                    if (ifNoneMatch === etag) {
                        return new Response(null, { status: 304, headers: baseHeaders });
                    }

                    // Use streaming for all files (images, video, audio) to minimize memory usage.
                    // vfs.streamFile handles both local files and 7-Zip pipes for archives.
                    const rangeHeader = request.headers.get('range') ?? request.headers.get('Range') ?? '';

                    // For video/audio or large files, we support range if possible.
                    // Note: Archive streams (7z pipe) don't support seeking well, so we ignore range for them.
                    if (rangeHeader && fileSize > 0 && !isArchive) {
                        const range = parseRangeHeader(rangeHeader, fileSize);
                        if (range) {
                            const { start, end } = range;
                            const chunkSize = end - start + 1;
                            const stream = createReadStream(vpath, { start, end });
                            request.signal.addEventListener('abort', () => stream.destroy());

                            return new Response(Readable.toWeb(stream) as ReadableStream, {
                                status: 206, // Partial Content
                                headers: {
                                    ...baseHeaders,
                                    'Content-Length': String(chunkSize),
                                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                                },
                            });
                        }
                    }

                    // Standard streaming response (for images or non-seekable archive streams)
                    const stream = streamFile(vpath);
                    request.signal.addEventListener('abort', () => stream.destroy());

                    return new Response(Readable.toWeb(stream) as ReadableStream, {
                        status: 200,
                        headers: {
                            ...baseHeaders,
                            ...(fileSize > 0 ? { 'Content-Length': String(fileSize) } : {}),
                        },
                    });
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
