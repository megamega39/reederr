import { ChildProcess, spawn, exec, SpawnOptions, ExecOptions } from 'node:child_process';
import { setPriority, constants } from 'node:os';
import { logger } from './logger';

/**
 * Manages external processes to ensure they are tracked and cleaned up properly.
 */
export class ExternalProcessManager {
  private activeProcesses = new Set<ChildProcess>();

  /**
   * Spawns a new process and tracks it.
   */
  spawn(command: string, args: string[], options: SpawnOptions & { priority?: number } = {}): ChildProcess {
    const { priority, ...spawnOptions } = options;
    const proc = spawn(command, args, spawnOptions);
    this.track(proc, `${command} ${args.join(' ')}`);
    
    if (priority !== undefined && proc.pid) {
      try {
        setPriority(proc.pid, priority);
      } catch (err) {
        logger.error(`[ProcessManager] Failed to set priority ${priority} for pid ${proc.pid}:`, err);
      }
    }
    
    return proc;
  }

  /**
   * Executes a command in a shell and tracks the process.
   */
  exec(command: string, options: ExecOptions & { priority?: number } = {}, callback?: (error: any, stdout: any, stderr: any) => void): ChildProcess {
    const { priority, ...execOptions } = options;
    const proc = exec(command, execOptions, callback as any);
    this.track(proc, command);

    if (priority !== undefined && proc.pid) {
      try {
        setPriority(proc.pid, priority);
      } catch (err) {
        logger.error(`[ProcessManager] Failed to set priority ${priority} for pid ${proc.pid}:`, err);
      }
    }

    return proc;
  }

  /**
   * Adds a process to the tracking list.
   */
  private track(proc: ChildProcess, label: string) {
    this.activeProcesses.add(proc);
    
    proc.on('exit', (code, signal) => {
      this.activeProcesses.delete(proc);
      if (code !== 0 && code !== null) {
        logger.debug(`[ProcessManager] Process exited with code ${code}: ${label.slice(0, 100)}`);
      }
    });

    proc.on('error', (err) => {
      this.activeProcesses.delete(proc);
      logger.error(`[ProcessManager] Process error: ${label.slice(0, 100)}`, err);
    });
  }

  /**
   * Kills all active processes. Should be called on app quit.
   */
  killAll() {
    if (this.activeProcesses.size === 0) return;
    
    logger.info(`[ProcessManager] Killing ${this.activeProcesses.size} active processes...`);
    for (const proc of this.activeProcesses) {
      if (proc.exitCode === null) {
        try {
          // SIGKILL (9) is used to ensure it dies immediately on quit
          proc.kill('SIGKILL');
        } catch (err) {
          logger.error(`[ProcessManager] Failed to kill process ${proc.pid}:`, err);
        }
      }
    }
    this.activeProcesses.clear();
  }

  /**
   * Constants for OS priorities.
   */
  static Priorities = {
    LOW: constants.priority.PRIORITY_LOW,
    BELOW_NORMAL: constants.priority.PRIORITY_BELOW_NORMAL,
    NORMAL: constants.priority.PRIORITY_NORMAL,
    ABOVE_NORMAL: constants.priority.PRIORITY_ABOVE_NORMAL,
    HIGH: constants.priority.PRIORITY_HIGH,
    HIGHEST: constants.priority.PRIORITY_HIGHEST,
  };
}

// Export a singleton instance if needed, or instantiate in main.ts
export const processManager = new ExternalProcessManager();
