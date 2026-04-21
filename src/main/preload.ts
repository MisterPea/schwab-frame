import { contextBridge, ipcRenderer } from "electron";
import type {
  LoginResult,
  SchwabPreferenceSummary,
} from "./schwabService.js";
import type {
  PublicCredentialStatus,
  SchwabCredentials,
} from "./schwabStorage.js";

export type SchwabFrameApi = {
  credentialsStatus(): Promise<PublicCredentialStatus>;
  saveCredentials(credentials: SchwabCredentials): Promise<PublicCredentialStatus>;
  login(): Promise<LoginResult>;
  clearSession(): Promise<PublicCredentialStatus>;
  clearCredentials(): Promise<PublicCredentialStatus>;
};

const api: SchwabFrameApi = {
  credentialsStatus: () => ipcRenderer.invoke("schwab:credentials-status"),
  saveCredentials: (credentials) =>
    ipcRenderer.invoke("schwab:save-credentials", credentials),
  login: () => ipcRenderer.invoke("schwab:login"),
  clearSession: () => ipcRenderer.invoke("schwab:clear-session"),
  clearCredentials: () => ipcRenderer.invoke("schwab:clear-credentials"),
};

contextBridge.exposeInMainWorld("schwabFrame", api);

export type { LoginResult, PublicCredentialStatus, SchwabCredentials, SchwabPreferenceSummary };
