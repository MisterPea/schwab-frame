import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => {
  const state = {
    encryptionAvailable: true,
    userData: "",
  };

  return {
    state,
    app: {
      getPath: vi.fn(() => state.userData),
    },
    safeStorage: {
      isEncryptionAvailable: vi.fn(() => state.encryptionAvailable),
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

vi.mock("electron", () => ({
  app: electronMock.app,
  safeStorage: electronMock.safeStorage,
}));

describe("SafeStorageCredentialStore", () => {
  beforeEach(async () => {
    electronMock.state.encryptionAvailable = true;
    electronMock.state.userData = await mkdtemp(join(tmpdir(), "schwab-frame-storage-"));
  });

  afterEach(async () => {
    await rm(electronMock.state.userData, { force: true, recursive: true });
  });

  it("encrypts credentials on disk and never exposes the client secret in status", async () => {
    const { SafeStorageCredentialStore } = await import("./schwabStorage.js");
    const store = new SafeStorageCredentialStore();

    await store.save({
      clientId: "client-id",
      clientSecret: "super-secret",
      redirectUri: "https://127.0.0.1:8443",
    });

    const raw = await readFile(
      join(electronMock.state.userData, "schwab-credentials.enc"),
      "utf8",
    );
    expect(raw).not.toContain("super-secret");

    await expect(store.load()).resolves.toEqual({
      clientId: "client-id",
      clientSecret: "super-secret",
      redirectUri: "https://127.0.0.1:8443",
    });
    await expect(store.status()).resolves.toEqual({
      hasCredentials: true,
      encryptionAvailable: true,
      clientId: "client-id",
      redirectUri: "https://127.0.0.1:8443",
    });
  });

  it("refuses to save credentials when safeStorage encryption is unavailable", async () => {
    const { SafeStorageCredentialStore } = await import("./schwabStorage.js");
    const store = new SafeStorageCredentialStore();
    electronMock.state.encryptionAvailable = false;

    await expect(
      store.save({
        clientId: "client-id",
        clientSecret: "super-secret",
        redirectUri: "https://127.0.0.1:8443",
      }),
    ).rejects.toThrow("safeStorage encryption is unavailable");
  });

  it("round-trips token payloads through the same safeStorage cipher", async () => {
    const { createSafeStorageTokenCipher } = await import("./schwabStorage.js");
    const cipher = createSafeStorageTokenCipher();

    const encrypted = await cipher.encrypt('{"token":"abc"}');

    expect(encrypted).not.toContain("abc");
    await expect(cipher.decrypt(encrypted)).resolves.toBe('{"token":"abc"}');
  });
});
