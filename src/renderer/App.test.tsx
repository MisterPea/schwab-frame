import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import type { SchwabFrameApi } from "../main/preload";

function installSchwabFrameApi(
  overrides: Partial<SchwabFrameApi> = {},
): SchwabFrameApi {
  const api: SchwabFrameApi = {
    credentialsStatus: vi.fn(async () => ({
      hasCredentials: false,
      encryptionAvailable: true,
    })),
    saveCredentials: vi.fn(async () => ({
      hasCredentials: true,
      encryptionAvailable: true,
      clientId: "client-id",
      redirectUri: "https://127.0.0.1:8443",
    })),
    login: vi.fn(async () => ({
      tokenType: "Bearer",
      preference: {
        account: { type: "BROKERAGE", displayAcctId: "...1234" },
        offers: { level2Permissions: true },
        streamerInfo: { streamerSocketUrl: "wss://streamer.example.test/ws" },
      },
    })),
    clearSession: vi.fn(async () => ({
      hasCredentials: true,
      encryptionAvailable: true,
    })),
    clearCredentials: vi.fn(async () => ({
      hasCredentials: false,
      encryptionAvailable: true,
    })),
    ...overrides,
  };

  Object.defineProperty(window, "schwabFrame", {
    configurable: true,
    value: api,
  });

  return api;
}

describe("App frame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens credential settings on first run when no credentials are saved", async () => {
    const api = installSchwabFrameApi();

    render(<App />);

    expect(
      await screen.findByRole("dialog", { name: /schwab credentials/i }),
    ).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it("logs in and renders the default hello-world preference module", async () => {
    installSchwabFrameApi({
      credentialsStatus: vi.fn(async () => ({
        hasCredentials: true,
        encryptionAvailable: true,
        clientId: "client-id",
        redirectUri: "https://127.0.0.1:8443",
      })),
    });

    render(<App />);

    expect(await screen.findByText("Hey, Good Lookin'")).toBeInTheDocument();
    expect(screen.getByText("BROKERAGE")).toBeInTheDocument();
    expect(screen.getByText("...1234")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("wss://streamer.example.test/ws")).toBeInTheDocument();
  });

  it("lets users save credentials from the settings surface", async () => {
    const user = userEvent.setup();
    const api = installSchwabFrameApi();

    render(<App />);

    await user.type(await screen.findByLabelText("Client ID"), "client-id");
    await user.type(screen.getByLabelText("Client secret"), "secret");
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.saveCredentials).toHaveBeenCalledWith({
        clientId: "client-id",
        clientSecret: "secret",
        redirectUri: "https://127.0.0.1:8443",
      });
    });
  });

  it("shows login failures without exposing implementation details in React", async () => {
    installSchwabFrameApi({
      credentialsStatus: vi.fn(async () => ({
        hasCredentials: true,
        encryptionAvailable: true,
      })),
      login: vi.fn(async () => {
        throw new Error("OAuth failed");
      }),
    });

    render(<App />);

    expect(await screen.findByText("OAuth failed")).toBeInTheDocument();
  });
});
