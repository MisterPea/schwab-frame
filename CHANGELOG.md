# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.0.2] - 2026-04-21

### Added
- Dark and light mode theme toggle with OS preference detection and `localStorage` persistence.
- `ThemeToggle` button component (Moon/Sun icons). Placed in two locations — the topbar and the settings modal header — so developers can keep or remove either independently.
- `useTheme` hook that sets `data-theme` on `<html>` before first render to prevent flash.
- Atkinson Hyperlegible Next font via `@fontsource/atkinson-hyperlegible-next` (latin subset, 400 and 700 weights), bundled locally to satisfy the app's `default-src 'self'` CSP.

### Changed
- Converted `styles.css` to `styles.scss`. Palette values live in SCSS maps (`$light` / `$dark`) emitted as CSS custom properties via a `@include palette()` mixin.
- Warmed both color schemes: light mode shifts from blue-gray to cream tones; dark mode shifts from cool navy to charcoal-brown.
- Removed all `box-shadow` declarations.
- Unified border-radius to `4px` across all elements.
- Added `sass` as a dev dependency.

---

## [0.0.1] - 2026-04-21

### Added
- Electron main/renderer/preload architecture with `contextIsolation` enabled and `nodeIntegration` disabled.
- Schwab OAuth flow via `@misterpea/schwab-node` with in-app credential entry (no `.env` file).
- Encrypted credential storage using Electron `safeStorage`.
- Encrypted OAuth token storage via `EncryptedFileTokenStore`.
- Local HTTPS callback certificate setup via `schwab-node-certs`.
- Settings modal for entering, replacing, or clearing credentials.
- Default hello-world module displaying `getUserPreference()` data.
- React 19 renderer built with Vite, TypeScript throughout.
- Vitest + Testing Library test suite covering IPC, auth flow, and the React shell.
