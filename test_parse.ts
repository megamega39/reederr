import { parse7zListOutput } from './src/main/vfs/sevenZip';

const out = `7-Zip 26.00 (x64) : Copyright (c) 1999-2026 Igor Pavlov : 2026-02-12
Scanning the drive for archives:
1 file, 162471680 bytes (155 MiB)

Listing archive: C:\\Users\\megam\\Downloads\\[AI generated] bonno uma AI Gallery Part7 (Machikane Fukukitaru - Meisho Doto).zip

--
Path = C:\\Users\\megam\\Downloads\\[AI generated] bonno uma AI Gallery Part7 (Machikane Fukukitaru - Meisho Doto).zip
Type = zip
ERRORS:
Headers Error
Physical Size = 162471680
Characteristics = Local

----------
Path = 3131251_fb6730d302
Folder = +
Size = 0
Packed Size = 0
Modified = 2024-12-05 13:38:06
Created = 
Accessed = 
Attributes = D
Encrypted = -
Comment = 
CRC = 
Method = Store
Characteristics = Local
Host OS = 
Version = 10
Volume Index = 0
Offset = 0

Path = 3131251_fb6730d302\\0001001007_thumb.webp
Folder = -
Size = 197770
Packed Size = 197835
Modified = 2024-12-05 13:38:06
Created = 
Accessed = 
Attributes = 
Encrypted = -
Comment = 
CRC = 4F8061DA
Method = Deflate
Characteristics = Local
Host OS = 
Version = 10
Volume Index = 0
Offset = 98`;

export function parse7zListOutput(stdout: string): any[] {
    const entries: any[] = [];
    const normalized = stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');

    let path = '';
    let size = 0;
    let mtime: number | undefined;
    let isDir = false;
    let isEncrypted = false;
    let isFirstPath = true; // BUG is here, because there's only 1 metadata path for this zip but might be multiple? Actually it's just 1 file metadata block. Wait, the output has just ONE `Path = <zip>` before `----------`.

    const pushEntry = (): void => {
        if (!path) return;
        if (isFirstPath) {
            isFirstPath = false;
            return;
        }
        try {
            // rejectZipSlip(path);
        } catch {
            return;
        }
        if (!isDir && path.endsWith('/')) isDir = true;
        entries.push({
            path,
            size: isDir ? 0 : size,
            mtime,
            isDirectory: isDir,
            isEncrypted,
        });
    };

    let startParsing = false;

    for (const line of lines) {
        if (line.trim() === '----------') {
            startParsing = true;
            continue;
        }
        if (!startParsing) continue;

        const colon = line.indexOf('=');
        if (colon < 0) continue;
        const key = line.slice(0, colon).trim();
        const value = line.slice(colon + 1).trim();

        if (key === 'Path') {
            pushEntry();
            path = value.replace(/\\/g, '/');
            size = 0;
            mtime = undefined;
            isDir = false;
            isEncrypted = false;
            continue;
        }
        switch (key) {
            case 'Size':
                size = parseInt(value, 10) || 0;
                break;
            case 'Folder':
                isDir = value === '+';
                break;
            case 'Modified':
                if (value) {
                    const d = new Date(value);
                    if (!isNaN(d.getTime())) mtime = d.getTime();
                }
                break;
            case 'Encrypted':
                isEncrypted = value === '+';
                break;
        }
    }
    pushEntry();

    return entries;
}

console.log(parse7zListOutput(out));
