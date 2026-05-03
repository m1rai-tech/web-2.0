'use strict';
const { app, BrowserWindow, ipcMain, shell, webContents: ElectronWebContents, dialog, session, screen } = require('electron');
const path = require('path');
const fs   = require('fs');

// ERR_ABORTED (-3) from webview GUEST_VIEW_MANAGER is normal — it fires on
// every redirect (http→https, www→bare, etc.).  Suppress the noisy log line.
const _origError = console.error.bind(console);
console.error = (...args) => {
  if (typeof args[0] === 'string' &&
      args[0].includes('GUEST_VIEW_MANAGER_CALL') &&
      args[1]?.errno === -3) return;
  _origError(...args);
};

// ── Environment detection ────────────────────────────────────────────────────
const isDev    = process.argv.includes('--dev') || process.env.ELECTRON_IS_DEV === 'true';
const DEV_URL  = 'http://localhost:5173';
const DIST_FILE = path.join(__dirname, '../dist/index.html');

let mainWindow = null;

// ── Window factory ────────────────────────────────────────────────────────────
function createBrowserWindow(isPrivate = false) {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    transparent: false,
    backgroundColor: '#060606',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      webSecurity: true,
    },
    show: false,
    autoHideMenuBar: true,
  });

  const privateParam = isPrivate ? '?private=1' : '';
  if (isDev) {
    win.loadURL(DEV_URL + privateParam);
  } else if (fs.existsSync(DIST_FILE)) {
    win.loadFile(DIST_FILE, isPrivate ? { query: { private: '1' } } : {});
  } else {
    win.loadURL(DEV_URL + privateParam);
  }

  win.once('ready-to-show', () => win.show());

  // Notify renderer of maximize state changes
  win.on('maximize',   () => win.webContents.send('window:maximized', true));
  win.on('unmaximize', () => win.webContents.send('window:maximized', false));

  // Prevent accidental navigation away from the app shell
  win.webContents.on('will-navigate', (e, url) => {
    if (isDev  && url.startsWith(DEV_URL))   return;
    if (!isDev && url.startsWith('file://')) return;
    e.preventDefault();
  });

  return win;
}

function createWindow() {
  mainWindow = createBrowserWindow(false);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── IPC: Window controls ─────────────────────────────────────────────────────
// Use e.sender so these work with multiple windows (regular + private).
ipcMain.on('window:minimize', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.minimize();
});

ipcMain.on('window:maximize', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});

ipcMain.on('window:close', (e) => {
  BrowserWindow.fromWebContents(e.sender)?.close();
});

ipcMain.handle('window:isMaximized', (e) =>
  BrowserWindow.fromWebContents(e.sender)?.isMaximized() ?? false
);

// ── IPC: New windows ─────────────────────────────────────────────────────────
ipcMain.on('window:new',         () => createBrowserWindow(false));
ipcMain.on('window:new-private', () => createBrowserWindow(true));

// ── IPC: Move window by delta (JS drag from content areas) ───────────────────
ipcMain.on('window:move-by', (e, { dx, dy }) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + Math.round(dx), y + Math.round(dy));
});

// ── IPC: Shell ───────────────────────────────────────────────────────────────
ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));

// ── IPC: Screenshot ──────────────────────────────────────────────────────────
// Returns base64 PNG (used internally).
ipcMain.handle('webview:screenshot', async (_, wcId) => {
  try {
    const wc = ElectronWebContents.fromId(wcId);
    if (!wc) return null;
    const img = await wc.capturePage();
    return img.toPNG().toString('base64');
  } catch {
    return null;
  }
});

// Captures and saves directly to the user's Downloads folder.
// Receives the current page URL so it can find the right webview webContents.
// Returns the absolute file path on success, null on failure.
ipcMain.handle('webview:save-screenshot', async (_, url) => {
  try {
    const all = ElectronWebContents.getAllWebContents();
    const wc  = all.find(w => w.getType() === 'webview' && w.getURL() === url);
    if (!wc) return null;
    const img  = await wc.capturePage();
    const buf  = img.toPNG();
    const dir  = app.getPath('pictures');
    const name = `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    const dest = path.join(dir, name);
    fs.writeFileSync(dest, buf);
    return dest;
  } catch {
    return null;
  }
});

// ── IPC: Capture main window (used for internal pages that have no webview) ──
ipcMain.handle('window:capture', async (e) => {
  try {
    const win = BrowserWindow.fromWebContents(e.sender);
    if (!win) return null;
    const img  = await win.webContents.capturePage();
    const buf  = img.toPNG();
    const dir  = app.getPath('pictures');
    const name = `screenshot-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
    const dest = path.join(dir, name);
    fs.writeFileSync(dest, buf);
    return dest;
  } catch { return null; }
});

