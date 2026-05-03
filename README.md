# Web 2.0 Browser

A retro-aesthetic desktop web browser built with **Electron** + **React** + **Vite**, featuring a custom UI with tabbed browsing, bookmarks, history, downloads, and quick-access sites.

---

## ✨ Features

- **Multi-tab browsing** — open, close, and switch between tabs
- **Custom top bar** — frameless window with built-in navigation controls (back, forward, reload, address bar)
- **Quick Access sidebar** — pinned sites with customizable colors
- **Site Manager** — add and organize your favourite sites
- **Bookmarks** — save and manage bookmarks
- **History** — full browsing history with clear option
- **Downloads** — track downloaded files
- **Internal pages** — New Tab (`web20://start`), History, Bookmarks, Downloads, Settings
- **Search engine choice** — Google, DuckDuckGo, or Bing
- **Dark theme** — built-in dark UI with accent color palette
- **Frameless window** — custom minimize / maximize / close controls

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Runtime | [Electron](https://www.electronjs.org/) 33 |
| UI framework | [React](https://react.dev/) 18 |
| Build tool | [Vite](https://vitejs.dev/) 6 |
| Styling | [Tailwind CSS](https://tailwindcss.com/) 4 |
| UI components | [shadcn/ui](https://ui.shadcn.com/) + [Radix UI](https://www.radix-ui.com/) |
| Icons | [Lucide React](https://lucide.dev/) + [MUI Icons](https://mui.com/material-ui/material-icons/) |
| Charts | [Recharts](https://recharts.org/) |
| Animations | [Motion](https://motion.dev/) |

---

## 📦 Prerequisites

- [Node.js](https://nodejs.org/) ≥ 18
- npm (comes with Node.js)

---

## 🚀 Getting Started

### Install dependencies

```bash
npm install
```

### Run in development mode

Starts Vite dev server and Electron simultaneously:

```bash
npm start
```

### Build for production (web)

```bash
npm run build
```

### Preview production build

```bash
npm run preview
```

### Package as Windows installer

```bash
npm run dist
```

The installer will be output to the `release/` folder.

---

## 📁 Project Structure

```
web 2.0/
├── electron/
│   ├── main.cjs          # Electron main process
│   └── preload.cjs       # Preload script (context bridge)
├── src/
│   ├── app/
│   │   ├── App.tsx                  # Root app component
│   │   ├── types.ts                 # Shared TypeScript types
│   │   ├── components/
│   │   │   ├── TopBar.tsx           # Address bar + navigation
│   │   │   ├── Sidebar.tsx          # Left sidebar
│   │   │   ├── QuickAccess.tsx      # Pinned sites panel
│   │   │   ├── SiteManager.tsx      # Site add/edit/remove
│   │   │   ├── WebViewStack.tsx     # Electron webview manager
│   │   │   ├── InternalPages.tsx    # New Tab, History, etc.
│   │   │   ├── Menus.tsx            # Context menus
│   │   │   ├── Logo.tsx             # App logo
│   │   │   ├── TimeWidget.tsx       # Clock widget
│   │   │   └── Tip.tsx              # Tooltip helper
│   │   └── services/
│   │       ├── storage.ts           # localStorage persistence
│   │       ├── bookmarks.ts         # Bookmark CRUD
│   │       ├── history.ts           # Browsing history
│   │       └── downloads.ts         # Download tracking
│   ├── styles/
│   │   ├── globals.css
│   │   ├── theme.css
│   │   └── tailwind.css
│   └── main.tsx                     # React entry point
├── dist/                            # Production build output
├── release/                         # Packaged installers
├── index.html
├── package.json
└── guidelines/
    └── Guidelines.md                # AI generation guidelines
```

---

## ⚙️ Build Configuration

Electron Builder is configured in `package.json` under the `"build"` key:

| Setting | Value |
|---|---|
| App ID | `com.web2.browser` |
| Product Name | `Web 2.0` |
| Windows target | NSIS installer |
| Mac target | DMG |
| Output directory | `release/` |

---

## 📜 Attributions

- UI components from [shadcn/ui](https://ui.shadcn.com/) — MIT License
- Photos from [Unsplash](https://unsplash.com/) — Unsplash License

---

## 📄 License

Private project. All rights reserved.
