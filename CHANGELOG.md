# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

---

## [0.0.4] - 2026-07-08

### Security
- Ran `npm audit fix` — resolved all 11 reported vulnerabilities (2 low, 2 moderate, 5 high, 2 critical) in transitive dependencies (`axios`, `undici`, `vite`, `ws`, `esbuild`, `form-data`, `joi`, `qs`, `shell-quote` via `concurrently`, `@babel/core`). No direct dependency version changes required.

---

## [0.0.3] - 2026-04-25

### Added
- Delegated auth mode — lets an external daemon (`schwab-auth-daemon`) own the OAuth session while this app reads tokens directly from the system keychain. Avoids Schwab's single-active-session constraint when multiple apps share one account.
- `KeychainTokenStore` — reads, writes, and clears token JSON via `keytar` using a configurable keychain service name (default: `"schwab-node"`).
- `AuthModeStore` — persists auth mode selection to `schwab-auth-mode.json` in Electron `userData`.
- `AuthModeConfig` type (`mode: "managed" | "delegated"`, `keychainService: string`) exported from preload.
- `saveAuthMode` IPC handler + `window.schwabFrame.saveAuthMode()` renderer API.
- `authMode` and `keychainService` fields on `PublicCredentialStatus`.
- Delegated-auth toggle and keychain service name input in `CredentialSettings`, with an expandable info panel linking to `schwab-node-persistent-auth` setup docs.
- `keytar` runtime dependency.

### Changed
- `SafeStorageCredentialStore.status()` renamed to `credentialStatus()`; return type narrowed to `Omit<PublicCredentialStatus, "authMode" | "keychainService">`. Composed into `getCredentialStatus()` in `schwabService` alongside auth mode.
- `buildAuth()` renamed to `buildManagedAuth()` to distinguish from delegated path.
- `login()`, `clearSession()`, and `clearCredentials()` skip OAuth steps when mode is `"delegated"`.
- Clear credentials button in settings enabled when delegated mode is active (no stored credentials required).

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
