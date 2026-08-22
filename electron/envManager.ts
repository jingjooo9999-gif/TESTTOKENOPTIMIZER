import { exec } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';

export class EnvManager {
  private port: number;

  constructor(port = 8080) {
    this.port = port;
  }

  /**
   * Automatically sets system-wide user environment variables for Windows & Mac/Linux
   */
  public async autoConfigure(): Promise<{ success: boolean; message: string }> {
    const platform = os.platform();

    if (platform === 'win32') {
      return this.configureWindows();
    } else if (platform === 'darwin' || platform === 'linux') {
      return this.configureUnix();
    }

    return { success: false, message: 'Unsupported platform' };
  }

  private configureWindows(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      const psCommand = `[Environment]::SetEnvironmentVariable('OPENAI_BASE_URL', 'http://localhost:${this.port}/v1', 'User'); [Environment]::SetEnvironmentVariable('ANTHROPIC_BASE_URL', 'http://localhost:${this.port}', 'User')`;

      exec(`powershell -NoProfile -Command "${psCommand}"`, (err) => {
        if (err) {
          console.error('[EnvManager] Error setting Windows environment variables:', err);
          resolve({ success: false, message: err.message });
        } else {
          console.log('[EnvManager] Successfully set Windows environment variables');
          resolve({ success: true, message: 'Windows environment variables configured' });
        }
      });
    });
  }

  private configureUnix(): Promise<{ success: boolean; message: string }> {
    return new Promise((resolve) => {
      try {
        const homeDir = os.homedir();
        const exportLines = `\n# TokenGuard Local Optimizer Configuration\nexport OPENAI_BASE_URL="http://localhost:${this.port}/v1"\nexport ANTHROPIC_BASE_URL="http://localhost:${this.port}"\n`;

        const zshrcPath = path.join(homeDir, '.zshrc');
        const bashrcPath = path.join(homeDir, '.bashrc');

        if (fs.existsSync(zshrcPath)) {
          const content = fs.readFileSync(zshrcPath, 'utf8');
          if (!content.includes('TokenGuard Local Optimizer')) {
            fs.appendFileSync(zshrcPath, exportLines);
          }
        }

        if (fs.existsSync(bashrcPath)) {
          const content = fs.readFileSync(bashrcPath, 'utf8');
          if (!content.includes('TokenGuard Local Optimizer')) {
            fs.appendFileSync(bashrcPath, exportLines);
          }
        }

        resolve({ success: true, message: 'Unix environment variables configured' });
      } catch (err: any) {
        resolve({ success: false, message: err.message });
      }
    });
  }
}
