import { app, BrowserWindow, ipcMain, shell } from "electron";
import { join } from "node:path";
import {
  clearCredentials,
  clearSession,
  getCredentialStatus,
  login,
  saveCredentials,
} from "./schwabService.js";

const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    title: "Schwab Frame",
    backgroundColor: "#f7f8fb",
    webPreferences: {
      preload: join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL as string);
  } else {
    mainWindow.loadFile(join(app.getAppPath(), "dist/renderer/index.html"));
  }
}

ipcMain.handle("schwab:credentials-status", getCredentialStatus);
ipcMain.handle("schwab:save-credentials", (_event, credentials) =>
  saveCredentials(credentials),
);
ipcMain.handle("schwab:login", login);
ipcMain.handle("schwab:clear-session", clearSession);
ipcMain.handle("schwab:clear-credentials", clearCredentials);

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
