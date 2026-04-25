import {
  EncryptedFileTokenStore,
  SchwabAuth,
  createDelegatedAuth,
  getUserPreference,
  resolveSchwabPaths,
  setDefaultAuth,
  type TokenSet,
} from "@misterpea/schwab-node";
import { setupCerts } from "@misterpea/schwab-node/scripts/setup-certs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import {
  AuthModeStore,
  KeychainTokenStore,
  SafeStorageCredentialStore,
  createSafeStorageTokenCipher,
  ensureSchwabRuntimeRoot,
  getSchwabRuntimePaths,
  type AuthModeConfig,
  type PublicCredentialStatus,
  type SchwabCredentials,
} from "./schwabStorage.js";
import { ElectronSchwabAuth } from "./electronSchwabAuth.js";

export type SchwabPreferenceSummary = {
  account?: {
    type?: string;
    displayAcctId?: string;
  };
  offers?: {
    level2Permissions?: boolean;
  };
  streamerInfo?: {
    streamerSocketUrl?: string;
  };
};

export type LoginResult = {
  tokenType: string;
  preference: SchwabPreferenceSummary;
};

type AnyAuth = { getAuth(): Promise<TokenSet>; clearAuth(): Promise<void> };

const credentialStore = new SafeStorageCredentialStore();
const authModeStore = new AuthModeStore();
let auth: AnyAuth | null = null;

export function __resetSchwabServiceForTests(): void {
  auth = null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateCredentials(credentials: SchwabCredentials): void {
  if (!credentials.clientId.trim()) throw new Error("Schwab client ID is required.");
  if (!credentials.clientSecret.trim()) throw new Error("Schwab client secret is required.");

  let redirect: URL;
  try {
    redirect = new URL(credentials.redirectUri);
  } catch {
    throw new Error("Redirect URI must be a valid URL.");
  }

  if (redirect.protocol !== "https:") {
    throw new Error("Redirect URI must use HTTPS.");
  }

  if (!["127.0.0.1", "localhost"].includes(redirect.hostname)) {
    throw new Error("Redirect URI must point to 127.0.0.1 or localhost.");
  }

  if (!redirect.port) {
    throw new Error("Redirect URI must include an explicit port.");
  }
}

async function ensureCallbackCerts(credentials: SchwabCredentials): Promise<void> {
  const runtime = getSchwabRuntimePaths();
  const hostname = new URL(credentials.redirectUri).hostname;
  const certPath = join(runtime.storageRoot, "certs", `${hostname}.pem`);
  const keyPath = join(runtime.storageRoot, "certs", `${hostname}-key.pem`);

  await ensureSchwabRuntimeRoot();

  if ((await fileExists(certPath)) && (await fileExists(keyPath))) {
    return;
  }

  await setupCerts({
    callbackUrl: credentials.redirectUri,
    paths: {
      cwd: runtime.baseDir,
      storageRoot: runtime.storageRoot,
    },
  });
}

function buildManagedAuth(credentials: SchwabCredentials): ElectronSchwabAuth {
  const runtime = getSchwabRuntimePaths();
  const paths = resolveSchwabPaths({
    cwd: runtime.baseDir,
    storageRoot: runtime.storageRoot,
  });
  const tokenStore = new EncryptedFileTokenStore(
    runtime.tokenPath,
    createSafeStorageTokenCipher(),
  );

  const nextAuth = new ElectronSchwabAuth({
    paths,
    tokenStore,
    secrets: {
      getClientId: () => credentials.clientId,
      getClientSecret: () => credentials.clientSecret,
      getRedirectUri: () => credentials.redirectUri,
    },
  });
  setDefaultAuth(nextAuth as unknown as SchwabAuth);
  return nextAuth;
}

async function getConfiguredAuth(): Promise<AnyAuth> {
  if (auth) return auth;

  const modeConfig = await authModeStore.load();

  if (modeConfig.mode === "delegated") {
    const keychainStore = new KeychainTokenStore(modeConfig.keychainService);
    const delegatedAuth = createDelegatedAuth(keychainStore);
    setDefaultAuth(delegatedAuth);
    return (auth = delegatedAuth);
  }

  const credentials = await credentialStore.load();
  if (!credentials) {
    throw new Error("Save Schwab credentials before logging in.");
  }

  return (auth = buildManagedAuth(credentials));
}

function summarizePreference(
  preference: Awaited<ReturnType<typeof getUserPreference>>,
): SchwabPreferenceSummary {
  const account = preference.accounts?.[0];
  const offers = preference.offers?.[0];
  const streamerInfo = preference.streamerInfo?.[0];

  return {
    account: account
      ? { type: account.type, displayAcctId: account.displayAcctId }
      : undefined,
    offers: offers
      ? { level2Permissions: offers.level2Permissions }
      : undefined,
    streamerInfo: streamerInfo
      ? { streamerSocketUrl: streamerInfo.streamerSocketUrl }
      : undefined,
  };
}

export async function getCredentialStatus(): Promise<PublicCredentialStatus> {
  const [credStatus, modeConfig] = await Promise.all([
    credentialStore.credentialStatus(),
    authModeStore.load(),
  ]);
  return {
    ...credStatus,
    hasCredentials: modeConfig.mode === "delegated" ? true : credStatus.hasCredentials,
    authMode: modeConfig.mode,
    keychainService: modeConfig.keychainService,
  };
}

export async function saveCredentials(
  credentials: SchwabCredentials,
): Promise<PublicCredentialStatus> {
  const existing = await credentialStore.load();
  const normalized = {
    clientId: credentials.clientId.trim(),
    clientSecret: credentials.clientSecret.trim() || existing?.clientSecret || "",
    redirectUri: credentials.redirectUri.trim(),
  };

  validateCredentials(normalized);
  await credentialStore.save(normalized);
  await ensureCallbackCerts(normalized);

  auth = buildManagedAuth(normalized);
  return getCredentialStatus();
}

export async function saveAuthMode(config: AuthModeConfig): Promise<PublicCredentialStatus> {
  await authModeStore.save(config);
  auth = null;
  return getCredentialStatus();
}

export async function login(): Promise<LoginResult> {
  const modeConfig = await authModeStore.load();

  if (modeConfig.mode === "managed") {
    const credentials = await credentialStore.load();
    if (!credentials) {
      throw new Error("Save Schwab credentials before logging in.");
    }
    validateCredentials(credentials);
    await ensureCallbackCerts(credentials);
  }

  const configuredAuth = await getConfiguredAuth();
  const token = await configuredAuth.getAuth();
  const preference = await getUserPreference();

  return {
    tokenType: token.token_type,
    preference: summarizePreference(preference),
  };
}

export async function clearSession(): Promise<PublicCredentialStatus> {
  const modeConfig = await authModeStore.load();
  if (modeConfig.mode === "managed") {
    const configuredAuth = await getConfiguredAuth().catch(() => null);
    await configuredAuth?.clearAuth();
  }
  auth = null;
  return getCredentialStatus();
}

export async function clearCredentials(): Promise<PublicCredentialStatus> {
  const modeConfig = await authModeStore.load();
  if (modeConfig.mode === "managed") {
    const configuredAuth = await getConfiguredAuth().catch(() => null);
    await configuredAuth?.clearAuth();
  }
  await credentialStore.clear();
  auth = null;
  return getCredentialStatus();
}
