import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { platform } from 'node:os';
import { get7zPath } from '../sevenZipPath';
import { logger } from '../utils/logger';
import { toLongPathIfNeeded } from '../utils/longPath';

const DEFAULT_TIMEOUT_MS = 60_000;
const WINDOWS_MAX_PATH = 260;

// The local definition of toLongPathIfNeeded is removed as per instruction to use the utility.
// function toLongPathIfNeeded(path: string): string {
//   if (platform() !== 'win32') return path;
//   if (path.length < WINDOWS_MAX_PATH) return path;
//   if (path.startsWith('\\\\?\\')) return path; // 既に付いている
//   if (path.startsWith('\\\\') && !path.startsWith('\\\\?\\')) {
//     return '\\\\?\\UNC\\' + path.slice(2).replace(/\//g, '\\');
//   }
//   return '\\\\?\\' + path.replace(/\//g, '\\');
// }
const MAX_SINGLE_FILE_BYTES = 2 * 1024 * 1024 * 2024; // 2GB

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
  
  // Standard 7-Zip keys we care about
  const keys = [
    'Path', 'Size', 'Packed Size', 'Modified', 'Created', 'Accessed', 
    'Attributes', 'Encrypted', 'Comment', 'CRC', 'Method', 'Block', 
    'Folder', 'Version', 'Volume Index', 'Offset', 'Characteristics', 
    'Local Host OS', 'CPU', 'Host OS', 'Type', 'Physical Size', 
    'Headers Size', 'Method', 'Cluster Size', 'Free Space', 'Total Size', 
    'Checksum', 'Virtual Size', 'Solid', 'Blocks', 'Streams', 'Files', 'Folders'
  ];
  
  const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
  const keysPattern = sortedKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  
  // 1. Normalize by inserting newlines before keys where whitespace exists
  // This helps when multiple lines are merged into one.
  const processed = stdout.replace(new RegExp(`(\\s+)(?=(?:${keysPattern})\\s*=)`, 'g'), '\n');
  
  // 2. Parse property by property, using duplicate keys as a separator
  const lines = processed.split('\n');
  let currentEntry: Record<string, string> = {};

  for (const line of lines) {
    const colon = line.indexOf('=');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (!key) continue;

    // Use duplicate key as a delimiter for a new entry (if we already have a Path)
    if (currentEntry[key] !== undefined) {
      if (currentEntry['Path']) {
        pushProcessedEntry(entries, currentEntry);
        currentEntry = {};
      }
    }
    currentEntry[key] = value;
  }
  
  if (Object.keys(currentEntry).length > 0) {
    pushProcessedEntry(entries, currentEntry);
  }

  return entries;
}

function pushProcessedEntry(entries: SevenZipEntry[], data: Record<string, string>) {
  const path = data['Path']?.replace(/\\/g, '/');
  if (!path) return;

  try {
    rejectZipSlip(path);
    const isDir = data['Folder'] === '+' || path.endsWith('/');
    const size = parseInt(data['Size'], 10) || 0;
    let mtime: number | undefined;
    if (data['Modified']) {
      const d = new Date(data['Modified']);
      if (!isNaN(d.getTime())) mtime = d.getTime();
    }

    entries.push({
      path,
      size: isDir ? 0 : size,
      mtime,
      isDirectory: isDir,
      isEncrypted: data['Encrypted'] === '+',
    });
  } catch {
    // Skip invalid
  }
}

export interface Run7zOptions {
  timeout?: number;
  timeoutPerMb?: number;
}

function isPasswordError(stderr: string, stdout: string): boolean {
  const combined = (stderr + stdout).toLowerCase();
  return (
    combined.includes('wrong password') ||
    combined.includes('enter password') ||
    combined.includes('password:') ||
    (combined.includes('encrypted') && (combined.includes('password') || combined.includes('enter')))
  );
}

/**
 * 7z コマンドを実行する低レベルヘルパー。
 */
