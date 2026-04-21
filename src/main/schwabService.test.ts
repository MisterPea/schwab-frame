import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const state = {
    userData: `${process.env.TMPDIR || "/tmp"}/schwab-frame-service-${Date.now()}`,
  };

  return {
    state,
    app: {
      getPath: vi.fn(() => state.userData),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => true),
      encryptString: vi.fn((plainText: string) =>
        Buffer.from(`safe:${Buffer.from(plainText, "utf8").toString("base64")}`),
      ),
      decryptString: vi.fn((cipherText: Buffer) => {
        const raw = cipherText.toString("utf8");
        if (!raw.startsWith("safe:")) throw new Error("Invalid cipher text");
        return Buffer.from(raw.slice(5), "base64").toString("utf8");
      }),
    },
  };
});

const schwabMock = vi.hoisted(() => {
  const authInstances: Array<{
    config: unknown;
    getAuth: ReturnType<typeof vi.fn>;
    clearAuth: ReturnType<typeof vi.fn>;
  }> = [];

  class FakeElectronSchwabAuth {
    config: unknown;
    getAuth = vi.fn(async () => ({ token_type: "Bearer" }));
    clearAuth = vi.fn(async () => undefined);

    constructor(config: unknown) {
      this.config = config;
      authInstances.push(this);
    }
  }

  class FakeEncryptedFileTokenStore {
    filePath: string;
    cipher: unknown;

    constructor(filePath: string, cipher: unknown) {
      this.filePath = filePath;
      this.cipher = cipher;
    }
  }

  return {
    authInstances,
    FakeElectronSchwabAuth,
    FakeEncryptedFileTokenStore,
    getUserPreference: vi.fn(async () => ({
      accounts: [{ type: "BROKERAGE", displayAcctId: "...1234" }],
      offers: [{ level2Permissions: true }],
      streamerInfo: [{ streamerSocketUrl: "wss://streamer.example.test/ws" }],
    })),
    resolveSchwabPaths: vi.fn(
      ({ cwd, storageRoot }: { cwd: string; storageRoot: string }) => ({
        cwd,
        envPath: join(cwd, ".env"),
        storageRoot,
        tokenPath: join(storageRoot, "token"),
        certsDir: join(storageRoot, "certs"),
        callbackUrlPath: join(storageRoot, "callback-url"),
      }),
    ),
    setDefaultAuth: vi.fn(),
    setupCerts: vi.fn(async () => undefined),
  };
});

vi.mock("electron", () => ({
  app: electronMock.app,
  safeStorage: electronMock.safeStorage,
}));

vi.mock("@misterpea/schwab-node", () => ({
  EncryptedFileTokenStore: schwabMock.FakeEncryptedFileTokenStore,
  SchwabAuth: class SchwabAuth {},
  getUserPreference: schwabMock.getUserPreference,
  resolveSchwabPaths: schwabMock.resolveSchwabPaths,
  setDefaultAuth: schwabMock.setDefaultAuth,
}));

vi.mock("@misterpea/schwab-node/scripts/setup-certs", () => ({
  setupCerts: schwabMock.setupCerts,
}));

vi.mock("./electronSchwabAuth.js", () => ({
  ElectronSchwabAuth: schwabMock.FakeElectronSchwabAuth,
}));

describe("schwabService contracts", () => {
  beforeEach(async () => {
    schwabMock.authInstances.length = 0;
    schwabMock.getUserPreference.mockClear();
    schwabMock.resolveSchwabPaths.mockClear();
    schwabMock.setDefaultAuth.mockClear();
    schwabMock.setupCerts.mockClear();
    await rm(electronMock.state.userData, { force: true, recursive: true });

    const service = await import("./schwabService.js");
    service.__resetSchwabServiceForTests();
  });

  afterAll(async () => {
    await rm(electronMock.state.userData, { force: true, recursive: true });
  });

  it("rejects unsafe redirect URIs before saving credentials", async () => {
    const { saveCredentials } = await import("./schwabService.js");

    await expect(
      saveCredentials({
        clientId: "client-id",
        clientSecret: "secret",
        redirectUri: "http://127.0.0.1:8443",
      }),
    ).rejects.toThrow("Redirect URI must use HTTPS");

    await expect(
      saveCredentials({
        clientId: "client-id",
        clientSecret: "secret",
        redirectUri: "https://example.com:8443",
      }),
    ).rejects.toThrow("127.0.0.1 or localhost");

    await expect(
      saveCredentials({
        clientId: "client-id",
        clientSecret: "secret",
        redirectUri: "https://127.0.0.1",
      }),
    ).rejects.toThrow("explicit port");
  });

  it("preserves the stored client secret when settings save leaves it blank", async () => {
    const { saveCredentials } = await import("./schwabService.js");
    const { SafeStorageCredentialStore } = await import("./schwabStorage.js");

    await saveCredentials({
      clientId: "client-id",
      clientSecret: "first-secret",
      redirectUri: "https://127.0.0.1:8443",
    });
    await saveCredentials({
      clientId: "updated-client-id",
      clientSecret: "",
      redirectUri: "https://127.0.0.1:8443",
    });

    await expect(new SafeStorageCredentialStore().load()).resolves.toEqual({
      clientId: "updated-client-id",
      clientSecret: "first-secret",
      redirectUri: "https://127.0.0.1:8443",
    });
  });

  it("ensures callback certs before auth and returns the safe user preference summary", async () => {
    const { login, saveCredentials } = await import("./schwabService.js");

    await saveCredentials({
      clientId: "client-id",
      clientSecret: "secret",
      redirectUri: "https://127.0.0.1:8443",
    });
    schwabMock.setupCerts.mockClear();

    const result = await login();
    const auth = schwabMock.authInstances.at(-1);

    expect(auth).toBeDefined();
    expect(schwabMock.setupCerts).toHaveBeenCalledWith({
      callbackUrl: "https://127.0.0.1:8443",
      paths: {
        cwd: join(electronMock.state.userData, "schwab"),
        storageRoot: join(electronMock.state.userData, "schwab", "runtime"),
      },
    });
    expect(schwabMock.setupCerts.mock.invocationCallOrder[0]).toBeLessThan(
      auth?.getAuth.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY,
    );
    expect(result).toEqual({
      tokenType: "Bearer",
      preference: {
        account: { type: "BROKERAGE", displayAcctId: "...1234" },
        offers: { level2Permissions: true },
        streamerInfo: { streamerSocketUrl: "wss://streamer.example.test/ws" },
      },
    });
  });
});
