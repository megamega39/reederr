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
