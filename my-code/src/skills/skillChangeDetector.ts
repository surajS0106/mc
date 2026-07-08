import { watch, type FSWatcher } from 'chokidar';
import path from 'path';
import fs from 'fs';
import os from 'os';

export interface SkillChangeCallbacks {
  onSkillAdded?: (filepath: string) => void;
  onSkillChanged?: (filepath: string) => void;
  onSkillRemoved?: (filepath: string) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export class SkillChangeDetector {
  private watcher: FSWatcher | null = null;
  private watchPaths: string[] = [];

  constructor(
    private cwd: string,
    private callbacks: SkillChangeCallbacks,
  ) {}

  public start(): void {
    if (this.watcher) {
      return;
    }

    const userSkillsDir = path.join(os.homedir(), '.my-code', 'skills');
    const projectSkillsDir = path.join(this.cwd, '.my-code', 'skills');

    this.watchPaths = [userSkillsDir, projectSkillsDir].filter((dir) => {
      try {
        return fs.statSync(dir).isDirectory();
      } catch {
        return false;
      }
    });

    if (this.watchPaths.length === 0) {
      this.callbacks.onReady?.();
      return;
    }

    this.watcher = watch(this.watchPaths, {
      ignored: /(^|[\/\\])\../, // ignore hidden files
      persistent: true,
      ignoreInitial: true, // only watch for new changes
    });

    this.watcher
      .on('add', (filepath) => {
        if (filepath.endsWith('.md')) {
          this.callbacks.onSkillAdded?.(filepath);
        }
      })
      .on('change', (filepath) => {
        if (filepath.endsWith('.md')) {
          this.callbacks.onSkillChanged?.(filepath);
        }
      })
      .on('unlink', (filepath) => {
        if (filepath.endsWith('.md')) {
          this.callbacks.onSkillRemoved?.(filepath);
        }
      })
      .on('error', (error) => {
        this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
      })
      .on('ready', () => {
        this.callbacks.onReady?.();
      });
  }

  public stop(): void {
    if (this.watcher) {
      void this.watcher.close();
      this.watcher = null;
    }
  }

  public getWatchedPaths(): string[] {
    return this.watchPaths;
  }
}
