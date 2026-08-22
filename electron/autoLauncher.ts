import { app } from 'electron';

export class AutoLauncher {
  public static enableAutoStart(): void {
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        openAsHidden: true,
        name: 'TokenGuard'
      });
      console.log('[AutoLauncher] Enabled auto-start on system boot');
    } catch (err) {
      console.error('[AutoLauncher] Failed to set login item:', err);
    }
  }

  public static disableAutoStart(): void {
    try {
      app.setLoginItemSettings({
        openAtLogin: false,
        name: 'TokenGuard'
      });
      console.log('[AutoLauncher] Disabled auto-start on system boot');
    } catch (err) {
      console.error('[AutoLauncher] Failed to disable login item:', err);
    }
  }

  public static isEnabled(): boolean {
    try {
      return app.getLoginItemSettings().openAtLogin;
    } catch {
      return false;
    }
  }
}
