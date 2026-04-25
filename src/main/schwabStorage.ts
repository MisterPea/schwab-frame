import { app, safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import keytar from "keytar";
import type { TokenCipher, TokenSet, TokenStore } from "@misterpea/schwab-node";

export type SchwabCredentials = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export type AuthMode = "managed" | "delegated";

export type AuthModeConfig = {
  mode: AuthMode;
  keychainService: string;
};

export const DEFAULT_KEYCHAIN_SERVICE = "schwab-node";

export type PublicCredentialStatus = {
  hasCredentials: boolean;
  encryptionAvailable: boolean;
  clientId?: string;
  redirectUri?: string;
  authMode: AuthMode;
  keychainService: string;
};

const CREDENTIAL_FILE = "schwab-credentials.enc";
const AUTH_MODE_FILE = "schwab-auth-mode.json";

function userDataPath(...parts: string[]): string {
  return join(app.getPath("userData"), ...parts);
}

function assertSafeStorage(): void {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Electron safeStorage encryption is unavailable on this machine. Credentials were not saved.",
    );
  }
}

async function writePrivateFile(filePath: string, contents: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, { encoding: "utf8", mode: 0o600 });
}

export class SafeStorageCredentialStore {
  private readonly filePath = userDataPath(CREDENTIAL_FILE);

  isEncryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable();
  }

  async load(): Promise<SchwabCredentials | null> {
    try {
      const encrypted = await readFile(this.filePath, "utf8");
      const decrypted = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
      return JSON.parse(decrypted) as SchwabCredentials;
    } catch {
      return null;
    }
  }

  async save(credentials: SchwabCredentials): Promise<void> {
    assertSafeStorage();
    const encrypted = safeStorage.encryptString(JSON.stringify(credentials));
    await writePrivateFile(this.filePath, encrypted.toString("base64"));
  }

  async clear(): Promise<void> {
    await rm(this.filePath, { force: true });
  }

  async credentialStatus(): Promise<Omit<PublicCredentialStatus, "authMode" | "keychainService">> {
    const credentials = await this.load();
    return {
      hasCredentials: credentials !== null,
      encryptionAvailable: this.isEncryptionAvailable(),
      clientId: credentials?.clientId,
      redirectUri: credentials?.redirectUri,
    };
  }
}

export class AuthModeStore {
  private readonly filePath = userDataPath(AUTH_MODE_FILE);

  async load(): Promise<AuthModeConfig> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      return JSON.parse(raw) as AuthModeConfig;
    } catch {
      return { mode: "managed", keychainService: DEFAULT_KEYCHAIN_SERVICE };
    }
  }

  async save(config: AuthModeConfig): Promise<void> {
    await writePrivateFile(this.filePath, JSON.stringify(config));
  }
}

export class KeychainTokenStore implements TokenStore {
  constructor(
    private readonly service: string,
    private readonly account = "tokens",
  ) {}

  async load(): Promise<TokenSet | null> {
    const raw = await keytar.getPassword(this.service, this.account);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenSet;
    } catch {
      return null;
    }
  }

  async save(tokens: TokenSet): Promise<void> {
    await keytar.setPassword(this.service, this.account, JSON.stringify(tokens));
  }

  async clear(): Promise<void> {
    await keytar.deletePassword(this.service, this.account);
  }
}

export function createSafeStorageTokenCipher(): TokenCipher {
  return {
    async encrypt(plainText) {
      assertSafeStorage();
      return safeStorage.encryptString(plainText).toString("base64");
    },
    async decrypt(cipherText) {
      return safeStorage.decryptString(Buffer.from(cipherText, "base64"));
    },
  };
}

export function getSchwabRuntimePaths() {
  const baseDir = userDataPath("schwab");
  return {
    baseDir,
    storageRoot: join(baseDir, "runtime"),
    tokenPath: join(baseDir, "token.enc"),
  };
}

export async function ensureSchwabRuntimeRoot(): Promise<void> {
  const runtime = getSchwabRuntimePaths();
  await mkdir(runtime.baseDir, { recursive: true });
  await mkdir(runtime.storageRoot, { recursive: true });
}
