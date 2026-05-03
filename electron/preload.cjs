'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,

  // Window controls
  minimize:    () => ipcRenderer.send('window:minimize'),
  maximize:    () => ipcRenderer.send('window:maximize'),
  close:       () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Open a new regular browser window
  newWindow:        () => ipcRenderer.send('window:new'),
  // Open a new isolated private/incognito browser window
  newPrivateWindow: () => ipcRenderer.send('window:new-private'),

  // Shell
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  // Capture the visible area of a webview by its webContentsId.
  // Returns a base64-encoded PNG string, or null on failure.
  screenshot: (wcId) => ipcRenderer.invoke('webview:screenshot', wcId),

  // Open DevTools for a webview identified by its webContentsId.
  openDevTools: (wcId) => ipcRenderer.send('webview:open-devtools', wcId),

  // Capture and save to the user's Downloads folder.
  // Returns the absolute file path, or null on failure.
  saveScreenshot: (url) => ipcRenderer.invoke('webview:save-screenshot', url),

  // Capture the whole BrowserWindow (for internal pages with no webview).
  captureWindow: () => ipcRenderer.invoke('window:capture'),

  // Set zoom factor on a webview identified by its current URL.
  setWebviewZoom: (url, factor) => ipcRenderer.send('webview:set-zoom', { url, factor }),

  // Window drag from content (JS-based, avoids -webkit-app-region dead zones)
  moveWindowBy: (dx, dy) => ipcRenderer.send('window:move-by', { dx, dy }),

  // Extensions
  listExtensions:            ()    => ipcRenderer.invoke('extensions:list'),
  loadExtension:             (p)   => ipcRenderer.invoke('extensions:load-unpacked', p),
  removeExtension:           (id)  => ipcRenderer.invoke('extensions:remove', id),
  showExtensionFolderDialog: ()    => ipcRenderer.invoke('extensions:show-open-dialog'),

  // Window maximize state listener — returns an unsubscribe function.
  onMaximizeChange: (cb) => {
    const handler = (_, val) => cb(val);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },

  // Fired when a webview tries to open a popup; the main process redirects
  // the URL here instead. Returns an unsubscribe function.
  onNewWindow: (cb) => {
    const handler = (_, url) => cb(url);
    ipcRenderer.on('webview:new-window', handler);
    return () => ipcRenderer.removeListener('webview:new-window', handler);
  },

  // Download lifecycle events. Each returns an unsubscribe function.
  onDownloadStart: (cb) => {
    const h = (_, d) => cb(d); ipcRenderer.on('download:start', h);
    return () => ipcRenderer.removeListener('download:start', h);
  },
  onDownloadUpdate: (cb) => {
    const h = (_, d) => cb(d); ipcRenderer.on('download:update', h);
    return () => ipcRenderer.removeListener('download:update', h);
  },
  onDownloadDone: (cb) => {
    const h = (_, d) => cb(d); ipcRenderer.on('download:done', h);
    return () => ipcRenderer.removeListener('download:done', h);
  },

  // Context menu — fires for every right-click in a webview (even when page calls preventDefault).
  onContextMenu: (cb) => {
    const h = (_, params) => cb(params);
    ipcRenderer.on('context-menu:show', h);
    return () => ipcRenderer.removeListener('context-menu:show', h);
  },
  contextMenuAction: (action, wcId, payload) => {
    ipcRenderer.send('context-menu:action', { action, wcId, payload: payload ?? {} });
  },
});
