import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';
import { get7zPath } from '../sevenZipPath';

const DEFAULT_TIMEOUT_MS = 60_000;
const WINDOWS_MAX_PATH = 260;

/** Windows で MAX_PATH(260文字) 超のパスに \\?\ プレフィックスを付与 */
function toLongPathIfNeeded(path: string): string {
  if (platform() !== 'win32') return path;
  if (path.length < WINDOWS_MAX_PATH) return path;
  if (path.startsWith('\\\\?\\')) return path; // 既に付いている
  if (path.startsWith('\\\\') && !path.startsWith('\\\\?\\')) {
    return '\\\\?\\UNC\\' + path.slice(2).replace(/\//g, '\\');
  }
  return '\\\\?\\' + path.replace(/\//g, '\\');
}
const MAX_SINGLE_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const SIZE_THRESHOLD_FOR_TEMP_EXTRACT = 200 * 1024 * 1024; // 200MB

export interface SevenZipEntry {
  path: string;
  size: number;
  mtime?: number;
  isDirectory: boolean;
  isEncrypted?: boolean;
}

export interface ListResult {
  entries: SevenZipEntry[];
  totalSize: number;
}

function rejectZipSlip(innerPath: string): void {
  const normalized = innerPath.replace(/\\/g, '/');
  if (normalized.includes('..') || normalized.startsWith('/') || /^[a-z]:/i.test(normalized)) {
    throw new Error('Invalid path (ZipSlip)');
  }
}



/**
 * 7z l -slt の出力をパースする。
 * 各エントリは「Path = ...」で始まる。空行で区切られない場合もあるため、
 * 「Path = 」の出現ごとに新しいエントリとして解析する。
 * 改行は \n または \r\n の両方に対応。
 */
export function parse7zListOutput(stdout: string): SevenZipEntry[] {
  const entries: SevenZipEntry[] = [];
  const normalized = stdout.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n');

  let path = '';
  let size = 0;
  let mtime: number | undefined;
  let isDir = false;
  let isEncrypted = false;
  let startParsing = false;
  const seenPaths = new Set<string>();

  const pushEntry = (): void => {
    if (!path) return;
    if (seenPaths.has(path)) return;
    seenPaths.add(path);
    try {
      rejectZipSlip(path);
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

export interface Run7zOptions {
  timeout?: number;
  timeoutPerMb?: number;
}

/**
 * 7z コマンドを実行する。
 */
export function run7z(
  args: string[],
  options: Run7zOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  const exe = get7zPath();
  if (!exe) {
    return Promise.reject(new Error('7-Zip (7z.exe) not found. Please place 7z.exe and 7z.dll in tools/7zip.'));
  }

  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;

  console.log('[7z Command Args]:', args);

  return new Promise((resolvePromise, reject) => {
    const proc = spawn(exe, args, {
      windowsHide: true,
      shell: false,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    proc.stdout?.on('data', (chunk: Buffer | string) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    proc.stderr?.on('data', (chunk: Buffer | string) => {
      stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('7-Zip execution timed out'));
    }, timeout);

    function decodeOutput(buf: Buffer): string {
      if (buf.length === 0) return '';
      return buf.toString('utf8');
    }

    proc.on('close', (code) => {
      clearTimeout(timer);
      const rawStdout = Buffer.concat(stdoutChunks);
      const rawStderr = Buffer.concat(stderrChunks);
      const stdout = decodeOutput(rawStdout);
      const stderr = decodeOutput(rawStderr);
      const combined = (stderr || stdout || '').trim();
      const rawMsg = combined.toLowerCase();
      const isPasswordError =
        rawMsg.includes('wrong password') ||
        rawMsg.includes('enter password') ||
        rawMsg.includes('password:') ||
        (rawMsg.includes('encrypted') && (rawMsg.includes('password') || rawMsg.includes('enter')));

      if (isPasswordError) {
        reject(new Error('Encrypted archive. Password-protected archives are not supported.'));
        return;
      }

      if (code === 0 || code === 1 || code === 2) {
        resolvePromise({ stdout, stderr });
      } else {
        console.error('[7z Error Output]:', rawStderr.toString('utf8') || '(stderr empty)');
        if (rawStdout.length > 0) console.error('[7z Error Output] stdout:', stdout);
        reject(new Error(combined || `7-Zip exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      console.error('[7z Error Output] spawn error:', err);
      reject(err);
    });
  });
}

/**
 * 7z l -slt でアーカイブ内の全エントリを取得。
 * -sccUTF-8 で日本語ファイル名を正しく取得。
 * 絶対パスに正規化して Windows でのパス問題を回避。
 */
export async function listArchive(archivePath: string): Promise<SevenZipEntry[]> {
  const resolved = resolve(archivePath);
  if (!existsSync(resolved)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }
  const absPath = toLongPathIfNeeded(resolved);
  const { stdout } = await run7z(['l', '-slt', '-sccUTF-8', absPath]);
  return parse7zListOutput(stdout);
}

/**
 * 7z x -so で1ファイルを stdout に抽出（小さいファイル向け）。
 * バイナリ出力のため別実装。
 */
export async function extractToStdout(archivePath: string, innerPath: string): Promise<Buffer> {
  rejectZipSlip(innerPath);

  const exe = get7zPath();
  if (!exe) {
    throw new Error('7-Zip (7z.exe) not found.');
  }

  const resolved = resolve(archivePath);
  if (!existsSync(resolved)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }
  const absPath = toLongPathIfNeeded(resolved);

  // -i!path で厳密にファイルを指定
  const args = ['x', '-so', '-i!' + innerPath, absPath];
  console.log('[7z Command Args]:', args);

  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, {
      windowsHide: true,
      shell: false,
    });

    const chunks: Buffer[] = [];
    proc.stdout?.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > MAX_SINGLE_FILE_BYTES) {
        proc.kill('SIGTERM');
        reject(new Error('File too large (exceeds 2GB limit)'));
      }
    });

    let stderr = '';
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error('7-Zip execution timed out'));
    }, 30_000);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const rawStderr = (stderr || '').trim();
      const rawMsg = rawStderr.toLowerCase();
      const isPasswordError =
        rawMsg.includes('wrong password') ||
        rawMsg.includes('enter password') ||
        rawMsg.includes('password:') ||
        (rawMsg.includes('encrypted') && (rawMsg.includes('password') || rawMsg.includes('enter')));

      if (isPasswordError) {
        reject(new Error('Encrypted archive. Password-protected archives are not supported.'));
        return;
      }

      if (code === 0 || code === 1 || code === 2) {
        const buf = Buffer.concat(chunks);
        resolve(buf);
      } else {
        console.error('[7z Error Output]:', rawStderr || '(stderr empty)');
        reject(new Error(rawStderr || `7-Zip exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      console.error('[7z Error Output] spawn error:', err);
      reject(err);
    });
  });
}

/**
 * 動画/音声や巨大ファイル向けに temp に1ファイル抽出。
 * 7z は -o で指定したディレクトリ直下にパス構造を再現する。
 */
export async function extractToTemp(
  archivePath: string,
  innerPath: string,
  destDir: string
): Promise<string> {
  rejectZipSlip(innerPath);

  const resolved = resolve(archivePath);
  if (!existsSync(resolved)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }
  const absPath = toLongPathIfNeeded(resolved);
  const destLong = toLongPathIfNeeded(resolve(destDir));

  const destArg = destLong.endsWith('\\') ? destLong : destLong + '\\';
  // -i!path で厳密にファイルを指定
  await run7z(['x', '-y', `-o${destArg}`, '-i!' + innerPath, absPath], {
    timeout: 120_000,
  });

  const normalized = innerPath.replace(/\\/g, '/');
  const extractedPath = join(destDir, normalized);
  if (existsSync(extractedPath)) {
    return extractedPath;
  }
  const basename = normalized.replace(/.*\//, '');
  return join(destDir, basename);
}

export function isLargeFile(size: number): boolean {
  return size > SIZE_THRESHOLD_FOR_TEMP_EXTRACT;
}

export function isMediaRequiringTempExtract(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  const videoExt = ['.mp4', '.webm', '.avi', '.mkv', '.mov', '.wmv', '.m4v'];
  const audioExt = ['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'];
  return videoExt.includes(ext) || audioExt.includes(ext);
}
