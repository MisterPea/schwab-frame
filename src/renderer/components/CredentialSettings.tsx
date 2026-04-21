import { KeyRound, Trash2, X } from "lucide-react";
import { FormEvent, useState } from "react";
import type {
  PublicCredentialStatus,
  SchwabCredentials,
} from "../../main/preload";

type Props = {
  status: PublicCredentialStatus | null;
  onClose(): void;
  onSaved(status: PublicCredentialStatus): void;
  onCleared(status: PublicCredentialStatus): void;
};

export function CredentialSettings({
  status,
  onClose,
  onSaved,
  onCleared,
}: Props) {
  const [clientId, setClientId] = useState(status?.clientId ?? "");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState(
    status?.redirectUri ?? "https://127.0.0.1:8443",
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);

    const credentials: SchwabCredentials = {
      clientId,
      clientSecret,
      redirectUri,
    };

    try {
      const nextStatus = await window.schwabFrame.saveCredentials(credentials);
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
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            title="Close settings"
            aria-label="Close settings"
          >
            <X size={18} />
          </button>
        </header>

        {!status?.encryptionAvailable ? (
          <div className="notice error">
            Electron safeStorage encryption is not available, so credentials
            cannot be saved on this machine.
          </div>
        ) : null}

        {message ? <div className="notice error">{message}</div> : null}

        <form className="settings-form" onSubmit={submit}>
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

          <footer className="settings-footer">
            <button
              className="secondary-button danger"
              type="button"
              onClick={clearCredentials}
              disabled={busy || !status?.hasCredentials}
            >
              <Trash2 size={16} />
              Clear
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={busy || !status?.encryptionAvailable}
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
