import {
  EncryptedFileTokenStore,
  SchwabAuth,
  getUserPreference,
  resolveSchwabPaths,
  setDefaultAuth,
} from "@misterpea/schwab-node";
import { setupCerts } from "@misterpea/schwab-node/scripts/setup-certs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import {
  SafeStorageCredentialStore,
  createSafeStorageTokenCipher,
  ensureSchwabRuntimeRoot,
  getSchwabRuntimePaths,
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

const credentialStore = new SafeStorageCredentialStore();
let auth: ElectronSchwabAuth | null = null;

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

function buildAuth(credentials: SchwabCredentials): ElectronSchwabAuth {
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

async function getConfiguredAuth(): Promise<ElectronSchwabAuth> {
  if (auth) return auth;

  const credentials = await credentialStore.load();
  if (!credentials) {
    throw new Error("Save Schwab credentials before logging in.");
  }

  auth = buildAuth(credentials);
  return auth;
}

function summarizePreference(
  preference: Awaited<ReturnType<typeof getUserPreference>>,
): SchwabPreferenceSummary {
  const account = preference.accounts?.[0];
  const offers = preference.offers?.[0];
  const streamerInfo = preference.streamerInfo?.[0];

  return {
    account: account
      ? {
          type: account.type,
          displayAcctId: account.displayAcctId,
        }
      : undefined,
    offers: offers
      ? {
          level2Permissions: offers.level2Permissions,
        }
      : undefined,
    streamerInfo: streamerInfo
      ? {
          streamerSocketUrl: streamerInfo.streamerSocketUrl,
        }
      : undefined,
  };
}

export async function getCredentialStatus(): Promise<PublicCredentialStatus> {
  return credentialStore.status();
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

  auth = buildAuth(normalized);
  return credentialStore.status();
}

export async function login(): Promise<LoginResult> {
  const credentials = await credentialStore.load();
  if (!credentials) {
    throw new Error("Save Schwab credentials before logging in.");
  }

  validateCredentials(credentials);
  await ensureCallbackCerts(credentials);

  const configuredAuth = await getConfiguredAuth();
  const token = await configuredAuth.getAuth();
  const preference = await getUserPreference();

  return {
    tokenType: token.token_type,
    preference: summarizePreference(preference),
  };
}

export async function clearSession(): Promise<PublicCredentialStatus> {
  const configuredAuth = await getConfiguredAuth().catch(() => null);
  await configuredAuth?.clearAuth();
  auth = null;
  return credentialStore.status();
}

export async function clearCredentials(): Promise<PublicCredentialStatus> {
  const configuredAuth = await getConfiguredAuth().catch(() => null);
  await configuredAuth?.clearAuth();
  await credentialStore.clear();
  auth = null;
  return credentialStore.status();
}
