import {
  BrowserWindow,
  app,
  shell,
  type BrowserWindowConstructorOptions,
} from "electron";
import { listenForAuthCode } from "@misterpea/schwab-node/oauth/server";
import {
  resolveSchwabPaths,
  type PathOptions,
  type SchwabPaths,
} from "@misterpea/schwab-node";
import {
  FileTokenStore,
  type SecretProvider,
  type TokenSet,
  type TokenStore,
} from "@misterpea/schwab-node";

export type ElectronSchwabAuthConfig = {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  tokenStore?: TokenStore;
  paths?: PathOptions;
  secrets?: SecretProvider;
};

type ResolvedCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

const AUTH_ENDPOINT_BASE = "https://api.schwabapi.com/v1/oauth/authorize";
const TOKEN_ENDPOINT = "https://api.schwabapi.com/v1/oauth/token";

async function resolveSecret(
  name: string,
  directValue: string | undefined,
  provider?: () => Promise<string | undefined> | string | undefined,
  envPath?: string,
): Promise<string> {
  if (directValue) return directValue;

  const provided = await provider?.();
  if (provided) return provided;

  throw new Error(`Missing auth value ${name}`);
}

export class ElectronSchwabAuth {
  private readonly paths: SchwabPaths;
  private readonly tokenStore: TokenStore;
  private authInProgress: Promise<TokenSet> | null = null;
  private credentialsPromise: Promise<ResolvedCredentials> | null = null;
  private readonly refreshSkew = 2 * 60_000;

  constructor(private readonly config: ElectronSchwabAuthConfig = {}) {
    this.paths = resolveSchwabPaths(config.paths);
    this.tokenStore = config.tokenStore ?? new FileTokenStore(this.paths.tokenPath);
  }

  getPaths(): SchwabPaths {
    return this.paths;
  }

  getAuth(): Promise<TokenSet> {
    if (this.authInProgress) return this.authInProgress;

    this.authInProgress = this.getAuthInternal().finally(() => {
      this.authInProgress = null;
    });

    return this.authInProgress;
  }

  async clearAuth(): Promise<void> {
    await this.tokenStore.clear?.();
  }

  private async getAuthInternal(): Promise<TokenSet> {
    let token = await this.tokenStore.load();

    if (!token) {
      const code = await this.requestAuth();
      token = await this.retrieveAuthToken(code);
    } else if (!this.isExpired(token)) {
      return token;
    } else {
      token = await this.refresh(token.refresh_token, token.refresh_obtained_at);
    }

    await this.tokenStore.save(token);
    return token;
  }

  private async getCredentials(): Promise<ResolvedCredentials> {
    if (!this.credentialsPromise) {
      this.credentialsPromise = Promise.all([
        resolveSecret(
          "SCHWAB_CLIENT_ID",
          this.config.clientId,
          this.config.secrets?.getClientId,
          this.paths.envPath,
        ),
        resolveSecret(
          "SCHWAB_CLIENT_SECRET",
          this.config.clientSecret,
          this.config.secrets?.getClientSecret,
          this.paths.envPath,
        ),
        resolveSecret(
          "SCHWAB_REDIRECT_URI",
          this.config.redirectUri,
          this.config.secrets?.getRedirectUri,
          this.paths.envPath,
        ),
      ]).then(([clientId, clientSecret, redirectUri]) => ({
        clientId,
        clientSecret,
        redirectUri,
      }));
    }

    return this.credentialsPromise;
  }

  private async requestAuth(): Promise<string> {
    const { clientId, redirectUri } = await this.getCredentials();
    const authUrl = new URL(AUTH_ENDPOINT_BASE);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);

    const codePromise = listenForAuthCode(redirectUri, 60, {
      envPath: this.paths.envPath,
      storageRoot: this.paths.storageRoot,
    });

    const authWindow = this.createAuthWindow();
    authWindow.loadURL(authUrl.toString());

    try {
      const { code, session } = await codePromise;
      if (!session) throw new Error("session id must be part of the payload");
      return code;
    } finally {
      if (!authWindow.isDestroyed()) {
        authWindow.close();
      }
    }
  }

  private createAuthWindow(): BrowserWindow {
    const parent = BrowserWindow.getFocusedWindow() ?? undefined;
    const options: BrowserWindowConstructorOptions = {
      width: 720,
      height: 820,
      minWidth: 520,
      minHeight: 620,
      title: "Schwab Login",
      parent,
      modal: false,
      show: true,
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        partition: `persist:${app.name}-schwab-auth`,
      },
    };

    const authWindow = new BrowserWindow(options);
    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });
    authWindow.setMenuBarVisibility(false);
    return authWindow;
  }

  private isExpired(tokens: TokenSet): boolean {
    const expiresAt = tokens.obtained_at + tokens.expires_in * 1000;
    return Date.now() >= expiresAt - this.refreshSkew;
  }

  private basicAuthHeader(
    clientId: string,
    clientSecret: string,
  ): Record<string, string> {
    const raw = `${clientId}:${clientSecret}`;
    return {
      Authorization: `Basic ${Buffer.from(raw, "utf8").toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  private async retrieveAuthToken(code: string): Promise<TokenSet> {
    const { clientId, clientSecret, redirectUri } = await this.getCredentials();
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", code);
    body.set("redirect_uri", redirectUri);

    const resp = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: this.basicAuthHeader(clientId, clientSecret),
      body,
    });

    const text = await resp.text();
    if (!resp.ok) {
      throw new Error(`Token exchange failed (${resp.status}): ${text}`);
    }

    return {
      ...JSON.parse(text),
      obtained_at: Date.now(),
      refresh_obtained_at: Date.now(),
    } as TokenSet;
  }

  private async refresh(
    refreshToken: string,
    refreshObtainedAt: number,
  ): Promise<TokenSet> {
    const { clientId, clientSecret } = await this.getCredentials();
    const body = new URLSearchParams();
    body.set("grant_type", "refresh_token");
    body.set("refresh_token", refreshToken);

    const resp = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: this.basicAuthHeader(clientId, clientSecret),
      body,
    });

    const text = await resp.text();
    if (!resp.ok) {
      const code = await this.requestAuth();
      return this.retrieveAuthToken(code);
    }

    return {
      ...JSON.parse(text),
      obtained_at: Date.now(),
      refresh_obtained_at: refreshObtainedAt,
    } as TokenSet;
  }
}