// ── IPC: Webview zoom ────────────────────────────────────────────────────────
// Renderer sends current page URL + factor; main finds the webContents and
// applies setZoomFactor via the reliable Node.js API.
ipcMain.on('webview:set-zoom', (_, { url, factor }) => {
  try {
    const all = ElectronWebContents.getAllWebContents();
    const wc  = all.find(w => w.getType() === 'webview' && w.getURL() === url);
    if (wc) wc.setZoomFactor(factor);
  } catch {}
});

// ── Webview popup handling ────────────────────────────────────────────────────
// Route window.open() calls back to the renderer tab instead of opening a
// native OS window, so the React app can handle the navigation.
app.on('web-contents-created', (_, contents) => {
  if (contents.getType() === 'webview') {
    contents.setWindowOpenHandler(({ url }) => {
      const hostWC = contents.hostWebContents;
      if (hostWC) {
        hostWC.send('webview:new-window', url);
      } else {
        mainWindow?.webContents.send('webview:new-window', url);
      }
      return { action: 'deny' };
    });
    setupContextMenu(contents);
  }
});

// ── Extensions persistence ────────────────────────────────────────────────────
function getExtensionsFile() {
  return path.join(app.getPath('userData'), 'extensions.json');
}

function getSavedExtensionPaths() {
  try {
    const f = getExtensionsFile();
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'));
  } catch {}
  return [];
}

function saveExtensionPath(extPath) {
  try {
    const paths = getSavedExtensionPaths();
    if (!paths.includes(extPath)) {
      paths.push(extPath);
      fs.writeFileSync(getExtensionsFile(), JSON.stringify(paths));
    }
  } catch {}
}

function dropExtensionPath(extPath) {
  try {
    const paths = getSavedExtensionPaths().filter(p => p !== extPath);
    fs.writeFileSync(getExtensionsFile(), JSON.stringify(paths));
  } catch {}
}

// ── IPC: Extensions ───────────────────────────────────────────────────────────
ipcMain.handle('extensions:list', () => {
  return session.defaultSession.getAllExtensions();
});

ipcMain.handle('extensions:load-unpacked', async (_, extPath) => {
  try {
    const ext = await session.defaultSession.loadExtension(extPath, { allowFileAccess: true });
    saveExtensionPath(extPath);
    return ext;
  } catch (err) {
    console.error('[ext] load failed:', err.message);
    return null;
  }
});

