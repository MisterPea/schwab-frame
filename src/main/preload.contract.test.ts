import { describe, expect, it, vi } from "vitest";

const electronMock = vi.hoisted(() => ({
  exposed: undefined as unknown,
  contextBridge: {
    exposeInMainWorld: vi.fn((name: string, api: unknown) => {
      electronMock.exposed = { name, api };
    }),
  },
  ipcRenderer: {
    invoke: vi.fn((channel: string, payload?: unknown) =>
      Promise.resolve({ channel, payload }),
    ),
  },
}));

vi.mock("electron", () => ({
  contextBridge: electronMock.contextBridge,
  ipcRenderer: electronMock.ipcRenderer,
}));

describe("preload API contract", () => {
  it("exposes the stable Schwab frame API and IPC channel names", async () => {
    await import("./preload.js");

    const exposed = electronMock.exposed as {
      name: string;
      api: Record<string, (...args: unknown[]) => Promise<unknown>>;
    };

    expect(exposed.name).toBe("schwabFrame");
    expect(Object.keys(exposed.api).sort()).toEqual([
      "clearCredentials",
      "clearSession",
      "credentialsStatus",
      "login",
      "saveCredentials",
    ]);

    await exposed.api.credentialsStatus();
    await exposed.api.saveCredentials({ clientId: "id" });
    await exposed.api.login();
    await exposed.api.clearSession();
    await exposed.api.clearCredentials();

    expect(electronMock.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      1,
      "schwab:credentials-status",
    );
    expect(electronMock.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      2,
      "schwab:save-credentials",
      { clientId: "id" },
    );
    expect(electronMock.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      3,
      "schwab:login",
    );
    expect(electronMock.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      4,
      "schwab:clear-session",
    );
    expect(electronMock.ipcRenderer.invoke).toHaveBeenNthCalledWith(
      5,
      "schwab:clear-credentials",
    );
  });
});
