import type { SchwabPreferenceSummary } from "../../main/preload";
import { HelloWorldModule } from "./HelloWorldModule";

type Props = {
  preference: SchwabPreferenceSummary;
};

export function AppContent({ preference }: Props) {
  return (
    <section className="module-bay" aria-label="Schwab application modules">
      <HelloWorldModule preference={preference} />
    </section>
  );
}
