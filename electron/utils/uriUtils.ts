/**
 * Safely decodes a URI component.
 * If the component contains a literal '%' that causes a URIError (URI malformed),
 * we fallback to a regex replacement that decodes valid %XX sequences and leaves
 * raw '%' characters intact.
 */
export function safeDecodeURIComponent(str: string | null | undefined): string {
    if (!str) return '';
    try {
        return decodeURIComponent(str);
    } catch {
        // Find every % followed by two hex digits. If it decodes, replace it.
        // If it throws or isn't a valid hex, leave it alone.
        return str.replace(/(%[0-9A-Fa-f]{2})+/g, (match) => {
            try {
                return decodeURIComponent(match);
            } catch {
                return match;
            }
        });
    }
}

/**
 * Parses HTTP Range header
 */
export function parseRangeHeader(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
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
