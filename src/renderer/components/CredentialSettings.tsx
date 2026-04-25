import { HelpCircle, KeyRound, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type {
  AuthModeConfig,
  PublicCredentialStatus,
  SchwabCredentials,
} from "../../main/preload";
import { ThemeToggle } from "./ThemeToggle";
import type { Theme } from "../hooks/useTheme";

type Props = {
  status: PublicCredentialStatus | null;
  theme: Theme;
  onThemeToggle(): void;
  onClose(): void;
  onSaved(status: PublicCredentialStatus): void;
  onCleared(status: PublicCredentialStatus): void;
};

export function CredentialSettings({
  status,
  theme,
  onThemeToggle,
  onClose,
  onSaved,
  onCleared,
}: Props) {
  const [clientId, setClientId] = useState(status?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(
    status?.redirectUri ?? "https://127.0.0.1:8443",
  );
  const [delegated, setDelegated] = useState(status?.authMode === "delegated");
  const [keychainService, setKeychainService] = useState(
    status?.keychainService ?? "schwab-node",
  );
  const [showDelegatedInfo, setShowDelegatedInfo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    try {
      if (!delegated) {
        const credentials: SchwabCredentials = { clientId, clientSecret, redirectUri };
        await window.schwabFrame.saveCredentials(credentials);
      }

      const modeConfig: AuthModeConfig = {
        mode: delegated ? "delegated" : "managed",
        keychainService: keychainService.trim() || "schwab-node",
      };
      const nextStatus = await window.schwabFrame.saveAuthMode(modeConfig);
      onSaved(nextStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function clearCredentials() {
    setBusy(true);
    setMessage(null);
    try {
      const nextStatus = await window.schwabFrame.clearCredentials();
      onCleared(nextStatus);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header className="settings-header">
          <div>
            <p className="eyebrow">Secure setup</p>
            <h2 id="settings-title">Schwab credentials</h2>
          </div>
          <div className="settings-header-actions">
            <ThemeToggle theme={theme} onToggle={onThemeToggle} />
            <button
              className="icon-button"
              type="button"
              onClick={onClose}
              title="Close settings"
              aria-label="Close settings"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {!status?.encryptionAvailable ? (
          <div className="notice error">
            Electron safeStorage encryption is not available, so credentials
            cannot be saved on this machine.
          </div>
        ) : null}

        {message ? <div className="notice error">{message}</div> : null}

        <form className="settings-form" onSubmit={submit}>
          {!delegated ? (
            <>
              <label>
                <span>Client ID</span>
                <input
                  autoComplete="off"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  placeholder="ABCDEFGHIJKLMNOPQRSTUVWXZY123456"
                />
              </label>
              <label>
                <span>Client secret</span>
                <input
                  autoComplete="off"
                  type="password"
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  placeholder={status?.hasCredentials ? "Enter a new secret to replace" : "A1B2C3D4E5F6G7H8"}
                />
              </label>
              <label>
                <span>Redirect URI</span>
                <input
                  autoComplete="off"
                  value={redirectUri}
                  onChange={(event) => setRedirectUri(event.target.value)}
                  placeholder="https://127.0.0.1:8443"
                />
              </label>
            </>
          ) : null}

          <div className="auth-mode-section">
            <div className="auth-mode-row">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={delegated}
                  onChange={(e) => setDelegated(e.target.checked)}
                />
                <span>Use delegated auth</span>
              </label>
              <button
                type="button"
                className="info-button"
                onClick={() => setShowDelegatedInfo((v) => !v)}
                aria-label="About delegated auth"
                aria-expanded={showDelegatedInfo}
              >
                <HelpCircle size={15} />
              </button>
            </div>

            {showDelegatedInfo ? (
              <div className="info-box" role="note">
                <p>
                  Schwab allows one active OAuth session per account. Running
                  multiple apps in managed mode will invalidate each other's
                  tokens.
                </p>
                <p>
                  Delegated mode lets a separate daemon (
                  <code>schwab-auth-daemon</code>) own all token work. This app
                  reads the current token from the system keychain without
                  triggering any OAuth flow. The daemon must be running and
                  healthy to keep the token valid.
                </p>
                <p>
                  See{" "}
                  <a
                    href="https://github.com/MisterPea/schwab-node-persistent-auth"
                    target="_blank"
                    rel="noreferrer"
                  >
                    schwab-node-persistent-auth
                  </a>{" "}
                  for daemon setup.
                </p>
              </div>
            ) : null}

            {delegated ? (
              <label>
                <span>Keychain service name</span>
                <input
                  autoComplete="off"
                  value={keychainService}
                  onChange={(e) => setKeychainService(e.target.value)}
                  placeholder="schwab-node"
                />
              </label>
            ) : null}
          </div>

          <footer className="settings-footer">
            <button
              className="secondary-button danger"
              type="button"
              onClick={clearCredentials}
              disabled={busy || (!status?.hasCredentials && !delegated)}
            >
              <Trash2 size={16} />
              Clear
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={busy || (!delegated && !status?.encryptionAvailable)}
            >
              <KeyRound size={16} />
              Save
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
