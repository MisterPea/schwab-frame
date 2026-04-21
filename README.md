# @misterpea/schwab-frame

An Electron + React app frame for building desktop tools on top of
`@misterpea/schwab-node`.

Think of it as an empty Eurorack frame: the secure Schwab auth and app shell are
already wired, and developers can replace the default React module with their
own components.

## What It Includes

- Electron main/preload isolation with `contextIsolation` enabled and
  `nodeIntegration` disabled.
- User-entered Schwab developer credentials instead of a project `.env`.
- Credential storage via Electron `safeStorage`.
- OAuth token storage through `@misterpea/schwab-node`'s
  `EncryptedFileTokenStore`, also encrypted with `safeStorage`.
- Local callback certificate setup through the package's
  `schwab-node-certs` implementation.
- A settings button for replacing credentials or clearing the session.
- A default React "hello world" module that calls `getUserPreference()` and
  displays:
  - `account.type`
  - `account.displayAcctId`
  - `offers.level2Permissions`
  - `streamerInfo.streamerSocketUrl`

## Install

```bash
npm install
```

## Develop

```bash
npm run dev
```

On first launch, open settings and enter:

- Schwab client ID
- Schwab client secret
- Schwab redirect URI, for example `https://127.0.0.1:8443`

The redirect URI must match the callback URL configured in the Schwab developer
portal. It must be local HTTPS and include an explicit port.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

The test suite is designed to protect the reusable frame while leaving the app
surface open for custom modules. It covers encrypted credential storage, IPC
channel names, login/cert ordering, and the default React shell.

## Where To Add Your App

Replace or extend the default module here:

- `src/renderer/modules/AppContent.tsx`
- `src/renderer/modules/HelloWorldModule.tsx`

Keep Schwab API calls in the Electron main process and expose small, explicit
IPC methods through `src/main/preload.ts`. That preserves the security boundary
while still giving React components a clean application surface.

## Auth And Storage Notes

This template uses npm-based `@misterpea/schwab-node` public APIs:

- `configureDefaultAuth`
- `SchwabAuth`
- `EncryptedFileTokenStore`
- `getUserPreference`
- `setupCerts` from `@misterpea/schwab-node/scripts/setup-certs`

Credentials are not written to `.env`. They are stored under Electron's
`app.getPath("userData")` directory in an encrypted blob. OAuth tokens are stored
separately in an encrypted token file and supplied to `@misterpea/schwab-node`
through its custom token-store hook.
