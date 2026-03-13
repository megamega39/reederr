export type Result<T, E = string> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

export const Ok = <T>(value: T): Result<T, any> => ({ ok: true, value });
export const Err = <E>(error: E): Result<any, E> => ({ ok: false, error });

export function isOk<T, E>(res: Result<T, E>): res is { ok: true; value: T } {
  return res.ok;
}

export function isErr<T, E>(res: Result<T, E>): res is { ok: false; error: E } {
  return !res.ok;
}
