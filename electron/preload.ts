import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  minimizeToTray: () => ipcRenderer.send('minimize-to-tray'),
  openExternal: (url: string) => ipcRenderer.send('open-external', url),
  getConfig: () => ipcRenderer.invoke('get-desktop-config'),
  toggleAutoStart: (enable: boolean) => ipcRenderer.invoke('toggle-auto-start', enable)
});
