import { CheckCircle2 } from "lucide-react";
import type { SchwabPreferenceSummary } from "../../main/preload";

type Props = {
  preference: SchwabPreferenceSummary;
};

function displayValue(value: unknown): string {
  if (value === undefined || value === null || value === "") return "Unavailable";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  return String(value);
}

export function HelloWorldModule({ preference }: Props) {
  const rows = [
    ["account.type", preference.account?.type],
    ["account.displayAcctId", preference.account?.displayAcctId],
    ["offers.level2Permissions", preference.offers?.level2Permissions],
    ["streamerInfo.streamerSocketUrl", preference.streamerInfo?.streamerSocketUrl],
  ] as const;

  return (
    <article className="hello-module">
      <div className="module-title">
        <CheckCircle2 size={22} />
        <div>
          <p className="eyebrow">OAuth confirmed</p>
          <h2>Hello world</h2>
        </div>
      </div>
      <div className="preference-grid">
        {rows.map(([label, value]) => (
          <div className="preference-row" key={label}>
            <span>{label}</span>
            <strong>{displayValue(value)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}
