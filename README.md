# @misterpea/schwab-frame 🖼️

An Electron + React desktop app frame for building tools on top of the Charles Schwab API (@misterpea/schwab-node).

Think of it like an [unpopulated Eurorack case](https://en.wikipedia.org/wiki/Eurorack#:~:text=An%20unpopulated%20Eurorack%20case%2C%20showing%20the%20power%20bus): 
* Secure Schwab authentication is built in. 
* Drop in your own React modules and Schwab API calls without needing to touch any of the auth plumbing.
* Use methods found in [@misterpea/schwab-node](https://github.com/MisterPea/schwab-node) (Order calls not yet available). 


## What's Included

- **Electron security** — main/preload/renderer isolation with `contextIsolation` enabled and `nodeIntegration` disabled.
- **In-app credentials** — users enter their Schwab developer keys through the settings UI. No `.env` file, no hardcoded secrets.
- **Encrypted storage** — credentials stored via Electron `safeStorage`; OAuth tokens via `EncryptedFileTokenStore` from `@misterpea/schwab-node`, both encrypted at rest.
- **Local HTTPS callback** — certificate setup handled automatically by `schwab-node-certs`.
- **Settings modal** — lets users enter, replace, or clear credentials at any time.
- **Dark / light mode** — OS preference detected on launch, persisted in `localStorage`, and toggleable from the topbar or settings modal. Two toggle button locations are provided so developers can keep or remove either.
- **Atkinson Hyperlegible Next** Font — bundled locally (no external font requests) to keep the `default-src 'self'` CSP intact.
- **SCSS styling** — palette lives in SCSS maps emitted as CSS custom properties; easy to theme.
- **Default module** — a hello-world card that calls `getUserPreference()` and displays account, permissions, and streamer socket info to confirm a working OAuth session.


## Prerequisites

- Node.js 20.6 or later
- A [Schwab developer app](https://developer.schwab.com) with a client ID, client secret, and a redirect URI pointed at a local HTTPS address (e.g. `https://127.0.0.1:8443`)


## Quick Start

Scaffold a new project from the template:

```bash
npx degit MisterPea/schwab-frame my-app
cd my-app
npm install
npm run dev
```

On first launch the settings modal opens automatically. Enter your Schwab developer credentials and click **Save**. The app will start the OAuth flow and, once authorized, display the hello-world module.


## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server + Electron with hot reload |
| `npm run build` | TypeScript compile + Vite production build |
| `npm start` | Build then launch Electron |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | Type-check renderer and main without emitting |


## Where To Add Your App

Replace or extend the default module:

- **`src/renderer/modules/AppContent.tsx`** — top-level content container rendered after login.
- **`src/renderer/modules/HelloWorldModule.tsx`** — the default demo card; swap it for your own component.

Keep Schwab API calls in the Electron main process and expose them through small, explicit IPC methods in **`src/main/preload.ts`**. That preserves the security boundary while giving React a clean typed surface to call.


## Styling

Global styles live in `src/renderer/styles.scss`. The file uses two SCSS maps — `$light` and `$dark` — that are emitted as CSS custom properties via a `@include palette()` mixin. To change the color scheme, edit the maps at the top of the file.

The dark/light toggle is implemented in `src/renderer/hooks/useTheme.ts` and rendered by `src/renderer/components/ThemeToggle.tsx`. The two button placements (topbar and settings) are marked with comments; remove either `<ThemeToggle />` instance to disable that location.


## Auth & Storage Notes

This template uses the following public APIs from `@misterpea/schwab-node`:

- `configureDefaultAuth`
- `SchwabAuth`
- `EncryptedFileTokenStore`
- `getUserPreference`
- `setupCerts` (from `@misterpea/schwab-node/scripts/setup-certs`)

Credentials are stored under Electron's `app.getPath("userData")` directory as an encrypted blob. OAuth tokens are stored separately in an encrypted token file and injected into `@misterpea/schwab-node` through its custom token-store hook.


## Test Suite

```bash
npm test
```

The suite is designed to protect the reusable frame while leaving the app surface open. It covers encrypted credential storage, IPC channel names, login and cert ordering, and the default React shell.
