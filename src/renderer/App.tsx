import { RefreshCcw, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { CredentialSettings } from "./components/CredentialSettings";
import { AppContent } from "./modules/AppContent";
import type {
  LoginResult,
  PublicCredentialStatus,
} from "../main/preload";

type AppState = {
  status: PublicCredentialStatus | null;
  login: LoginResult | null;
  loading: boolean;
  message: string | null;
  settingsOpen: boolean;
};

export function App() {
  const [state, setState] = useState<AppState>({
    status: null,
    login: null,
    loading: true,
    message: null,
    settingsOpen: false,
  });

  async function refreshStatus() {
    const status = await window.schwabFrame.credentialsStatus();
    setState((current) => ({
      ...current,
      status,
      loading: false,
      settingsOpen: !status.hasCredentials,
    }));
  }

  async function handleLogin() {
    setState((current) => ({ ...current, loading: true, message: null }));
    try {
      const login = await window.schwabFrame.login();
      setState((current) => ({ ...current, login, loading: false }));
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  useEffect(() => {
    refreshStatus().catch((error) => {
      setState((current) => ({
        ...current,
        loading: false,
        message: error instanceof Error ? error.message : String(error),
      }));
    });
  }, []);

  useEffect(() => {
    if (state.status?.hasCredentials && !state.login && !state.settingsOpen) {
      handleLogin();
    }
  }, [state.status?.hasCredentials, state.settingsOpen]);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">@misterpea/schwab-node</p>
          <h1>Schwab Frame</h1>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button"
            type="button"
            onClick={handleLogin}
            disabled={state.loading || !state.status?.hasCredentials}
            title="Refresh Schwab session"
            aria-label="Refresh Schwab session"
          >
            <RefreshCcw size={18} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() =>
              setState((current) => ({
                ...current,
                settingsOpen: true,
                message: null,
              }))
            }
            title="Open settings"
            aria-label="Open settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {state.message ? <div className="notice error">{state.message}</div> : null}

      {state.loading ? (
        <section className="empty-state">
          <div className="loader" />
          <p>Preparing Schwab session...</p>
        </section>
      ) : state.login ? (
        <AppContent preference={state.login.preference} />
      ) : (
        <section className="empty-state">
          <h2>Connect Schwab to start</h2>
          <p>
            Add your Schwab developer credentials once, then this frame will open
            the OAuth flow and hand developers a ready React surface.
          </p>
          <button
            className="primary-button"
            type="button"
            onClick={() =>
              setState((current) => ({ ...current, settingsOpen: true }))
            }
          >
            Open settings
          </button>
        </section>
      )}

      {state.settingsOpen ? (
        <CredentialSettings
          status={state.status}
          onClose={() =>
            setState((current) => ({ ...current, settingsOpen: false }))
          }
          onSaved={(status) =>
            setState((current) => ({
              ...current,
              status,
              settingsOpen: false,
              login: null,
              message: null,
            }))
          }
          onCleared={(status) =>
            setState((current) => ({
              ...current,
              status,
              settingsOpen: !status.hasCredentials,
              login: null,
              message: null,
            }))
          }
        />
      ) : null}
    </main>
  );
}
