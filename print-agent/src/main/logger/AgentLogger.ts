import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { AgentLogEntry } from '../../renderer/types/agent.js';

const require = createRequire(import.meta.url);
let app: any = null;
try {
  const electron = require('electron');
  app = electron?.app || null;
} catch {
  app = null;
}

export class AgentLogger {
  private static instance: AgentLogger;
  private logDirectory: string;
  private currentLogFile: string;
  private memoryLogs: AgentLogEntry[] = [];
  private maxMemoryLogs = 200;
  private broadcastListener?: (entry: AgentLogEntry) => void;

  private constructor() {
    try {
      const basePath = app ? app.getPath('userData') : path.join(process.cwd(), '.printflow_agent');
      this.logDirectory = path.join(basePath, 'logs');
      if (!fs.existsSync(this.logDirectory)) {
        fs.mkdirSync(this.logDirectory, { recursive: true });
      }
    } catch {
      this.logDirectory = path.join(process.cwd(), 'logs');
      if (!fs.existsSync(this.logDirectory)) {
        try {
          fs.mkdirSync(this.logDirectory, { recursive: true });
        } catch {
          // Fallback ignore
        }
      }
    }

    const dateStr = new Date().toISOString().split('T')[0];
    this.currentLogFile = path.join(this.logDirectory, `agent_${dateStr}.log`);
  }

  public static getInstance(): AgentLogger {
    if (!AgentLogger.instance) {
      AgentLogger.instance = new AgentLogger();
    }
    return AgentLogger.instance;
  }

  public setBroadcastListener(listener: (entry: AgentLogEntry) => void): void {
    this.broadcastListener = listener;
  }

  private append(level: AgentLogEntry['level'], category: AgentLogEntry['category'], message: string, details?: Record<string, any>): void {
    const entry: AgentLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      details
    };

    // Keep in memory buffer
    this.memoryLogs.unshift(entry);
    if (this.memoryLogs.length > this.maxMemoryLogs) {
      this.memoryLogs.pop();
    }

    // Persist to disk
    const logLine = `[${entry.timestamp}] [${entry.level}] [${entry.category}] ${entry.message}${
      details ? ' ' + JSON.stringify(details) : ''
    }\n`;

    try {
      fs.appendFileSync(this.currentLogFile, logLine, 'utf8');
    } catch {
      // Ignore disk write failure
    }

    // Console output in dev
    console.log(`[${entry.level}] [${entry.category}] ${entry.message}`);

    // Stream to renderer
    if (this.broadcastListener) {
      try {
        this.broadcastListener(entry);
      } catch {
        // Ignore IPC broadcast error
      }
    }
  }

  public info(category: AgentLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.append('INFO', category, message, details);
  }

  public warn(category: AgentLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.append('WARN', category, message, details);
  }

  public error(category: AgentLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.append('ERROR', category, message, details);
  }

  public debug(category: AgentLogEntry['category'], message: string, details?: Record<string, any>): void {
    this.append('DEBUG', category, message, details);
  }

  public getRecentLogs(): AgentLogEntry[] {
    return [...this.memoryLogs];
  }

  public clear(): void {
    this.memoryLogs = [];
  }

  public getLogFilePath(): string {
    return this.currentLogFile;
  }

  public getSanitizedExport(): string {
    const entries = this.memoryLogs.map(({ timestamp, level, category, message }) => ({
      timestamp,
      level,
      category,
      message: message
        .replace(/\bagt_tok_[A-Za-z0-9_-]+\b/g, '[REDACTED TOKEN]')
        .replace(/(Bearer\s+)[^\s"']+/gi, '$1[REDACTED]')
    }));
    return JSON.stringify(entries, null, 2);
  }
}

export const logger = AgentLogger.getInstance();
