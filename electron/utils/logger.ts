import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

type LogLevel = 'info' | 'warn' | 'error';

class Logger {
  private logPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.logPath = path.join(userDataPath, 'reederr.log');
  }

  private write(level: LogLevel, message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => 
      arg instanceof Error ? arg.stack : JSON.stringify(arg)
    ).join(' ');
    
    const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message} ${formattedArgs}\n`;
    
    try {
      fs.appendFileSync(this.logPath, logLine);
      // Also output to console for development
      if (level === 'error') {
        console.error(logLine.trim());
      } else {
        console.log(logLine.trim());
      }
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  info(message: string, ...args: any[]) {
    this.write('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.write('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.write('error', message, ...args);
  }
}

export const logger = new Logger();
