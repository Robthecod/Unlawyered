/**
 * Privacy Policy — written to match how the app actually behaves: keys are
 * stored encrypted at rest, never echoed to any client; documents live in
 * memory only; AI requests are routed through this backend to the chosen
 * provider. Last updated: September 2026.
 */
import { LEGAL_DISCLAIMER } from "@unlawyered/shared";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

export function Privacy() {
  return (
    <article className="legal-page">
      <p className="nf-kicker">LEGAL</p>
      <h1>Privacy Policy</h1>
      <p className="legal-updated">Last updated: September 2026</p>

      <p>
        UNLAWYERED ("we", "the service") is built to need as little of your
        data as possible. This policy explains what is collected, where it
        lives, and who sees it. The short version: your API keys are encrypted
        at rest and never returned to any browser, your documents are processed
        in memory and not stored, and your AI requests are routed through our
        backend to the provider you choose.
      </p>

      <Section title="1. What we store">
        <ul>
          <li>
            <strong>Provider choice and API keys.</strong> If you add a key for
            Gemini, OpenAI, or Anthropic, it is stored on the server encrypted
            with AES-256-GCM using a machine-local secret. Keys are never
            returned to any client — not even masked. The Settings page only
            ever receives booleans ("a key is set").
          </li>
          <li>
            <strong>Documents.</strong> Files you upload are parsed in memory
            to extract text. Uploaded documents are not written to disk and not
            stored after your request completes. The document text you send to
            an AI tool is held only for the duration of that request.
          </li>
          <li>
            <strong>Server logs.</strong> The backend writes basic operational
            logs (errors, startup info). Logs are not a marketing product and
            are not sold or shared.
          </li>
          <li>
            <strong>No accounts, no analytics.</strong> There are no user
            accounts and no third-party analytics scripts on this site.
          </li>
        </ul>
      </Section>

      <Section title="2. What leaves your browser">
        <ul>
          <li>
            <strong>To our backend.</strong> Your questions, law names, and
            document text for the tool you invoked, plus your chosen provider
            and (once, when you save it) your API key.
          </li>
          <li>
            <strong>To your chosen AI provider.</strong> The backend forwards
            the tool's prompt — which includes your question or document text —
            to Gemini, OpenAI, or Anthropic over HTTPS. That provider processes
            the request under its own privacy policy and terms. If you prefer
            not to send text to a vendor, use the keyless Mock provider for
            exploring the interface.
          </li>
        </ul>
        <p>
          Your API key is <em>never</em> sent to the browser again after you
          save it, and is only used server-side to authenticate calls to the
          provider you selected.
        </p>
      </Section>

      <Section title="3. Cookies and local storage">
        <p>
          UNLAWYERED sets no cookies and uses no browser storage. Your provider
          selection lives on the server, not in your browser.
        </p>
      </Section>

      <Section title="4. Data retention">
        <ul>
          <li>API keys: retained until you remove them in Settings.</li>
          <li>Documents: memory only — gone when your request ends.</li>
          <li>AI results: not stored server-side; they exist in your tab until you close or navigate.</li>
        </ul>
      </Section>

      <Section title="5. Your choices and controls">
        <ul>
          <li>Remove a stored key at any time on the Settings page (or via <code>DELETE /api/settings/key</code>).</li>
          <li>Self-host: the entire codebase runs locally, and keys can be pre-seeded via environment variables on your own machine.</li>
          <li>Prefer zero vendor exposure? Use the Mock provider — it never contacts any AI vendor.</li>
        </ul>
      </Section>

      <Section title="6. Security">
        <p>
          Keys are encrypted at rest (AES-256-GCM, machine-local secret written
          with restrictive permissions) and transmitted over TLS when you save
          them. No key value is ever included in any API response. The data
          directory is excluded from version control.
        </p>
      </Section>

      <Section title="7. Children">
        <p>
          UNLAWYERED is a general-audience legal-information tool and is not
          directed at children under 13.
        </p>
      </Section>

      <Section title="8. Changes to this policy">
        <p>
          Material changes will be reflected on this page with an updated date.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Run the project yourself? You are the data controller. Otherwise,
          reach the operator of the UNLAWYERED instance you are using.
        </p>
      </Section>

      <div className="disclaimer">
        <strong>Also note:</strong> {LEGAL_DISCLAIMER}
      </div>
    </article>
  );
}
