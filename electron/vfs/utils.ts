export const ARCHIVE_EXT_REGEX = /\.(zip|cbz|rar|cbr|7z|tar|gz|bz2|xz|iso|lzh|lha)!/i;

/**
 * Splits an archive path into the absolute path of the archive file and the internal path.
 * e.g., "C:/path/to/archive!.zip!inner/folder/image.webp" -> ["C:/path/to/archive!.zip", "inner/folder/image.webp"]
 * Returns null if the path is not a valid archive path containing the '!' delimiter after a known extension.
 */
export function splitArchivePath(path: string): [archivePath: string, innerPath: string] | null {
    const match = path.match(ARCHIVE_EXT_REGEX);
    if (!match) return null;

    // match.index is the start of the matched string e.g. '.zip!'
    // so the split index is at match.index + match[0].length - 1
    const sepIdx = match.index! + match[0].length - 1;
    const archivePath = path.slice(0, sepIdx);
    const innerPath = path.slice(sepIdx + 1);
    return [archivePath, innerPath];
}

export function isArchiveExtension(path: string): boolean {
    return /\.(zip|cbz|rar|cbr|7z|tar|gz|bz2|xz|iso|lzh|lha)$/i.test(path);
}
