import { contextBridge, ipcRenderer } from "electron";
import type { LoginResult, SchwabPreferenceSummary } from "./schwabService.js";
import type {
  AuthModeConfig,
  PublicCredentialStatus,
  SchwabCredentials,
} from "./schwabStorage.js";

export type SchwabFrameApi = {
  credentialsStatus(): Promise<PublicCredentialStatus>;
  saveCredentials(credentials: SchwabCredentials): Promise<PublicCredentialStatus>;
  saveAuthMode(config: AuthModeConfig): Promise<PublicCredentialStatus>;
  login(): Promise<LoginResult>;
  clearSession(): Promise<PublicCredentialStatus>;
  clearCredentials(): Promise<PublicCredentialStatus>;
};

const api: SchwabFrameApi = {
  credentialsStatus: () => ipcRenderer.invoke("schwab:credentials-status"),
  saveCredentials: (credentials) =>
    ipcRenderer.invoke("schwab:save-credentials", credentials),
  saveAuthMode: (config) =>
    ipcRenderer.invoke("schwab:save-auth-mode", config),
  login: () => ipcRenderer.invoke("schwab:login"),
  clearSession: () => ipcRenderer.invoke("schwab:clear-session"),
  clearCredentials: () => ipcRenderer.invoke("schwab:clear-credentials"),
};

contextBridge.exposeInMainWorld("schwabFrame", api);

export type {
  AuthModeConfig,
  LoginResult,
  PublicCredentialStatus,
  SchwabCredentials,
  SchwabPreferenceSummary,
};