export async function run7zBase(
  args: string[],
  options: { timeout?: number; binary?: boolean } = {}
): Promise<{ stdout: string | Buffer; stderr: string }> {
  const exe = get7zPath();
  if (!exe) {
    throw new Error('7-Zip (7z.exe) not found. Please place 7z.exe and 7z.dll in tools/7zip.');
  }

  const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
  const proc = spawn(exe, args, { 
    windowsHide: true, 
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  return new Promise((resolve, reject) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutLength = 0;

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      stdoutLength += chunk.length;
      if (options.binary && stdoutLength > MAX_SINGLE_FILE_BYTES) {
        proc.kill('SIGTERM');
        reject(new Error('File too large (exceeds 2GB limit)'));
      }
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    const timer = setTimeout(() => {
      if (proc.exitCode === null) {
        logger.warn(`[7z Base] 7-Zip timed out after ${timeout}ms. Killing process: ${args.join(' ')}`);
        proc.kill('SIGKILL');
      }
      reject(new Error('7-Zip execution timed out'));
    }, timeout);

    proc.on('close', (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      const stdoutRaw = Buffer.concat(stdoutChunks);

      if (isPasswordError(stderr, options.binary ? '' : stdoutRaw.toString('utf8'))) {
        reject(new Error('Encrypted archive. Password-protected archives are not supported.'));
        return;
      }

      if (code === 0 || code === 1 || code === 2) {
        const stdoutStr = options.binary ? '' : stdoutRaw.toString('utf8');
        if (stdoutStr) {
          const errorMatch = stdoutStr.match(/Errors: ([1-9]\d*)/);
          const warnMatch = stdoutStr.match(/Warnings: ([1-9]\d*)/);
          if (errorMatch) {
            logger.warn(`[7z Base] 7-Zip reported ${errorMatch[1]} errors in output (Code ${code}). Stdout: ${stdoutStr.slice(0, 500)}...`);
            if (stderr) logger.warn(`[7z Base] Stderr: ${stderr}`);
          }
          if (warnMatch) {
            logger.warn(`[7z Base] 7-Zip reported ${warnMatch[1]} warnings in output (Code ${code}).`);
          }
        }
        resolve({
          stdout: options.binary ? stdoutRaw : stdoutRaw.toString('utf8'),
          stderr,
        });
      } else {
        const rawMsg = (stderr || stdoutRaw.toString('utf8') || '').trim();
        const truncatedMsg = rawMsg.length > 2000 ? rawMsg.slice(0, 2000) + '... [output truncated]' : rawMsg;
        const msg = `7-Zip failed (code ${code}): ${truncatedMsg || 'Unknown error'}`;
        logger.error(`[7z Base] ERROR: ${msg}`);
        reject(new Error(msg));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * 7z コマンドを実行する。
 */
export async function run7z(
  args: string[],
  options: Run7zOptions = {}
): Promise<{ stdout: string; stderr: string }> {
  logger.info(`[7z Command Args]: ${args.join(' ')}`);
  const result = await run7zBase(args, { timeout: options.timeout });
  return { stdout: result.stdout as string, stderr: result.stderr };
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
  const { stdout } = await run7z(['l', '-y', '-slt', '-sccUTF-8', absPath]);
  return parse7zListOutput(stdout);
}

/**
 * 7z x -so で1ファイルを stdout に抽出（小さいファイル向け）。
 * バイナリ出力のため別実装。
 */
export async function extractToStdout(archivePath: string, innerPath: string): Promise<Buffer> {
  rejectZipSlip(innerPath);
  const resolved = resolve(archivePath);
  if (!existsSync(resolved)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }
  const absPath = toLongPathIfNeeded(resolved);
  
  // Use 'e' (extract without paths) instead of 'x' for stdout extraction of a single file
  // to avoid potential issues with directory structures in patterns.
  const args = ['e', '-so', '-y', '-bb0', '-sccUTF-8', '-i!' + innerPath, absPath];
  logger.info(`[7z Extract Args]: ${args.join(' ')}`);

  try {
    const result = await run7zBase(args, { binary: true, timeout: 30_000 });
    const buf = result.stdout as Buffer;
    
    if (buf.length > 0) {
      const magic = buf.slice(0, 12).toString('hex');
      logger.debug(`[7z Extract Success] ${innerPath} (${buf.length} bytes, magic: ${magic})`);
    } else {
      logger.warn(`[7z Extract Success] ${innerPath} produced 0 bytes.`);
    }
    return buf;
  } catch (err) {
    logger.error(`[7z Extract Failed] ${innerPath}:`, err);
    throw err;
  }
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
  await run7z(['x', '-y', `-o${destArg}`, '-bb0', '-sccUTF-8', '-i!' + innerPath, absPath], {
    timeout: 120_000,
  });

  const normalized = innerPath.replace(/\\/g, '/');
  const base = normalized.split('/').pop() || normalized;
  
  const possiblePaths = [
    join(destDir, normalized),
    join(destDir, base)
  ];

  for (const p of possiblePaths) {
    const fullP = toLongPathIfNeeded(p);
    if (existsSync(fullP)) {
      const { statSync } = await import('node:fs');
      if (statSync(fullP).isDirectory()) {
         continue; // Keep searching, we want the file
      }
      return p;
    }
  }

  throw new Error(`Failed to extract file from archive: ${innerPath} not found as a file in ${destDir} after extraction.`);
}

/**
 * 7z x -y -oDEST -i!PATH1 -i!PATH2 ... ARCHIVE で複数ファイルを一括抽出。
 */
export async function extractMultipleToTemp(
  archivePath: string,
  innerPaths: string[],
  destDir: string
): Promise<string[]> {
  if (innerPaths.length === 0) return [];

  const resolved = resolve(archivePath);
  if (!existsSync(resolved)) {
    throw new Error(`Archive not found: ${archivePath}`);
  }
  const absPath = toLongPathIfNeeded(resolved);
  const destLong = toLongPathIfNeeded(resolve(destDir));
  const destArg = destLong.endsWith('\\') ? destLong : destLong + '\\';

  // Build include arguments for each path
  const includeArgs = innerPaths.map(p => {
    rejectZipSlip(p);
    return '-i!' + p;
  });

  const args = ['x', '-y', `-o${destArg}`, '-bb0', '-sccUTF-8', ...includeArgs, absPath];
  logger.info(`[7z Batch Extract Args]: ${args.join(' ')}`);

  await run7z(args, { timeout: Math.max(120_000, innerPaths.length * 10_000) });

  return innerPaths.map(p => {
    const normalized = p.replace(/\\/g, '/');
    const base = normalized.split('/').pop() || normalized;
    
    const possiblePaths = [
      join(destDir, normalized),
      join(destDir, base)
    ];

    for (const pathCandidate of possiblePaths) {
      if (existsSync(toLongPathIfNeeded(pathCandidate))) {
        return pathCandidate;
      }
    }
    
    logger.warn(`[7z Batch Extract] File not found after extraction (potentially archive error): ${p} in ${destDir}`);
    return null as any; // Cast for now, but really we should allow nulls in return type
  });
}
import { SIZE_THRESHOLD_FOR_TEMP_EXTRACT, VIDEO_EXT, AUDIO_EXT } from './constants';

export function isLargeFile(size: number): boolean {
  return size > SIZE_THRESHOLD_FOR_TEMP_EXTRACT;
}

export function isMediaRequiringTempExtract(path: string): boolean {
  const ext = path.slice(path.lastIndexOf('.')).toLowerCase();
  return VIDEO_EXT.has(ext) || AUDIO_EXT.has(ext);
}

/**
 * 動画/音声向けに 7z x -so でストリームとして抽出。
 */
export function extractToStream(archivePath: string, innerPath: string): Readable {
  rejectZipSlip(innerPath);

  const exe = get7zPath();
  if (!exe) {
    throw new Error('7-Zip (7z.exe) not found.');
  }

  const resolved = resolve(archivePath);
  const absPath = toLongPathIfNeeded(resolved);

  // -i!path で厳密にファイルを指定
  const args = ['x', '-so', '-bb0', '-sccUTF-8', '-i!' + innerPath, absPath];
  console.log('[7z Stream Command]: 7z', args.join(' '));

  const proc = spawn(exe, args, {
    windowsHide: true,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const stream = proc.stdout;

  proc.stderr?.on('data', (chunk: Buffer) => {
    const msg = chunk.toString('utf8').toLowerCase();
    // 実際のエラーメッセージを識別してストリームを破棄
    if (msg.includes('error') || msg.includes('wrong password') || msg.includes('cannot open')) {
      logger.error(`[7z Stream Error Output]: ${msg.trim()}`);
      stream.destroy(new Error(msg.trim()));
    }
  });

  // Ensure process is killed when stream is closed or destroyed
  const cleanup = () => {
    if (proc.exitCode === null) {
      logger.debug(`[7z Stream] Terminating process for ${innerPath} due to stream closure.`);
      proc.kill('SIGKILL'); // Use SIGKILL for faster cleanup in these cases
    }
  };

  stream.on('close', cleanup);
  stream.on('error', cleanup);

  proc.on('error', (err) => {
    logger.error(`[7z Stream] Process error for ${innerPath}:`, err);
    stream.destroy(err);
  });

  proc.on('close', (code) => {
    // Treat code 2 as fatal error. Code 1 is warning (often ignored).
    if (code !== 0 && code !== 1) {
      stream.destroy(new Error(`7-Zip exited with code ${code}`));
    }
  });

  return stream;
}
