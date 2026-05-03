interface ContextMenuParams {
  wcId:             number;
  x:                number;
  y:                number;
  webviewX:         number;
  webviewY:         number;
  pageURL:          string;
  frameURL:         string;
  linkURL:          string;
  linkText:         string;
  srcURL:           string;
  mediaType:        'none' | 'image' | 'audio' | 'video' | 'canvas' | 'file' | 'plugin';
  selectionText:    string;
  isEditable:       boolean;
  editFlags:        {
    canUndo: boolean; canRedo: boolean; canCut: boolean;
    canCopy: boolean; canPaste: boolean; canSelectAll: boolean;
  };
  titleText:        string;
  hasImageContents: boolean;
}

interface ExtensionInfo {
  id:      string;
  name:    string;
  path:    string;
  version: string;
  url:     string;
}

interface ElectronAPI {
  isElectron: boolean;

  // Window controls
  minimize:    () => void;
  maximize:    () => void;
  close:       () => void;
  isMaximized: () => Promise<boolean>;

  // New windows
  newWindow:        () => void;
  newPrivateWindow: () => void;

  // Shell
  openExternal: (url: string) => Promise<void>;

  // Screenshot — captures webview by webContentsId, returns base64 PNG or null
  screenshot: (wcId: number) => Promise<string | null>;

  // Open DevTools for a webview by webContentsId
  openDevTools: (wcId: number) => void;

  // Capture the whole BrowserWindow (for internal pages), returns absolute path or null
  captureWindow: () => Promise<string | null>;

  // Capture and save to Downloads folder, returns absolute path or null
  saveScreenshot: (url: string) => Promise<string | null>;

  // Set zoom factor on a webview identified by its current URL
  setWebviewZoom: (url: string, factor: number) => void;

  // Window drag from content areas
  moveWindowBy: (dx: number, dy: number) => void;

  // Extensions
  listExtensions:            () => Promise<ExtensionInfo[]>;
  loadExtension:             (path: string) => Promise<ExtensionInfo | null>;
  removeExtension:           (id: string) => Promise<boolean>;
  showExtensionFolderDialog: () => Promise<string | null>;

  // Listeners (return unsubscribe functions)
  onMaximizeChange: (cb: (maximized: boolean) => void) => () => void;
  onNewWindow:      (cb: (url: string) => void)        => () => void;

  // Download events
  onDownloadStart:  (cb: (d: { id: string; filename: string; url: string; totalBytes: number }) => void) => () => void;
  onDownloadUpdate: (cb: (d: { id: string; state: string; receivedBytes: number; totalBytes: number }) => void) => () => void;
  onDownloadDone:   (cb: (d: { id: string; state: string; filename: string }) => void) => () => void;

  // Context menu
  onContextMenu:    (cb: (params: ContextMenuParams) => void) => () => void;
  contextMenuAction:(action: string, wcId: number, payload?: Record<string, unknown>) => void;
}

interface Window {
  electronAPI?: ElectronAPI;
}

declare namespace JSX {
  interface IntrinsicElements {
    webview: {
      src?: string;
      style?: { [key: string]: any };
      className?: string;
      allowpopups?: string;
      partition?: string; // set before first navigation; immutable after mount
      webpreferences?: string;
      ref?: any;
      key?: string | number;
      id?: string;
      useragent?: string;
      httpreferrer?: string;
    };
  }
}