ipcMain.handle('extensions:remove', async (_, extId) => {
  try {
    const all = session.defaultSession.getAllExtensions();
    const ext = all.find(e => e.id === extId);
    await session.defaultSession.removeExtension(extId);
    if (ext) dropExtensionPath(ext.path);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('extensions:show-open-dialog', async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const result = await dialog.showOpenDialog(win, {
    title: 'Select Extension Folder',
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── Context menu ──────────────────────────────────────────────────────────────

const CONTEXT_MENU_WHITELIST = [
  'docs.google.com', 'sheets.google.com', 'slides.google.com',
  'figma.com', 'www.figma.com',
  'meet.google.com',
  'notion.so', 'www.notion.so',
];

function isWhitelisted(url) {
  try {
    const host = new URL(url).hostname;
    return CONTEXT_MENU_WHITELIST.some(w => host === w || host.endsWith('.' + w));
  } catch { return false; }
}

function setupContextMenu(contents) {
  contents.on('context-menu', (event, params) => {
    if (isWhitelisted(params.pageURL || '')) return;

    const host   = contents.hostWebContents ?? contents;
    const hostWin = BrowserWindow.fromWebContents(host) ?? mainWindow;
    if (!hostWin) return;

    const cursor  = screen.getCursorScreenPoint();
    const [wx, wy] = hostWin.getPosition();

    hostWin.webContents.send('context-menu:show', {
      wcId:             contents.id,
      x:                cursor.x - wx,
      y:                cursor.y - wy,
      webviewX:         params.x,
      webviewY:         params.y,
      pageURL:          params.pageURL          || '',
      frameURL:         params.frameURL         || '',
      linkURL:          params.linkURL          || '',
      linkText:         params.linkText         || '',
      srcURL:           params.srcURL           || '',
      mediaType:        params.mediaType        || 'none',
      selectionText:    params.selectionText    || '',
      isEditable:       !!params.isEditable,
      editFlags:        params.editFlags        || {},
      titleText:        params.titleText        || '',
      hasImageContents: !!params.hasImageContents,
    });
  });
}

ipcMain.on('context-menu:action', (_, { action, wcId, payload = {} }) => {
  try {
    const wc = ElectronWebContents.fromId(wcId);
    if (!wc) return;
    switch (action) {
      case 'copy':      wc.copy();      break;
      case 'cut':       wc.cut();       break;
      case 'paste':     wc.paste();     break;
      case 'undo':      wc.undo();      break;
      case 'redo':      wc.redo();      break;
      case 'selectAll': wc.selectAll(); break;
      case 'back':      wc.goBack();    break;
      case 'forward':   wc.goForward(); break;
      case 'reload':    wc.reload();    break;
      case 'devtools':  wc.openDevTools(); break;
      case 'viewSource': {
        const url = wc.getURL();
        if (url) {
          const host    = wc.hostWebContents ?? wc;
          const hostWin = BrowserWindow.fromWebContents(host) ?? mainWindow;
          if (hostWin) hostWin.webContents.send('webview:new-window', `view-source:${url}`);
        }
        break;
      }
      case 'saveImage': {
        if (payload.srcURL) wc.downloadURL(payload.srcURL);
        break;
      }
      case 'copyImage': {
        if (typeof payload.x === 'number' && typeof payload.y === 'number') {
          wc.copyImageAt(payload.x, payload.y);
        }
        break;
      }
      case 'pip': {
        wc.executeJavaScript(
          '(()=>{const v=document.querySelector("video");if(v&&v.requestPictureInPicture)v.requestPictureInPicture();})()'
        ).catch(() => {});
        break;
      }
      case 'loop': {
        wc.executeJavaScript(
          '(()=>{const v=document.querySelector("video");if(v)v.loop=!v.loop;})()'
        ).catch(() => {});
        break;
      }
    }
  } catch {}
});

// ── IPC: DevTools ─────────────────────────────────────────────────────────────
ipcMain.on('webview:open-devtools', (_, wcId) => {
  try {
    const wc = ElectronWebContents.fromId(wcId);
    if (wc) wc.openDevTools();
  } catch {}
});

// ── Downloads (will-download) ─────────────────────────────────────────────────
function setupDownloadHandler(ses, targetWin) {
  ses.on('will-download', (event, item, wc) => {
    // Resolve the BrowserWindow that should receive progress events
    const hostWC = wc.hostWebContents ?? wc;
    const win    = BrowserWindow.fromWebContents(hostWC) ?? targetWin ?? mainWindow;

    const id       = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const filename = item.getFilename();

    // Save to the user's Downloads folder automatically (no save dialog)
    const dest = path.join(app.getPath('downloads'), filename);
    item.setSavePath(dest);

    win?.webContents.send('download:start', {
      id, filename, url: item.getURL(), totalBytes: item.getTotalBytes() || 0,
    });

    item.on('updated', (_, state) => {
      win?.webContents.send('download:update', {
        id, state,
        receivedBytes: item.getReceivedBytes(),
        totalBytes:    item.getTotalBytes() || 0,
      });
    });

    item.once('done', (_, state) => {
      win?.webContents.send('download:done', { id, state, filename });
    });
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  // Reload extensions that were installed in previous sessions
  for (const extPath of getSavedExtensionPaths()) {
    if (fs.existsSync(extPath)) {
      session.defaultSession
        .loadExtension(extPath, { allowFileAccess: true })
        .catch(err => console.error('[ext] reload failed:', err.message));
    }
  }

  setupDownloadHandler(session.defaultSession, null);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

