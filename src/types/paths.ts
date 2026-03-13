/**
 * Branded types for path safety.
 * This prevents accidental mix-ups between Physical (local) and Virtual (archive-internal) paths.
 */

export type PhysicalPath = string & { readonly _brand: unique symbol };
export type VirtualPath = string & { readonly _brand: unique symbol };

/**
 * A union representing any path handled by the application.
 */
export type AnyPath = PhysicalPath | VirtualPath;

/**
 * Type guards and converters.
 * Note: These should be used judiciously at the I/O boundaries.
 */

export function toPhysicalPath(path: string): PhysicalPath {
  return path as PhysicalPath;
}

export function toVirtualPath(path: string): VirtualPath {
  return path as VirtualPath;
}

export function isVirtualPath(path: string): path is VirtualPath {
  return path.includes('!');
}

export function toAnyPath(path: string): AnyPath {
  return path as AnyPath;
}
