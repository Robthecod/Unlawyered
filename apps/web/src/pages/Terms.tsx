/**
 * Terms of Use — plain-language terms matching how UNLAWYERED actually
 * works: AI-generated legal information (never advice), user-supplied
 * provider keys, no warranty. Last updated: September 2026.
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

export function Terms() {
  return (
    <article className="legal-page">
      <p className="nf-kicker">LEGAL</p>
      <h1>Terms of Use</h1>
      <p className="legal-updated">Last updated: September 2026</p>

      <p>
        By using UNLAWYERED you agree to these terms. They are deliberately
        short and in plain English — fitting, for a product whose whole job is
        translating legal language.
      </p>

      <Section title="1. Information, not advice">
        <p>{LEGAL_DISCLAIMER}</p>
        <p>
          Nothing on this site is a substitute for a qualified advocate who has
          read your documents and heard your facts. Laws vary by state, change
          over time, and depend heavily on facts the AI has not been told.
          Verify everything against primary sources before you act on it.
        </p>
      </Section>

      <Section title="2. Eligibility and acceptable use">
        <ul>
          <li>Use the service lawfully and only for legal-information purposes.</li>
          <li>
            Don't upload documents you have no right to process, and redact
            other people's personal data before uploading anything containing
            it.
          </li>
          <li>
            Don't attempt to disrupt, overload, or reverse the service's
            security controls (including its key store).
          </li>
          <li>
            AI output may be incomplete, outdated, or wrong. You are
            responsible for any decision you make based on it.
          </li>
        </ul>
      </Section>

      <Section title="3. Your API keys and costs">
        <ul>
          <li>
            You choose the AI provider and supply your own API key. That key is
            stored encrypted at rest and used only to route your requests.
          </li>
          <li>
            You are responsible for your provider account, its usage costs, and
            compliance with that provider's terms.
          </li>
          <li>
            The keyless Mock provider produces placeholder output for exploring
            the interface — it is not legal information and never will be.
          </li>
        </ul>
      </Section>

      <Section title="4. Third-party services">
        <p>
          AI generation is performed by third-party providers (Google, OpenAI,
          Anthropic) selected in Settings. Their availability, models, pricing,
          and terms are outside our control. UNLAWYERED is not affiliated with
          them.
        </p>
      </Section>

      <Section title="5. No warranty">
        <p>
          The service is provided "as is" and "as available", without
          warranties of any kind, express or implied, including merchantability,
          fitness for a particular purpose, and non-infringement. We do not
          warrant that the service will be uninterrupted, accurate, or
          error-free.
        </p>
      </Section>

      <Section title="6. Limitation of liability">
        <p>
          To the maximum extent permitted by law, UNLAWYERED's operators are not
          liable for any indirect, incidental, special, consequential, or
          punitive damages, or for any loss of data, profits, or opportunities,
          arising from your use of or inability to use the service. If the
          instance you use is operated by someone else, their terms may add to
          or replace this section.
        </p>
      </Section>

      <Section title="7. Changes to these terms">
        <p>
          We may update these terms; the current version lives on this page with
          its updated date. Continued use after changes means you accept them.
        </p>
      </Section>

      <Section title="8. Governing law">
        <p>
          These terms are governed by the laws of India, and courts in
          Bengaluru, Karnataka have exclusive jurisdiction — subject to the
          previous paragraph for self-hosted instances.
        </p>
      </Section>

      <div className="disclaimer">
        <strong>Reminder:</strong> UNLAWYERED provides legal information, not
        legal advice, and creates no advocate–client relationship.
      </div>
    </article>
  );
}
