import { app, BrowserWindow, Tray, Menu, nativeImage, NativeImage, ipcMain, shell, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import { createServer } from '../src/server';
import { statsStore } from '../src/state/statsStore';
import { EnvManager } from './envManager';
import { AutoLauncher } from './autoLauncher';

process.on('uncaughtException', (err) => {
  console.error('[TokenGuard Fatal Error]', err);
  try {
    fs.writeFileSync(path.join(process.cwd(), 'error.log'), `${new Date().toISOString()}: ${err.stack || err.message}\n`, { flag: 'a' });
  } catch {}
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const PORT = 8080;

function createTrayIcon(): NativeImage {
  // Create a 16x16 / 32x32 simple SVG green shield icon in base64
  const svgIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#10b981">
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
    </svg>
  `;
  const iconBuffer = Buffer.from(svgIcon);
  const icon = nativeImage.createFromBuffer(iconBuffer);
  return icon.resize({ width: 20, height: 20 });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 850,
    minHeight: 620,
    title: 'TokenGuard - AI Token Optimizer',
    backgroundColor: '#020617', // slate-950
    autoHideMenuBar: true,
    show: true,
    center: true,
    icon: createTrayIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.loadURL(`http://localhost:${PORT}/dashboard`);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
    mainWindow?.setAlwaysOnTop(true);
    setTimeout(() => {
      mainWindow?.setAlwaysOnTop(false);
    }, 800);
  });

  // Instead of quitting, minimize to system tray when closed
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
}

function setupTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('TokenGuard - AI Token Optimizer (Active on Port 8080)');

  const updateContextMenu = () => {
    const isAutoStart = AutoLauncher.isEnabled();
    const stats = statsStore.getStats();

    const contextMenu = Menu.buildFromTemplate([
      { label: `🛡️ TokenGuard Active (Port ${PORT})`, enabled: false },
      { label: `💰 Saved: $${stats.totalDollarsSaved.toFixed(2)} (${stats.averagePercentageSaved}% reduction)`, enabled: false },
      { type: 'separator' },
      {
        label: '📊 Open Dashboard',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          } else {
            createWindow();
          }
        }
      },
      {
        label: '🚀 Auto-Start on System Boot',
        type: 'checkbox',
        checked: isAutoStart,
        click: (menuItem) => {
          if (menuItem.checked) {
            AutoLauncher.enableAutoStart();
          } else {
            AutoLauncher.disableAutoStart();
          }
          updateContextMenu();
        }
      },
      { type: 'separator' },
      {
        label: '❌ Quit TokenGuard',
        click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);

    tray?.setContextMenu(contextMenu);
  };

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  updateContextMenu();
  statsStore.on('request_recorded', updateContextMenu);
}

// IPC Handlers
ipcMain.on('minimize-to-tray', () => {
  mainWindow?.hide();
});

ipcMain.on('open-external', (_, url: string) => {
  shell.openExternal(url);
});

ipcMain.handle('get-desktop-config', () => {
  return {
    autoStart: AutoLauncher.isEnabled(),
    port: PORT,
    platform: process.platform
  };
});

ipcMain.handle('toggle-auto-start', (_, enable: boolean) => {
  if (enable) {
    AutoLauncher.enableAutoStart();
  } else {
    AutoLauncher.disableAutoStart();
  }
  return AutoLauncher.isEnabled();
});

// App Lifecycle
app.whenReady().then(async () => {
  // 1. Start embedded express server with error handling
  try {
    const server = createServer();
    const serverInstance = server.listen(PORT, () => {
      console.log(`[TokenGuard Desktop] Embedded Proxy running on http://localhost:${PORT}`);
    });

    serverInstance.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[TokenGuard Desktop] Port ${PORT} already active, reusing existing proxy session.`);
      } else {
        console.error('[TokenGuard Desktop] Server error:', err);
      }
    });
  } catch (err) {
    console.warn('[TokenGuard Desktop] Server initialization note:', err);
  }

  // 2. Auto-configure Windows/Mac environment variables on launch
  const envManager = new EnvManager(PORT);
  await envManager.autoConfigure();

  // 3. Setup System Tray & Native Window
  setupTray();
  createWindow();

  // 4. Set auto-start by default
  AutoLauncher.enableAutoStart();

  // Optional: Native Notification on large savings
  statsStore.on('request_recorded', ({ newRecord }) => {
    if (newRecord && newRecord.savedTokens > 500 && Notification.isSupported()) {
      new Notification({
        title: 'TokenGuard Optimizer',
        body: `Saved ${newRecord.savedTokens} tokens (${newRecord.percentageSaved}%) from ${newRecord.model}!`,
        silent: true
      }).show();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Keep running in background system tray (do not call app.quit)
});
